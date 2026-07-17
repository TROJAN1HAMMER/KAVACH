"""
KAVACH — CWE (Common Weakness Enumeration) Mapping
Maps a finding's `category` — already normalized across every scanner,
see RawFinding.category — to its corresponding CWE identifier. Every
enterprise SAST tool (Checkmarx, Semgrep, CodeQL, Snyk Code) surfaces
this per-finding; it's the taxonomy the rest of the industry (OWASP,
MITRE ATT&CK-to-CWE) is keyed off of, so it has to come first.
"""

from typing import Optional

CWE_MAPPING: dict[str, tuple[str, str]] = {
    "hardcoded_secret": ("CWE-798", "Use of Hard-coded Credentials"),
    "sql_injection": ("CWE-89", "Improper Neutralization of Special Elements used in an SQL Command"),
    "command_injection": ("CWE-78", "Improper Neutralization of Special Elements used in an OS Command"),
    "weak_cryptography": ("CWE-327", "Use of a Broken or Risky Cryptographic Algorithm"),
    "unsafe_deserialization": ("CWE-502", "Deserialization of Untrusted Data"),
    "path_traversal": ("CWE-22", "Improper Limitation of a Pathname to a Restricted Directory"),
    "insecure_random": ("CWE-330", "Use of Insufficiently Random Values"),
    "security_misconfiguration": ("CWE-16", "Configuration"),
    "vulnerable_dependency": ("CWE-1104", "Use of Unmaintained Third Party Components"),
}

DEFAULT_CWE: tuple[str, str] = ("CWE-1006", "Bad Coding Practices")


def map_to_cwe(category: str) -> tuple[Optional[str], Optional[str]]:
    return CWE_MAPPING.get((category or "").lower(), DEFAULT_CWE)
