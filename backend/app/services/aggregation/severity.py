"""
KAVACH — Severity Normalization
Canonicalizes whatever severity label a given tool used into one
consistent CRITICAL/HIGH/MEDIUM/LOW/INFO scale plus a comparable numeric
score — needed because cross-tool merging/sorting is only meaningful if
"HIGH" means the same thing regardless of which scanner said it.
"""

from typing import Optional

CANONICAL_SEVERITIES = ["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"]

# Defensive: every scanner in this codebase already emits a canonical
# label, but an enrichment layer designed the way enterprise SAST tools
# are shouldn't assume that always holds — a future tool integration or a
# raw semgrep/tool JSON payload might still use ERROR/WARNING/MODERATE/etc.
_SEVERITY_ALIASES = {
    "CRITICAL": "CRITICAL",
    "ERROR": "HIGH",
    "HIGH": "HIGH",
    "WARNING": "MEDIUM",
    "MEDIUM": "MEDIUM",
    "MODERATE": "MEDIUM",
    "LOW": "LOW",
    "NOTE": "LOW",
    "INFO": "INFO",
    "INFORMATIONAL": "INFO",
    "NONE": "INFO",
}

_SEVERITY_MIDPOINT_SCORE = {"CRITICAL": 9.5, "HIGH": 7.5, "MEDIUM": 5.0, "LOW": 3.0, "INFO": 1.0}


def normalize_severity(raw_severity: str, cvss: Optional[float] = None) -> tuple[str, float]:
    """
    Returns (canonical_severity, severity_score). A real CVSS score (when
    present and > 0) takes precedence over the tool's own label — it's
    strictly more precise; the label alone only kicks in as a fallback.
    """
    label = _SEVERITY_ALIASES.get((raw_severity or "").upper(), "MEDIUM")

    if cvss is not None and cvss > 0:
        if cvss >= 9.0:
            label = "CRITICAL"
        elif cvss >= 7.0:
            label = "HIGH"
        elif cvss >= 4.0:
            label = "MEDIUM"
        else:
            label = "LOW"
        return label, round(cvss, 1)

    return label, _SEVERITY_MIDPOINT_SCORE[label]
