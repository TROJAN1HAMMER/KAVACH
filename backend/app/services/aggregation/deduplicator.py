"""
KAVACH — Cross-Tool Deduplicator
`app/services/scanning/aggregator.py`'s existing fingerprint includes
`source` in the key — by design, at the time it was written, it only
needed to dedupe repeated findings *within* one tool's own output. It
structurally cannot merge the same issue reported by two different
tools, because two different tools always produce two different
fingerprints.

Enterprise SAST tools correlate across engines instead of just
concatenating their output: the same SQL injection flagged by both
semgrep and ast-grep at the same file/line should surface as ONE finding
backed by two tools (higher confidence, half the noise for a reviewer),
and the same CVE independently surfaced by pip-audit, OSV, and NVD
should collapse into one entry, not three.

Correlation key, in priority order:
  1. Same CVE + same package             → dependency findings from any
                                             of pip-audit/OSV/NVD
  2. Same file + line + category         → code findings from any of
                                             semgrep/ast-grep/joern/secrets
  3. Same file + category + title prefix → findings with no line number
                                             (docker/yaml structural checks)
"""

import hashlib
from collections import defaultdict

from app.schemas.finding import RawFinding


def _merge_key(finding: RawFinding) -> tuple:
    if finding.cve:
        return ("cve", finding.cve, finding.package or "")
    if finding.file_path and finding.line_number:
        return ("location", finding.file_path, finding.line_number, (finding.category or "").lower())
    return ("content", finding.file_path or "", (finding.category or "").lower(), finding.title[:80])


def _finding_id(key: tuple) -> str:
    return hashlib.sha256("|".join(str(part) for part in key).encode()).hexdigest()[:16]


def group_by_correlation(findings: list[RawFinding]) -> dict[str, list[RawFinding]]:
    """Returns {finding_id: [every RawFinding that correlates to it]}."""
    groups: dict[tuple, list[RawFinding]] = defaultdict(list)
    for finding in findings:
        groups[_merge_key(finding)].append(finding)
    return {_finding_id(key): group for key, group in groups.items()}
