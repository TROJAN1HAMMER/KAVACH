"""
KAVACH — Zero-Day Prediction Module
Heuristic-based zero-day risk scoring for banking applications.

This is a PROTOTYPE implementation using weighted heuristics.
The architecture is designed to allow replacement with a Random Forest
classifier in production (just swap the `predict()` function).

Heuristic Factors:
  1. Number of direct dependencies (more deps = larger attack surface)
  2. Number of critical/high CVEs already found (correlated with poor patch hygiene)
  3. Dependency staleness (old deps are more likely to have undiscovered vulns)
  4. Presence of risky dependency categories (crypto, deserialization, HTTP clients)
  5. Configuration risk score

Input:  SBOM dict, findings list, repo metadata
Output: ZeroDayRiskResult (risk_score, risk_level, factors)
"""

from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Optional
import structlog

from app.schemas.finding import RawFinding

logger = structlog.get_logger(__name__)


# ── Result Type ───────────────────────────────────────────────────────────────

@dataclass
class ZeroDayRiskResult:
    risk_score: float           # 0.0 – 100.0
    risk_level: str             # Low | Medium | High | Critical
    confidence: float           # 0.0 – 1.0 (prototype = 0.6 max)
    factors: dict[str, float]   # Individual factor contributions
    recommendation: str


# ── Risky Package Categories ──────────────────────────────────────────────────
# These package categories are historically associated with zero-day discovery

RISKY_PACKAGE_KEYWORDS = {
    "crypto", "cryptography", "ssl", "tls", "jwt", "oauth",
    "serialize", "pickle", "yaml", "xml", "json",
    "requests", "httpx", "urllib", "aiohttp",
    "paramiko", "fabric", "ansible",
    "django", "flask", "fastapi", "tornado",
    "sqlalchemy", "psycopg", "pymysql", "pymongo",
    "celery", "redis", "kafka", "rabbitmq",
}


def _count_dependencies(sbom: Optional[dict]) -> int:
    """Extract the count of dependencies from CycloneDX SBOM."""
    if not sbom:
        return 0
    components = sbom.get("components", [])
    return len(components)


def _count_risky_packages(sbom: Optional[dict]) -> int:
    """Count packages belonging to high-risk categories."""
    if not sbom:
        return 0
    risky = 0
    for comp in sbom.get("components", []):
        name = (comp.get("name", "") or "").lower()
        if any(kw in name for kw in RISKY_PACKAGE_KEYWORDS):
            risky += 1
    return risky


def _count_critical_high_cves(findings: list[RawFinding]) -> int:
    """Count CRITICAL and HIGH severity dependency findings."""
    return sum(
        1 for f in findings
        if f.source == "pip-audit" and f.severity.upper() in {"CRITICAL", "HIGH"}
    )


def _estimate_avg_dependency_age(sbom: Optional[dict]) -> float:
    """
    Estimate average dependency age in years.
    In a real implementation, this would query PyPI release dates.
    For prototype, we use a fixed estimate based on version numbers.
    """
    if not sbom:
        return 2.0  # Default assumption: 2 years

    versions = []
    for comp in sbom.get("components", []):
        version = comp.get("version", "0")
        # Extract major version as crude age proxy
        try:
            major = int(version.split(".")[0])
            # Very rough heuristic: major version 0-1 = newer, 3+ = older
            if major == 0:
                versions.append(0.5)
            elif major == 1:
                versions.append(1.5)
            elif major == 2:
                versions.append(3.0)
            else:
                versions.append(4.0 + (major - 3) * 0.5)
        except (ValueError, IndexError):
            versions.append(2.0)

    return sum(versions) / len(versions) if versions else 2.0


def _config_risk_factor(findings: list[RawFinding]) -> float:
    """Assess configuration risk from config-scanner findings."""
    config_findings = [f for f in findings if f.source == "config-scanner"]
    if not config_findings:
        return 0.0
    critical = sum(1 for f in config_findings if f.severity.upper() == "CRITICAL")
    high = sum(1 for f in config_findings if f.severity.upper() == "HIGH")
    return min(10.0, critical * 3.0 + high * 1.5)


# ── Core Prediction ───────────────────────────────────────────────────────────

def predict_zero_day_risk(
    findings: list[RawFinding],
    sbom: Optional[dict] = None,
) -> ZeroDayRiskResult:
    """
    Heuristic zero-day risk predictor.

    In a future production version, this function would:
    1. Extract features (same as below)
    2. Load a trained RandomForestClassifier model
    3. Return model.predict_proba(features)

    Current implementation uses weighted heuristics calibrated
    against banking application security research.

    Args:
        findings: All normalized findings from all scanners.
        sbom: CycloneDX SBOM dictionary (optional).

    Returns:
        ZeroDayRiskResult with score, level, and contributing factors.
    """
    factors: dict[str, float] = {}

    # ── Factor 1: Dependency Count (attack surface size) ──
    dep_count = _count_dependencies(sbom)
    # Score: 0-20 based on dep count
    # >100 deps = high risk, <20 = low risk
    dep_score = min(20.0, dep_count * 0.18)
    factors["dependency_count"] = round(dep_score, 2)
    logger.debug("zero_day.factor.dep_count", count=dep_count, score=dep_score)

    # ── Factor 2: Known CVE Density (patch hygiene indicator) ──
    critical_high_cves = _count_critical_high_cves(findings)
    # 5+ critical CVEs = very high risk of zero-day
    cve_score = min(30.0, critical_high_cves * 4.0)
    factors["known_cve_density"] = round(cve_score, 2)
    logger.debug("zero_day.factor.cve_density", cves=critical_high_cves, score=cve_score)

    # ── Factor 3: Dependency Staleness ──
    avg_age = _estimate_avg_dependency_age(sbom)
    # >3 years average age = elevated risk
    age_score = min(20.0, avg_age * 4.0)
    factors["dependency_staleness"] = round(age_score, 2)
    logger.debug("zero_day.factor.staleness", avg_age=avg_age, score=age_score)

    # ── Factor 4: Risky Package Categories ──
    risky_pkgs = _count_risky_packages(sbom)
    risky_score = min(15.0, risky_pkgs * 1.5)
    factors["risky_package_categories"] = round(risky_score, 2)
    logger.debug("zero_day.factor.risky_pkgs", count=risky_pkgs, score=risky_score)

    # ── Factor 5: Configuration Risk ──
    config_score = _config_risk_factor(findings)
    factors["configuration_risk"] = round(config_score, 2)
    logger.debug("zero_day.factor.config", score=config_score)

    # ── Factor 6: Code Vulnerability Density ──
    code_findings = [f for f in findings if f.source == "semgrep"]
    code_critical = sum(1 for f in code_findings if f.severity.upper() == "CRITICAL")
    code_score = min(15.0, code_critical * 2.5)
    factors["code_vulnerability_density"] = round(code_score, 2)

    # ── Total Score ──
    total_score = sum(factors.values())
    # Normalize to 0-100
    normalized_score = min(100.0, round(total_score, 2))
    factors["total_raw"] = round(total_score, 2)

    risk_level = _score_to_level(normalized_score)

    recommendation = _build_recommendation(normalized_score, factors)

    logger.info(
        "zero_day_predictor.complete",
        score=normalized_score,
        risk_level=risk_level,
        factors=factors,
    )

    return ZeroDayRiskResult(
        risk_score=normalized_score,
        risk_level=risk_level,
        confidence=0.55,  # Prototype confidence — replace with model calibration
        factors=factors,
        recommendation=recommendation,
    )


def _score_to_level(score: float) -> str:
    if score >= 70:
        return "Critical"
    elif score >= 45:
        return "High"
    elif score >= 20:
        return "Medium"
    else:
        return "Low"


def _build_recommendation(score: float, factors: dict[str, float]) -> str:
    lines = []

    if factors.get("known_cve_density", 0) > 15:
        lines.append("URGENT: High CVE density indicates poor patch hygiene — immediate dependency audit required.")

    if factors.get("dependency_count", 0) > 12:
        lines.append("Reduce dependency footprint — consider consolidating libraries to minimize attack surface.")

    if factors.get("dependency_staleness", 0) > 10:
        lines.append("Dependencies appear outdated — schedule a dependency refresh sprint.")

    if factors.get("configuration_risk", 0) > 5:
        lines.append("Configuration misconfigurations detected — harden deployment before production release.")

    if factors.get("code_vulnerability_density", 0) > 7:
        lines.append("High code vulnerability density — conduct a security code review with a qualified expert.")

    if not lines:
        lines.append("Zero-day risk is manageable. Maintain regular vulnerability scanning and patch cadence.")

    return " ".join(lines)
