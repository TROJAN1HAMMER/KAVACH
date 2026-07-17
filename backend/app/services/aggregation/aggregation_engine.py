"""
KAVACH — Aggregation Engine
The single entry point the scan pipeline calls once every one of the 9
independent scanners has returned: `aggregate(findings_by_source)`.
Produces the unified, deduplicated, taxonomy-enriched finding list plus a
summary — the same shape an enterprise SAST tool's "unified results" view
is built from, and the source `to_unified_json` serializes for the
downloadable unified-findings report artifact.
"""

from dataclasses import dataclass, field

import structlog

from app.schemas.finding import RawFinding
from app.services.aggregation.deduplicator import group_by_correlation
from app.services.aggregation.enrichment import enrich_group
from app.services.aggregation.unified_finding import UnifiedFinding

logger = structlog.get_logger(__name__)


@dataclass
class AggregationResult:
    findings: list[UnifiedFinding]
    total_raw_findings: int
    total_unified_findings: int
    duplicates_merged: int
    by_severity: dict[str, int] = field(default_factory=dict)
    by_owasp_category: dict[str, int] = field(default_factory=dict)
    by_source: dict[str, int] = field(default_factory=dict)


def aggregate(findings_by_source: dict[str, list[RawFinding]]) -> AggregationResult:
    """
    `findings_by_source` keys are informational only (each RawFinding
    already carries its own `.source`) — present because that's the
    natural shape the chord callback in aggregator_tasks.py already has
    on hand (one list per completed scanner task).
    """
    all_raw: list[RawFinding] = [f for findings in findings_by_source.values() for f in findings]

    groups = group_by_correlation(all_raw)
    unified = [enrich_group(finding_id, group) for finding_id, group in groups.items()]
    unified.sort(key=lambda f: f.severity_score, reverse=True)

    by_severity: dict[str, int] = {}
    by_owasp: dict[str, int] = {}
    by_source: dict[str, int] = {}
    for f in unified:
        by_severity[f.canonical_severity] = by_severity.get(f.canonical_severity, 0) + 1
        if f.owasp_category:
            by_owasp[f.owasp_category] = by_owasp.get(f.owasp_category, 0) + 1
        for source in f.sources:
            by_source[source] = by_source.get(source, 0) + 1

    result = AggregationResult(
        findings=unified,
        total_raw_findings=len(all_raw),
        total_unified_findings=len(unified),
        duplicates_merged=len(all_raw) - len(unified),
        by_severity=by_severity,
        by_owasp_category=by_owasp,
        by_source=by_source,
    )

    logger.info(
        "aggregation_engine.complete",
        total_raw=result.total_raw_findings,
        total_unified=result.total_unified_findings,
        duplicates_merged=result.duplicates_merged,
    )
    return result


def to_unified_json(result: AggregationResult, *, scan_job_id: str, repo_name: str) -> dict:
    """The 'generate unified JSON' deliverable — written to disk and
    registered as a downloadable report artifact by aggregator_tasks.py."""
    return {
        "scan_job_id": scan_job_id,
        "repository": repo_name,
        "summary": {
            "total_raw_findings": result.total_raw_findings,
            "total_unified_findings": result.total_unified_findings,
            "duplicates_merged": result.duplicates_merged,
            "by_severity": result.by_severity,
            "by_owasp_category": result.by_owasp_category,
            "by_source": result.by_source,
        },
        "findings": [f.model_dump() for f in result.findings],
    }
