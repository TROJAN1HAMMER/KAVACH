"""
KAVACH — Findings Aggregator
`aggregate_findings` below is superseded by the aggregation layer
(app/services/aggregation/aggregation_engine.py) for actual scan-pipeline
use: its fingerprint includes `source`, so it can only dedupe repeats
*within* one tool's own output — it can't merge the same issue reported
by two different tools, which is exactly what the new layer's
cross-tool correlation does. `summarize_findings` has no such limitation
(it's just counting) and remains in active use by aggregator_tasks.py.

Input:  Multiple list[RawFinding] from different scanner services
Output: list[RawFinding] — deduplicated, normalized, with unique IDs preserved via DB
"""

import hashlib
from typing import Sequence
import structlog

from app.schemas.finding import RawFinding

logger = structlog.get_logger(__name__)


def _finding_fingerprint(finding: RawFinding) -> str:
    """
    Generate a stable fingerprint for deduplication.
    Two findings are considered duplicates if they share category, file_path,
    line_number, and source.
    """
    key = "|".join([
        finding.category or "",
        finding.file_path or "",
        str(finding.line_number or ""),
        finding.source or "",
        finding.cve or "",
        finding.title[:60],
    ])
    return hashlib.sha256(key.encode()).hexdigest()


def aggregate_findings(*finding_lists: list[RawFinding]) -> list[RawFinding]:
    """
    Merge findings from multiple scanners.

    Steps:
      1. Flatten all finding lists
      2. Deduplicate by fingerprint (keep highest CVSS version)
      3. Sort by CVSS descending (most critical first)
      4. Return unified list

    Args:
        *finding_lists: Any number of lists returned by scanner modules.

    Returns:
        Deduplicated, sorted list of RawFinding objects.
    """
    seen: dict[str, RawFinding] = {}
    total_in = 0

    for finding_list in finding_lists:
        for finding in finding_list:
            total_in += 1
            fp = _finding_fingerprint(finding)

            if fp in seen:
                # Keep the version with the higher CVSS score
                if finding.cvss > seen[fp].cvss:
                    seen[fp] = finding
            else:
                seen[fp] = finding

    result = sorted(seen.values(), key=lambda f: f.cvss, reverse=True)

    logger.info(
        "aggregator.complete",
        total_input=total_in,
        after_dedup=len(result),
        duplicates_removed=total_in - len(result),
    )

    return result


def summarize_findings(findings: list[RawFinding]) -> dict:
    """
    Return a summary dict with counts broken down by severity.
    Used for dashboard display and report headers.
    """
    summary = {
        "total": len(findings),
        "CRITICAL": 0,
        "HIGH": 0,
        "MEDIUM": 0,
        "LOW": 0,
        "INFO": 0,
        "by_category": {},
        "by_source": {},
    }

    for f in findings:
        severity = f.severity.upper()
        if severity in summary:
            summary[severity] += 1  # type: ignore

        cat = f.category or "unknown"
        summary["by_category"][cat] = summary["by_category"].get(cat, 0) + 1

        src = f.source or "unknown"
        summary["by_source"][src] = summary["by_source"].get(src, 0) + 1

    return summary
