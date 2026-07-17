"""
KAVACH — Banking Risk Score (BRS) Engine
Business-aware risk scoring, deliberately not just CVSS. Combines 7
factors into one 0-10 blended sub-score per finding, then rolls per-finding
scores up into one 0-100 scan-level BRS.

Design is split in two, on purpose:

  - `score_finding()` is pure and synchronous — plain data in, plain data
    out, no DB/IO of any kind. That's what makes it fully unit-testable
    (see backend/tests/test_brs_engine.py) without mocking a database.
  - `calculate_brs()` is the async orchestration shell: it loads
    `BusinessModule`/`RiskFactorWeight` rows from Postgres (falling back
    to in-code defaults if the DB is unreachable or unseeded — scoring
    must never hard-fail because configuration is missing), classifies
    each finding into a module, and calls the pure function per finding.

Why a weighted AVERAGE across the 7 factors, not a product: multiplying
7 normalized terms collapses toward zero unless every single factor is
high, which doesn't match risk intuition — an actively-exploited RCE in
the Payments module should be able to drive risk high on its own, not get
dragged down because, say, historical incident count happens to be zero.
A weighted average (the same style FAIR and NIST 800-30's
qualitative-to-quantitative approaches use) doesn't have that failure mode,
and is what makes "weights configurable" via a single per-factor number
actually behave the way an operator would expect.
"""

import uuid
from dataclasses import dataclass, field
from typing import Optional

import structlog
from sqlalchemy.ext.asyncio import AsyncSession

from app.repositories.business_module_repository import BusinessModuleRepository
from app.repositories.finding_repository import FindingRepository
from app.repositories.risk_factor_weight_repository import RiskFactorWeightRepository
from app.schemas.finding import RawFinding
from app.services.compliance.compliance_mapper import ComplianceMappingData

logger = structlog.get_logger(__name__)


# ── Configuration data classes (plain — no ORM/pydantic dependency) ───────────

@dataclass
class ModuleConfig:
    name: str
    keywords: list[str]
    criticality_weight: float  # 0-10
    asset_value: float  # 0-10
    is_internet_facing_default: bool = False
    is_default: bool = False


@dataclass
class FactorWeights:
    cvss: float
    exploitability: float
    business_criticality: float
    internet_exposure: float
    compliance_impact: float
    asset_value: float
    historical_incidents: float


@dataclass
class FindingScore:
    brs: float
    module: str
    sub_scores: dict[str, float]


@dataclass
class BRSResult:
    total_brs: float
    risk_level: str
    finding_scores: list[dict] = field(default_factory=list)


# ── Defaults — used when the DB is unreachable/unseeded, and by unit tests ────
# Mirrors alembic/versions/0004_business_risk_config.py's seed data exactly;
# that migration is the source of truth once a real deployment can edit it.

DEFAULT_MODULES: list[ModuleConfig] = [
    ModuleConfig(
        name="Payments",
        keywords=["payment", "pay", "transaction", "transfer", "remittance", "upi", "neft", "imps", "rtgs"],
        criticality_weight=10.0,
        asset_value=10.0,
        is_internet_facing_default=True,
    ),
    ModuleConfig(
        name="Authentication",
        keywords=["auth", "login", "jwt", "session", "oauth", "token", "password", "credential", "2fa", "mfa"],
        criticality_weight=8.5,
        asset_value=8.0,
        is_internet_facing_default=True,
    ),
    ModuleConfig(
        name="Customer Data",
        keywords=["customer", "kyc", "pii", "personal", "account", "user_data", "profile", "aadhaar", "pan"],
        criticality_weight=7.0,
        asset_value=9.0,
        is_internet_facing_default=True,
    ),
    ModuleConfig(
        name="Admin",
        keywords=["admin", "management", "superuser", "dashboard"],
        criticality_weight=5.5,
        asset_value=6.0,
    ),
    ModuleConfig(
        name="Infrastructure",
        keywords=["dockerfile", "docker-compose", ".github", "helm", "k8s", "terraform"],
        criticality_weight=5.0,
        asset_value=6.0,
    ),
    ModuleConfig(
        name="Reporting",
        keywords=["report", "audit", "log", "analytics", "statement", "export"],
        criticality_weight=3.0,
        asset_value=3.0,
    ),
    ModuleConfig(
        name="General",
        keywords=[],
        criticality_weight=4.0,
        asset_value=4.0,
        is_default=True,
    ),
]

DEFAULT_FACTOR_WEIGHTS = FactorWeights(
    cvss=0.30,
    exploitability=0.15,
    business_criticality=0.20,
    internet_exposure=0.10,
    compliance_impact=0.10,
    asset_value=0.10,
    historical_incidents=0.05,
)


# ── Module classification ─────────────────────────────────────────────────────

def classify_module(finding: RawFinding, modules: list[ModuleConfig]) -> ModuleConfig:
    """
    First keyword match wins. Callers should pass `modules` ordered by
    descending criticality (BusinessModuleRepository.list_all() already
    does) so that if a finding's text could plausibly match more than one
    module, the more business-critical classification takes priority.

    Deliberately excludes `finding.description`: several scanners (e.g.
    secrets_scanner.py) share one generic, boilerplate description string
    across every rule ("Hardcoded credentials in source control are
    immediately compromised..."), which contains incidental module
    keywords (here, "credential") that have nothing to do with the
    specific finding. `file_path`/`category`/`title` are each scanner
    author's specific, intentional signal; `description` frequently isn't.
    """
    search_text = " ".join(
        filter(None, [finding.file_path, finding.category, finding.title])
    ).lower()

    for module in modules:
        if module.is_default:
            continue
        if any(keyword in search_text for keyword in module.keywords):
            return module

    return next((m for m in modules if m.is_default), modules[-1])


# ── Sub-score heuristics ───────────────────────────────────────────────────────

_EXPLOITABILITY_BY_CATEGORY: dict[str, float] = {
    "sql_injection": 9.5,
    "command_injection": 9.5,
    "unsafe_deserialization": 9.0,
    "hardcoded_secret": 8.5,
    "path_traversal": 7.5,
    "security_misconfiguration": 6.5,
    "vulnerable_dependency": 6.0,
    "weak_cryptography": 5.0,
    "insecure_random": 4.0,
}
_DEFAULT_EXPLOITABILITY = 5.0


def _exploitability_score(finding: RawFinding) -> float:
    base = _EXPLOITABILITY_BY_CATEGORY.get((finding.category or "").lower(), _DEFAULT_EXPLOITABILITY)
    # A known CVE (pip-audit/OSV/NVD) is a concretely fingerprinted,
    # publicly documented vulnerability — bump toward the high end
    # relative to a heuristic-only static-analysis pattern match.
    if finding.cve:
        base = max(base, 7.0)
    return min(base, 10.0)


_INTERNET_FACING_PATH_HINTS = (
    "api/", "routes/", "route/", "controller", "views/", "public/", "handlers/", "endpoints/",
)


def _internet_exposure_score(finding: RawFinding, module: ModuleConfig) -> float:
    if (finding.category or "").lower() == "security_misconfiguration" and (finding.severity or "").upper() in (
        "CRITICAL",
        "HIGH",
    ):
        # Dangerous-port / CORS-wildcard / privileged-container findings
        # are exposure issues almost by definition.
        return 9.0

    path = (finding.file_path or "").lower()
    if any(hint in path for hint in _INTERNET_FACING_PATH_HINTS):
        return 8.0

    if module.is_internet_facing_default:
        return 7.0

    return 3.0


def _compliance_impact_score(framework_count: int) -> float:
    return {0: 2.0, 1: 6.0, 2: 8.5}.get(framework_count, 10.0)


def _historical_incidents_score(incident_count: int) -> float:
    if incident_count <= 0:
        return 2.0
    if incident_count <= 2:
        return 4.0
    if incident_count <= 5:
        return 6.0
    if incident_count <= 10:
        return 8.0
    return 10.0


def compliance_framework_count(compliance: Optional[ComplianceMappingData]) -> int:
    if compliance is None:
        return 0
    return sum(1 for clause in (compliance.rbi_clause, compliance.pci_clause, compliance.swift_clause) if clause)


# ── Pure per-finding scoring ───────────────────────────────────────────────────

def _is_uncorroborated_nvd_lead(finding: RawFinding) -> bool:
    """True if this finding's only backing evidence is an NVD keyword-search
    hit, with no OSV/pip-audit confirmation of the same package. A plain
    RawFinding (pre cross-tool-correlation, or a unit-test fixture) only
    ever carries a single `.source`, so fall back to that when `.sources`
    (a `UnifiedFinding`-only field) isn't present."""
    sources = set(getattr(finding, "sources", None) or [finding.source])
    return "nvd-scanner" in sources and not ({"osv-scanner", "pip-audit"} & sources)


def score_finding(
    finding: RawFinding,
    *,
    module: ModuleConfig,
    factor_weights: FactorWeights,
    compliance_framework_count: int = 0,
    historical_incident_count: int = 0,
) -> FindingScore:
    """Pure and deterministic — see module docstring for why this is split from calculate_brs()."""
    cvss = max(0.0, min(finding.cvss, 10.0))
    if _is_uncorroborated_nvd_lead(finding):
        # nvd_scanner.py's own docstring: NVD's keywordSearch matches CVE
        # descriptions, not a precise CPE lookup — these are "leads worth
        # triaging, not confirmed hits" the way an OSV/pip-audit match is.
        # Scoring them at full CVSS weight let a single keyword collision
        # (e.g. an unrelated 2005 CVE matching a package name) drive a
        # clean repo's BRS as high as a repo with confirmed critical
        # findings. Halved, not zeroed: an NVD lead is still a real signal
        # worth a human looking at, just not proof of a real vulnerability.
        cvss *= 0.5
    sub_scores = {
        "cvss": cvss,
        "exploitability": _exploitability_score(finding),
        "business_criticality": module.criticality_weight,
        "internet_exposure": _internet_exposure_score(finding, module),
        "compliance_impact": _compliance_impact_score(compliance_framework_count),
        "asset_value": module.asset_value,
        "historical_incidents": _historical_incidents_score(historical_incident_count),
    }

    weight_map = {
        "cvss": factor_weights.cvss,
        "exploitability": factor_weights.exploitability,
        "business_criticality": factor_weights.business_criticality,
        "internet_exposure": factor_weights.internet_exposure,
        "compliance_impact": factor_weights.compliance_impact,
        "asset_value": factor_weights.asset_value,
        "historical_incidents": factor_weights.historical_incidents,
    }

    total_weight = sum(weight_map.values())
    if total_weight <= 0:
        # Every factor disabled — degenerate config; fall back to raw CVSS
        # rather than dividing by zero.
        blended = sub_scores["cvss"]
    else:
        blended = sum(sub_scores[key] * weight_map[key] for key in sub_scores) / total_weight

    brs = round(min(blended * 10.0, 100.0), 2)

    return FindingScore(brs=brs, module=module.name, sub_scores={k: round(v, 2) for k, v in sub_scores.items()})


def _calculate_risk_level(brs: float) -> str:
    """
    Thresholds empirically calibrated against *this* formula, not
    inherited from the old CVSS×weight×severity_multiplier one — they
    produce a very different range. `business_criticality` and
    `asset_value` are flat per-module properties, not scaled by the
    finding's own severity, so even a zero-CVSS finding in the most
    permissive module still blends to ~24 (measured floor). Reusing the
    old 10/20/30 cutoffs against this formula would classify nearly every
    scan "High" or "Critical" regardless of actual severity — measured
    range across representative scenarios: trivial ≈24-27, a single
    Medium-severity issue ≈53, a single High-severity one ≈80,
    worst-case (Critical, Payments, full aggravating context) ≈97.
    """
    if brs >= 82:
        return "Critical"
    elif brs >= 58:
        return "High"
    elif brs >= 35:
        return "Medium"
    else:
        return "Low"


# ── DB-driven configuration loading (falls back to defaults, never fails) ────

async def _load_modules(db: Optional[AsyncSession]) -> list[ModuleConfig]:
    if db is None:
        return DEFAULT_MODULES
    rows = await BusinessModuleRepository(db).list_all()
    if not rows:
        logger.warning("brs_engine.no_business_modules_configured — using defaults")
        return DEFAULT_MODULES
    return [
        ModuleConfig(
            name=r.name,
            keywords=list(r.keywords or []),
            criticality_weight=r.criticality_weight,
            asset_value=r.asset_value,
            is_internet_facing_default=r.is_internet_facing_default,
            is_default=r.is_default,
        )
        for r in rows
    ]


async def _load_factor_weights(db: Optional[AsyncSession]) -> FactorWeights:
    if db is None:
        return DEFAULT_FACTOR_WEIGHTS
    rows = await RiskFactorWeightRepository(db).list_all()
    if not rows:
        logger.warning("brs_engine.no_factor_weights_configured — using defaults")
        return DEFAULT_FACTOR_WEIGHTS
    by_name = {r.factor_name: r.weight for r in rows}
    return FactorWeights(
        cvss=by_name.get("cvss", DEFAULT_FACTOR_WEIGHTS.cvss),
        exploitability=by_name.get("exploitability", DEFAULT_FACTOR_WEIGHTS.exploitability),
        business_criticality=by_name.get("business_criticality", DEFAULT_FACTOR_WEIGHTS.business_criticality),
        internet_exposure=by_name.get("internet_exposure", DEFAULT_FACTOR_WEIGHTS.internet_exposure),
        compliance_impact=by_name.get("compliance_impact", DEFAULT_FACTOR_WEIGHTS.compliance_impact),
        asset_value=by_name.get("asset_value", DEFAULT_FACTOR_WEIGHTS.asset_value),
        historical_incidents=by_name.get("historical_incidents", DEFAULT_FACTOR_WEIGHTS.historical_incidents),
    )


async def _load_historical_counts(db: Optional[AsyncSession], repository_id: Optional[uuid.UUID]) -> dict[str, int]:
    if db is None or repository_id is None:
        return {}
    return await FindingRepository(db).count_historical_high_severity_by_module(repository_id)


# ── Async orchestration ────────────────────────────────────────────────────────

# ── Scan-level roll-up ─────────────────────────────────────────────────────────
#
# BUG FIX — incident: every scan, including sandbox low/medium fixtures,
# was landing at BRS=100/Critical. Root cause was the roll-up previously
# used here: `max(brs_list) + 0.1 * sum(everything else)`. Its second term
# has no upper bound as finding *count* grows — ten findings each scoring
# a mild ~40 already contribute `0.1 * (9 * 40) = 36` on top of the max,
# and any real scan across 9 tools routinely produces 20-40+ findings even
# for a genuinely low/medium-risk codebase. It was a volume bug, not a
# severity bug: more findings alone, regardless of how minor, pushed the
# score up without limit.
#
# The replacement combines two bounded signals and takes the larger:
#
#   1. A **self-weighted average** — Σ(brs_i²) / Σ(brs_i) — plus a small,
#      explicitly capped volume adjustment (`_volume_score()`, 0-9,
#      same bucketed style as `_historical_incidents_score`). A weighted
#      average is a convex combination of its inputs, so this term alone
#      can never exceed max(brs_list) — weighting each finding by its own
#      score means several similarly-severe findings pull the average up
#      together (a scan with 7 High-ish findings should read as more than
#      just "as risky as one of them"), while volume adds a small,
#      count-driven nudge that can never by itself cause saturation.
#   2. The plain **max(brs_list)** — a single dominant finding's own
#      score, unadorned.
#
# Taking `max()` of the two: when a scan has one clearly dominant finding
# amid many far less severe ones (one Critical secret leak among twenty
# Low findings), the self-weighted average dilutes toward the many small
# values — exactly the "diluted into Medium" failure mode the *original*
# design intent (preserved from the old formula's docstring) explicitly
# wanted to avoid, so the plain max wins and the scan is scored no lower
# than that one finding deserves. When severities are more evenly
# distributed (several similarly-scored Medium/High findings), the
# self-weighted-average-plus-volume term is the larger of the two and
# correctly reflects the *combined* picture rather than just the top
# finding. Either way the result is bounded — never able to exceed
# max(brs_list) by more than the volume cap (9) — so finding count alone
# can never be the difference between "Low" and "Critical."
#
# Verified against representative Low/Medium/High/Critical repositories
# in tests/test_brs_engine.py's TestRepositoryRiskProfiles — the ranges
# in this module's docstrings are not guessed, they're the actual output
# of this function against those fixtures.

_VOLUME_BUCKETS: list[tuple[int, float]] = [
    (1, 0.0),
    (5, 1.0),
    (15, 3.0),
    (30, 5.0),
    (50, 7.0),
]
_VOLUME_SCORE_MAX = 9.0  # ceiling for more than 50 findings


def _volume_score(finding_count: int) -> float:
    """Bounded 0-9 nudge for sheer finding volume — never enough on its own to cause saturation."""
    for threshold, score in _VOLUME_BUCKETS:
        if finding_count <= threshold:
            return score
    return _VOLUME_SCORE_MAX


def rollup_scan_brs(brs_list: list[float]) -> float:
    """
    Combine every finding's individual BRS into one scan-level score.
    Pure and synchronous, like `score_finding()` — see module docstring
    for why that split matters for testability, and the comment block
    above for why this is `max(self-weighted average + volume, max)`
    rather than either alone.
    """
    if not brs_list:
        return 0.0

    plain_sum = sum(brs_list)
    self_weighted_avg = (sum(b * b for b in brs_list) / plain_sum) if plain_sum > 0 else 0.0
    combined = self_weighted_avg + _volume_score(len(brs_list))

    return round(min(max(combined, max(brs_list)), 100.0), 2)


async def calculate_brs(
    findings: list[RawFinding],
    *,
    db: Optional[AsyncSession] = None,
    repository_id: Optional[uuid.UUID] = None,
    compliance_data_list: Optional[list[Optional[ComplianceMappingData]]] = None,
) -> BRSResult:
    """
    Score every finding, then roll up into one scan-level BRS via
    `rollup_scan_brs()`.

    `db`/`repository_id` are optional so this remains callable (with
    default configuration) outside a full request/worker context — unit
    tests exercise `score_finding()` directly instead, but this keeps
    `calculate_brs()` itself honest about degrading gracefully rather
    than requiring a live database to run at all.
    """
    if not findings:
        return BRSResult(total_brs=0.0, risk_level="Low", finding_scores=[])

    modules = await _load_modules(db)
    factor_weights = await _load_factor_weights(db)
    historical_counts = await _load_historical_counts(db, repository_id)

    finding_scores: list[dict] = []
    brs_list: list[float] = []

    for i, finding in enumerate(findings):
        module = classify_module(finding, modules)
        compliance = (
            compliance_data_list[i] if compliance_data_list and i < len(compliance_data_list) else None
        )

        score = score_finding(
            finding,
            module=module,
            factor_weights=factor_weights,
            compliance_framework_count=compliance_framework_count(compliance),
            historical_incident_count=historical_counts.get(module.name, 0),
        )

        finding_scores.append(
            {
                "finding_index": i,
                "brs": score.brs,
                "module": score.module,
                "sub_scores": score.sub_scores,
            }
        )
        # Uncorroborated NVD leads still get their own score above (visible
        # per-finding, e.g. in the findings table, for a human to triage) but
        # are excluded from the scan-level rollup input. NVD's keywordSearch
        # is a live external call whose result set varies run-to-run for the
        # *same* repository/dependencies (confirmed: an identical scan of an
        # unchanged repo returned 0 leads on one run and 15 on the next) —
        # letting an unconfirmed, non-deterministic lead move the one number
        # that drives risk_level/dashboards/regression baselines would make
        # the scan-level BRS itself non-deterministic, not just imprecise.
        if not _is_uncorroborated_nvd_lead(finding):
            brs_list.append(score.brs)

    normalized_brs = rollup_scan_brs(brs_list)
    risk_level = _calculate_risk_level(normalized_brs)

    logger.info(
        "brs_engine.complete",
        total_findings=len(findings),
        normalized_brs=normalized_brs,
        risk_level=risk_level,
    )

    return BRSResult(total_brs=normalized_brs, risk_level=risk_level, finding_scores=finding_scores)
