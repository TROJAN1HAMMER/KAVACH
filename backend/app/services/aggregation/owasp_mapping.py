"""
KAVACH — OWASP Top 10 (2021) Mapping
OWASP's own Top 10:2021 methodology is published as CWE-to-category
mappings, so CWE is the preferred lookup key here; the category-based
table is a fallback for the rare case a CWE couldn't be resolved.
"""

from typing import Optional

OWASP_TOP_10_2021: dict[str, str] = {
    "A01": "Broken Access Control",
    "A02": "Cryptographic Failures",
    "A03": "Injection",
    "A04": "Insecure Design",
    "A05": "Security Misconfiguration",
    "A06": "Vulnerable and Outdated Components",
    "A07": "Identification and Authentication Failures",
    "A08": "Software and Data Integrity Failures",
    "A09": "Security Logging and Monitoring Failures",
    "A10": "Server-Side Request Forgery",
}

_CWE_TO_OWASP: dict[str, str] = {
    "CWE-798": "A07",
    "CWE-89": "A03",
    "CWE-78": "A03",
    "CWE-327": "A02",
    "CWE-502": "A08",
    "CWE-22": "A01",
    "CWE-330": "A02",
    "CWE-16": "A05",
    "CWE-1104": "A06",
    "CWE-1006": "A04",
}

_CATEGORY_TO_OWASP_FALLBACK: dict[str, str] = {
    "hardcoded_secret": "A07",
    "sql_injection": "A03",
    "command_injection": "A03",
    "weak_cryptography": "A02",
    "unsafe_deserialization": "A08",
    "path_traversal": "A01",
    "insecure_random": "A02",
    "security_misconfiguration": "A05",
    "vulnerable_dependency": "A06",
}


def map_to_owasp(cwe_id: Optional[str], category: str) -> tuple[Optional[str], Optional[str]]:
    code = _CWE_TO_OWASP.get(cwe_id) if cwe_id else None
    if not code:
        code = _CATEGORY_TO_OWASP_FALLBACK.get((category or "").lower())
    if not code:
        return None, None
    return code, OWASP_TOP_10_2021[code]
