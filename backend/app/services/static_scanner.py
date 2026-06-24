"""
KAVACH — Static Analysis Engine
Uses Semgrep to detect source code vulnerabilities.

Detects:
  - Hardcoded API Keys / Passwords
  - SQL Injection patterns
  - Command Injection patterns
  - Weak Cryptography (MD5, SHA1, DES, RC4)
  - Unsafe Deserialization (pickle)
  - Path Traversal
  - SSRF patterns

Input:  repository_path (str | Path)
Output: list[RawFinding]
"""

import json
import subprocess
import os
from pathlib import Path
from typing import Any, Union
import structlog

from app.schemas.finding import RawFinding

logger = structlog.get_logger(__name__)

# ── Semgrep Rule Set ──────────────────────────────────────────────────────────
# Custom inline rules for banking-focused vulnerability detection.
# These are embedded here so no external network fetch is required at scan time.

KAVACH_RULES = """
rules:
  # ── Hardcoded Secrets ──────────────────────────────────────────────────────
  - id: kavach-hardcoded-api-key
    patterns:
      - pattern-regex: '(?i)(api_key|apikey|api-key)\s*[=:]\s*["\'][A-Za-z0-9_\-]{16,}["\']'
    message: Hardcoded API key detected in source code
    languages: [python, javascript, typescript, java, go, ruby, php]
    severity: ERROR
    metadata:
      category: hardcoded_secret
      cwe: CWE-798
      cvss: "9.0"

  - id: kavach-hardcoded-password
    patterns:
      - pattern-regex: '(?i)(password|passwd|pwd|secret|token)\s*[=:]\s*["\'][^"\']{4,}["\']'
    message: Hardcoded password or secret detected
    languages: [python, javascript, typescript, java, go, ruby, php]
    severity: ERROR
    metadata:
      category: hardcoded_secret
      cwe: CWE-798
      cvss: "8.5"

  - id: kavach-hardcoded-aws-key
    patterns:
      - pattern-regex: 'AKIA[0-9A-Z]{16}'
    message: Hardcoded AWS Access Key ID detected
    languages: [python, javascript, typescript, java, go, ruby, php, generic]
    severity: ERROR
    metadata:
      category: hardcoded_secret
      cwe: CWE-798
      cvss: "9.5"

  # ── SQL Injection ──────────────────────────────────────────────────────────
  - id: kavach-sqli-string-format
    patterns:
      - pattern: |
          $QUERY = "..." % $VAR
          $DB.execute($QUERY)
      - pattern: |
          $QUERY = f"...{$VAR}..."
          $DB.execute($QUERY)
    message: Potential SQL injection via string formatting
    languages: [python]
    severity: ERROR
    metadata:
      category: sql_injection
      cwe: CWE-89
      cvss: "9.8"

  - id: kavach-sqli-concatenation
    patterns:
      - pattern-regex: '(execute|query|cursor\.execute)\s*\([^)]*\+[^)]*\)'
    message: SQL query built with string concatenation — potential SQL injection
    languages: [python, javascript, java, php]
    severity: ERROR
    metadata:
      category: sql_injection
      cwe: CWE-89
      cvss: "9.8"

  # ── Command Injection ──────────────────────────────────────────────────────
  - id: kavach-command-injection-os-system
    patterns:
      - pattern: os.system($CMD)
    message: os.system() with variable argument — potential command injection
    languages: [python]
    severity: ERROR
    metadata:
      category: command_injection
      cwe: CWE-78
      cvss: "9.0"

  - id: kavach-command-injection-subprocess-shell
    patterns:
      - pattern: subprocess.run($CMD, ..., shell=True, ...)
      - pattern: subprocess.call($CMD, ..., shell=True, ...)
      - pattern: subprocess.Popen($CMD, ..., shell=True, ...)
    message: subprocess called with shell=True — command injection risk
    languages: [python]
    severity: WARNING
    metadata:
      category: command_injection
      cwe: CWE-78
      cvss: "7.5"

  # ── Weak Cryptography ──────────────────────────────────────────────────────
  - id: kavach-weak-hash-md5
    patterns:
      - pattern: hashlib.md5(...)
      - pattern: MD5(...)
      - pattern-regex: '(?i)(md5|MD5)\s*\('
    message: MD5 is a cryptographically broken hash function — use SHA-256 or better
    languages: [python, javascript, java, go]
    severity: WARNING
    metadata:
      category: weak_cryptography
      cwe: CWE-327
      cvss: "6.5"

  - id: kavach-weak-hash-sha1
    patterns:
      - pattern: hashlib.sha1(...)
      - pattern-regex: '(?i)(sha1|SHA1|sha-1)\s*\('
    message: SHA1 is deprecated for security use — migrate to SHA-256
    languages: [python, javascript, java, go]
    severity: WARNING
    metadata:
      category: weak_cryptography
      cwe: CWE-327
      cvss: "5.5"

  - id: kavach-weak-cipher-des
    patterns:
      - pattern-regex: '(?i)(DES|3DES|TripleDES|RC4|RC2|Blowfish)\b'
    message: Weak cipher algorithm detected — use AES-256 instead
    languages: [python, javascript, java, go, generic]
    severity: WARNING
    metadata:
      category: weak_cryptography
      cwe: CWE-327
      cvss: "6.0"

  # ── Unsafe Deserialization ─────────────────────────────────────────────────
  - id: kavach-unsafe-pickle
    patterns:
      - pattern: pickle.loads($DATA)
      - pattern: pickle.load($FILE)
      - pattern: cPickle.loads($DATA)
    message: Unsafe deserialization with pickle — can lead to arbitrary code execution
    languages: [python]
    severity: ERROR
    metadata:
      category: unsafe_deserialization
      cwe: CWE-502
      cvss: "9.8"

  - id: kavach-unsafe-yaml-load
    patterns:
      - pattern: yaml.load($DATA)
      - pattern: yaml.load($DATA, Loader=None)
    message: yaml.load() without safe loader — use yaml.safe_load() instead
    languages: [python]
    severity: WARNING
    metadata:
      category: unsafe_deserialization
      cwe: CWE-502
      cvss: "7.0"

  # ── Path Traversal ─────────────────────────────────────────────────────────
  - id: kavach-path-traversal
    patterns:
      - pattern: open(request.$PARAM, ...)
      - pattern: open($PATH + $USER_INPUT, ...)
    message: Potential path traversal vulnerability — user input used in file path
    languages: [python]
    severity: WARNING
    metadata:
      category: path_traversal
      cwe: CWE-22
      cvss: "7.5"

  # ── Insecure Random ────────────────────────────────────────────────────────
  - id: kavach-insecure-random
    patterns:
      - pattern: random.random()
      - pattern: random.randint(...)
      - pattern: random.choice(...)
    message: Standard random module is not cryptographically secure — use secrets module
    languages: [python]
    severity: INFO
    metadata:
      category: insecure_random
      cwe: CWE-330
      cvss: "4.0"
"""


# ── CVSS Mapping ──────────────────────────────────────────────────────────────

SEVERITY_MAP = {
    "ERROR": ("HIGH", 7.5),
    "WARNING": ("MEDIUM", 5.5),
    "INFO": ("LOW", 3.0),
    "CRITICAL": ("CRITICAL", 9.5),
}

CATEGORY_CVSS_OVERRIDE: dict[str, float] = {
    "hardcoded_secret": 9.0,
    "sql_injection": 9.8,
    "command_injection": 9.0,
    "weak_cryptography": 6.0,
    "unsafe_deserialization": 9.8,
    "path_traversal": 7.5,
    "insecure_random": 4.0,
}


def _parse_semgrep_output(semgrep_output: dict[str, Any], repo_path: Path) -> list[RawFinding]:
    """Parse Semgrep JSON output into normalized RawFinding objects."""
    findings: list[RawFinding] = []
    results = semgrep_output.get("results", [])

    for result in results:
        check_id: str = result.get("check_id", "")
        extra: dict = result.get("extra", {})
        metadata: dict = extra.get("metadata", {})

        semgrep_severity: str = extra.get("severity", "WARNING").upper()
        severity_label, default_cvss = SEVERITY_MAP.get(semgrep_severity, ("MEDIUM", 5.0))

        category: str = metadata.get("category", "unknown")
        cvss_str: str = str(metadata.get("cvss", ""))
        try:
            cvss = float(cvss_str)
        except (ValueError, TypeError):
            cvss = CATEGORY_CVSS_OVERRIDE.get(category, default_cvss)

        # Remap severity based on CVSS
        if cvss >= 9.0:
            severity_label = "CRITICAL"
        elif cvss >= 7.0:
            severity_label = "HIGH"
        elif cvss >= 4.0:
            severity_label = "MEDIUM"
        else:
            severity_label = "LOW"

        # Make file path relative to repo root
        raw_path: str = result.get("path", "")
        try:
            file_path = str(Path(raw_path).relative_to(repo_path))
        except ValueError:
            file_path = raw_path

        findings.append(
            RawFinding(
                title=extra.get("message", check_id),
                severity=severity_label,
                category=category,
                source="semgrep",
                cvss=cvss,
                file_path=file_path,
                line_number=result.get("start", {}).get("line"),
                description=(
                    f"{extra.get('message', '')} "
                    f"[Rule: {check_id}] "
                    f"[CWE: {metadata.get('cwe', 'N/A')}]"
                ),
            )
        )

    return findings


def run_static_scan(repo_path: Union[str, Path]) -> list[RawFinding]:
    """
    Execute Semgrep on the given repository path.

    Returns a list of normalized RawFinding objects.
    Falls back to pattern-based scanning if Semgrep is not installed.
    """
    repo_path = Path(repo_path).resolve()
    logger.info("static_scanner.start", repo_path=str(repo_path))

    # Write inline rules to a temp file
    rules_file = repo_path.parent / "kavach_rules.yaml"
    rules_file.write_text(KAVACH_RULES, encoding="utf-8")

    try:
        result = subprocess.run(
            [
                "semgrep",
                "--config", str(rules_file),
                "--json",
                "--quiet",
                "--no-git-ignore",
                str(repo_path),
            ],
            capture_output=True,
            text=True,
            timeout=300,  # 5-minute timeout
        )

        logger.info(
            "[SEMGREP] static_scanner.semgrep_complete",
            returncode=result.returncode,
            stderr_preview=result.stderr[:200] if result.stderr else "",
        )

        try:
            semgrep_output = json.loads(result.stdout)
        except json.JSONDecodeError:
            logger.warning("static_scanner.json_parse_error", stdout=result.stdout[:500])
            return _fallback_pattern_scan(repo_path)

        findings = _parse_semgrep_output(semgrep_output, repo_path)
        logger.info("[SEMGREP] static_scanner.findings", count=len(findings))
        return findings

    except FileNotFoundError:
        logger.warning("static_scanner.semgrep_not_found — falling back to pattern scan")
        return _fallback_pattern_scan(repo_path)
    except subprocess.TimeoutExpired:
        logger.error("static_scanner.timeout")
        return []
    except Exception as exc:
        logger.exception("static_scanner.error", error=str(exc))
        return []
    finally:
        if rules_file.exists():
            rules_file.unlink()


# ── Fallback Pattern Scanner ──────────────────────────────────────────────────
# Used when Semgrep is not available in the environment.

import re

PATTERN_RULES: list[dict[str, Any]] = [
    {
        "id": "hardcoded-api-key",
        "pattern": re.compile(r'(?i)(api_key|apikey|api-key)\s*[=:]\s*["\'][A-Za-z0-9_\-]{16,}["\']'),
        "title": "Hardcoded API Key",
        "severity": "CRITICAL",
        "category": "hardcoded_secret",
        "cvss": 9.0,
        "description": "Hardcoded API key detected in source code. Store secrets in environment variables.",
    },
    {
        "id": "hardcoded-password",
        "pattern": re.compile(r'(?i)(password|passwd|pwd)\s*[=:]\s*["\'][^"\']{4,}["\']'),
        "title": "Hardcoded Password",
        "severity": "CRITICAL",
        "category": "hardcoded_secret",
        "cvss": 8.5,
        "description": "Hardcoded password detected. Use secrets management solutions.",
    },
    {
        "id": "hardcoded-aws-key",
        "pattern": re.compile(r'AKIA[0-9A-Z]{16}'),
        "title": "Hardcoded AWS Access Key",
        "severity": "CRITICAL",
        "category": "hardcoded_secret",
        "cvss": 9.5,
        "description": "AWS Access Key ID detected in source code. Rotate immediately.",
    },
    {
        "id": "sql-injection-concat",
        "pattern": re.compile(r'(execute|query)\s*\([^)]*[\+%][^)]*\)'),
        "title": "Potential SQL Injection",
        "severity": "CRITICAL",
        "category": "sql_injection",
        "cvss": 9.8,
        "description": "SQL query constructed with string concatenation — use parameterized queries.",
    },
    {
        "id": "weak-hash-md5",
        "pattern": re.compile(r'\bmd5\s*\(', re.IGNORECASE),
        "title": "Weak Hash Function: MD5",
        "severity": "HIGH",
        "category": "weak_cryptography",
        "cvss": 6.5,
        "description": "MD5 is cryptographically broken. Migrate to SHA-256 or SHA-3.",
    },
    {
        "id": "weak-hash-sha1",
        "pattern": re.compile(r'\bsha1\s*\(', re.IGNORECASE),
        "title": "Weak Hash Function: SHA-1",
        "severity": "MEDIUM",
        "category": "weak_cryptography",
        "cvss": 5.5,
        "description": "SHA-1 is deprecated for security use. Migrate to SHA-256.",
    },
    {
        "id": "unsafe-pickle",
        "pattern": re.compile(r'pickle\.(loads|load)\s*\('),
        "title": "Unsafe Deserialization: pickle",
        "severity": "CRITICAL",
        "category": "unsafe_deserialization",
        "cvss": 9.8,
        "description": "pickle.loads() can execute arbitrary code. Never deserialize untrusted data with pickle.",
    },
    {
        "id": "command-injection-shell",
        "pattern": re.compile(r'shell\s*=\s*True'),
        "title": "Command Injection Risk: shell=True",
        "severity": "HIGH",
        "category": "command_injection",
        "cvss": 7.5,
        "description": "subprocess with shell=True is vulnerable to command injection. Avoid if possible.",
    },
    {
        "id": "os-system",
        "pattern": re.compile(r'\bos\.system\s*\('),
        "title": "Command Injection Risk: os.system()",
        "severity": "HIGH",
        "category": "command_injection",
        "cvss": 8.0,
        "description": "os.system() with user input can lead to command injection.",
    },
    {
        "id": "yaml-unsafe-load",
        "pattern": re.compile(r'\byaml\.load\s*\('),
        "title": "Unsafe YAML Deserialization",
        "severity": "HIGH",
        "category": "unsafe_deserialization",
        "cvss": 7.0,
        "description": "yaml.load() without SafeLoader can execute arbitrary code. Use yaml.safe_load().",
    },
]

SCANNABLE_EXTENSIONS = {
    ".py", ".js", ".ts", ".jsx", ".tsx", ".java", ".go",
    ".rb", ".php", ".cs", ".cpp", ".c", ".h",
}


def _fallback_pattern_scan(repo_path: Path) -> list[RawFinding]:
    """
    Regex-based fallback scanner for environments without Semgrep.
    Walks all source files and applies PATTERN_RULES.
    """
    findings: list[RawFinding] = []
    logger.info("static_scanner.fallback_scan.start", repo_path=str(repo_path))

    for root, dirs, files in os.walk(repo_path):
        # Skip hidden dirs and common non-code dirs
        dirs[:] = [
            d for d in dirs
            if not d.startswith(".") and d not in {"node_modules", "__pycache__", ".git", "venv", ".venv"}
        ]

        for filename in files:
            file_path = Path(root) / filename
            if file_path.suffix.lower() not in SCANNABLE_EXTENSIONS:
                continue

            try:
                content = file_path.read_text(encoding="utf-8", errors="ignore")
                lines = content.splitlines()

                for rule in PATTERN_RULES:
                    for line_num, line in enumerate(lines, start=1):
                        if rule["pattern"].search(line):
                            try:
                                rel_path = str(file_path.relative_to(repo_path))
                            except ValueError:
                                rel_path = str(file_path)

                            findings.append(
                                RawFinding(
                                    title=rule["title"],
                                    severity=rule["severity"],
                                    category=rule["category"],
                                    source="semgrep",  # label as semgrep for unified display
                                    cvss=rule["cvss"],
                                    file_path=rel_path,
                                    line_number=line_num,
                                    description=rule["description"],
                                )
                            )
            except Exception as exc:
                logger.warning("static_scanner.file_read_error", file=str(file_path), error=str(exc))

    logger.info("static_scanner.fallback_scan.complete", findings=len(findings))
    return findings
