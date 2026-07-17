"""
KAVACH — Compliance Engine
Deterministic, rule-based compliance evaluation — no AI/LLM calls
anywhere in this module (contrast with `services/ai/ai_engine.py`, which
explicitly does use one). Every verdict here is fully explainable by
pointing at the exact YAML rule that produced it.

Input:  list[RawFinding] — UnifiedFinding satisfies this (strict superset,
        same contract the BRS engine and report generator already rely on).
Output: one ControlResult per control in every loaded framework — PASS
        for controls no finding triggers, FAIL with evidence for ones
        that do. This is a genuinely different question than
        `compliance_mapper.py`'s: that module answers "which clauses does
        this finding relate to" (used by the BRS engine's compliance
        factor and the PDF's per-finding clause callouts); this one
        answers "for the full control catalog, what's our pass/fail
        posture" — a framework-level compliance report, not a per-finding
        annotation. Both stay in use for their respective purposes.
"""

from dataclasses import dataclass, field
from typing import Optional

import structlog

from app.schemas.finding import RawFinding
from app.services.compliance.rule_loader import SEVERITY_ORDER, Control, FrameworkRules, load_all_frameworks

logger = structlog.get_logger(__name__)


@dataclass
class Evidence:
    finding_title: str
    severity: str
    file_path: Optional[str]
    line_number: Optional[int]
    source: str


@dataclass
class ControlResult:
    requirement_id: str
    title: str
    description: str
    status: str  # "PASS" | "FAIL"
    evidence: list[Evidence]
    recommendation: str


@dataclass
class FrameworkComplianceReport:
    framework_name: str
    short_code: str
    version: str
    controls: list[ControlResult]
    total_controls: int
    passed_controls: int
    failed_controls: int
    compliance_percentage: float


@dataclass
class ComplianceEngineResult:
    frameworks: list[FrameworkComplianceReport] = field(default_factory=list)
    overall_compliance_percentage: float = 100.0


def _severity_at_least(severity: str, minimum: Optional[str]) -> bool:
    if minimum is None:
        return True
    try:
        return SEVERITY_ORDER.index((severity or "").upper()) >= SEVERITY_ORDER.index(minimum.upper())
    except ValueError:
        # An unrecognized severity string can't be compared meaningfully —
        # fail safe by not counting it as evidence rather than crashing.
        return False


def _finding_triggers_control(finding: RawFinding, control: Control) -> bool:
    trigger = control.trigger

    if not trigger.categories and not trigger.sources and not trigger.keywords and trigger.min_severity is None:
        # A trigger with no conditions at all is almost certainly a
        # rule-authoring mistake (an empty `trigger: {}` block), not an
        # intentional "matches every finding" control — treat it as
        # never matching rather than failing every scan against it.
        return False

    if trigger.categories and (finding.category or "").lower() not in trigger.categories:
        return False

    if not _severity_at_least(finding.severity, trigger.min_severity):
        return False

    if trigger.sources and (finding.source or "").lower() not in trigger.sources:
        return False

    if trigger.keywords:
        haystack = f"{finding.title} {finding.description}".lower()
        if not any(keyword in haystack for keyword in trigger.keywords):
            return False

    return True


def _evaluate_control(control: Control, findings: list[RawFinding]) -> ControlResult:
    matches = [f for f in findings if _finding_triggers_control(f, control)]
    evidence = [
        Evidence(
            finding_title=f.title,
            severity=f.severity,
            file_path=f.file_path,
            line_number=f.line_number,
            source=f.source,
        )
        for f in matches
    ]

    return ControlResult(
        requirement_id=control.requirement_id,
        title=control.title,
        description=control.description,
        status="FAIL" if evidence else "PASS",
        evidence=evidence,
        recommendation=control.recommendation,
    )


def evaluate_framework(framework: FrameworkRules, findings: list[RawFinding]) -> FrameworkComplianceReport:
    control_results = [_evaluate_control(c, findings) for c in framework.controls]

    total = len(control_results)
    failed = sum(1 for c in control_results if c.status == "FAIL")
    passed = total - failed
    percentage = round((passed / total) * 100, 1) if total else 100.0

    return FrameworkComplianceReport(
        framework_name=framework.name,
        short_code=framework.short_code,
        version=framework.version,
        controls=control_results,
        total_controls=total,
        passed_controls=passed,
        failed_controls=failed,
        compliance_percentage=percentage,
    )


def evaluate_compliance(
    findings: list[RawFinding], *, frameworks: Optional[dict[str, FrameworkRules]] = None
) -> ComplianceEngineResult:
    """
    Evaluate `findings` against every loaded framework. Pass `frameworks`
    explicitly in tests to evaluate against a fixed rule set rather than
    whatever's currently in app/data/compliance_rules/.
    """
    frameworks = frameworks if frameworks is not None else load_all_frameworks()

    if not frameworks:
        logger.warning("compliance_engine.no_frameworks_loaded")
        return ComplianceEngineResult(frameworks=[], overall_compliance_percentage=100.0)

    reports = [evaluate_framework(fw, findings) for fw in frameworks.values()]
    overall = round(sum(r.compliance_percentage for r in reports) / len(reports), 1)

    logger.info(
        "compliance_engine.complete",
        frameworks=[r.short_code for r in reports],
        total_findings=len(findings),
        overall_compliance_percentage=overall,
    )

    return ComplianceEngineResult(frameworks=reports, overall_compliance_percentage=overall)
