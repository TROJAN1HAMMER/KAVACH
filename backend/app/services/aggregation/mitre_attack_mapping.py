"""
KAVACH — MITRE ATT&CK Mapping
Necessarily coarser than CWE/OWASP: ATT&CK models attacker behavior
during an intrusion, not source-code weaknesses. The mapping here follows
the same principle MITRE's own "Mapping ATT&CK to CWE" work and vendor
code-scanning tools use — connect the weakness to the technique it most
directly enables, not a literal one-to-one correspondence.
"""

CATEGORY_TO_ATTACK: dict[str, list[tuple[str, str]]] = {
    "hardcoded_secret": [("T1552.001", "Unsecured Credentials: Credentials In Files")],
    "sql_injection": [("T1190", "Exploit Public-Facing Application")],
    "command_injection": [
        ("T1190", "Exploit Public-Facing Application"),
        ("T1059", "Command and Scripting Interpreter"),
    ],
    "weak_cryptography": [("T1600", "Weaken Encryption")],
    "unsafe_deserialization": [("T1190", "Exploit Public-Facing Application")],
    "path_traversal": [("T1083", "File and Directory Discovery")],
    "insecure_random": [("T1600", "Weaken Encryption")],
    "security_misconfiguration": [("T1190", "Exploit Public-Facing Application")],
    "vulnerable_dependency": [
        ("T1190", "Exploit Public-Facing Application"),
        ("T1195.001", "Supply Chain Compromise: Compromise Software Dependencies and Development Tools"),
    ],
}


def map_to_attack(category: str) -> tuple[list[str], list[str]]:
    entries = CATEGORY_TO_ATTACK.get((category or "").lower(), [])
    return [e[0] for e in entries], [e[1] for e in entries]
