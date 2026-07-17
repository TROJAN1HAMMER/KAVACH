"""
KAVACH — Secrets Detection Engine
Dedicated, gitleaks-style regex scanner for hardcoded credentials.
`static_scanner.py`'s semgrep rules already flag a couple of secret
patterns as a side effect of general SAST; this is a focused, independent
worker with a much broader pattern set, run as its own Celery task.

Input:  repository_path (str | Path)
Output: list[RawFinding]
"""

import os
import re
from pathlib import Path
from typing import Union

import structlog

from app.schemas.finding import RawFinding

logger = structlog.get_logger(__name__)


class SecretRule:
    def __init__(self, rule_id: str, title: str, severity: str, cvss: float, pattern: re.Pattern):
        self.rule_id = rule_id
        self.title = title
        self.severity = severity
        self.cvss = cvss
        self.pattern = pattern


SECRET_RULES: list[SecretRule] = [
    SecretRule("aws-access-key", "AWS Access Key ID", "CRITICAL", 9.5, re.compile(r"\bAKIA[0-9A-Z]{16}\b")),
    SecretRule(
        "aws-secret-key",
        "AWS Secret Access Key",
        "CRITICAL",
        9.5,
        re.compile(r"(?i)aws_secret_access_key\s*[=:]\s*[\"']?[A-Za-z0-9/+=]{40}[\"']?"),
    ),
    SecretRule("github-pat", "GitHub Personal Access Token", "CRITICAL", 9.0, re.compile(r"\bgh[pousr]_[A-Za-z0-9]{36,}\b")),
    SecretRule("gitlab-pat", "GitLab Personal Access Token", "CRITICAL", 9.0, re.compile(r"\bglpat-[A-Za-z0-9_\-]{20}\b")),
    SecretRule("slack-token", "Slack Token", "HIGH", 8.0, re.compile(r"\bxox[baprs]-[A-Za-z0-9\-]{10,}\b")),
    SecretRule(
        "slack-webhook",
        "Slack Webhook URL",
        "MEDIUM",
        6.0,
        re.compile(r"https://hooks\.slack\.com/services/T[A-Za-z0-9_/]{20,}"),
    ),
    SecretRule("google-api-key", "Google API Key", "HIGH", 8.0, re.compile(r"\bAIza[0-9A-Za-z\-_]{35}\b")),
    SecretRule(
        "stripe-key",
        "Stripe API Key",
        "CRITICAL",
        9.0,
        re.compile(r"\b(sk|rk|pk)_(live|test)_[A-Za-z0-9]{16,}\b"),
    ),
    SecretRule(
        "private-key-block",
        "Private Key Block",
        "CRITICAL",
        9.5,
        re.compile(r"-----BEGIN (RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----"),
    ),
    SecretRule(
        "generic-api-key",
        "Generic Hardcoded API Key",
        "HIGH",
        7.5,
        re.compile(r"(?i)(api[_-]?key|apikey|secret[_-]?key)\s*[=:]\s*[\"'][A-Za-z0-9_\-]{20,}[\"']"),
    ),
    SecretRule(
        "jwt-token",
        "Hardcoded JWT",
        "MEDIUM",
        6.5,
        re.compile(r"\bey[A-Za-z0-9_-]{10,}\.ey[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b"),
    ),
    SecretRule(
        "basic-auth-url",
        "Credentials in URL",
        "HIGH",
        7.5,
        re.compile(r"(?i)(https?|ftp|mongodb(\+srv)?|postgres(ql)?|mysql)://[^\s:/@\"']+:[^\s:/@\"']+@"),
    ),
    SecretRule(
        "npm-token",
        "NPM Auth Token",
        "HIGH",
        8.0,
        re.compile(r"(?i)//registry\.npmjs\.org/:_authToken=[A-Za-z0-9\-]{20,}"),
    ),
]

SKIP_DIRS = {".git", "__pycache__", "node_modules", ".venv", "venv", ".tox", "dist", "build"}
SKIP_FILES = {"package-lock.json", "yarn.lock", "poetry.lock", "Pipfile.lock"}
SKIP_EXTENSIONS = {".png", ".jpg", ".jpeg", ".gif", ".ico", ".woff", ".woff2", ".ttf", ".zip", ".tar", ".gz", ".pdf"}


def _scan_file(file_path: Path, repo_path: Path) -> list[RawFinding]:
    findings: list[RawFinding] = []
    try:
        content = file_path.read_text(encoding="utf-8", errors="ignore")
    except Exception as exc:
        logger.warning("secrets_scanner.file_read_error", file=str(file_path), error=str(exc))
        return []

    try:
        rel_path = str(file_path.relative_to(repo_path))
    except ValueError:
        rel_path = str(file_path)

    lines = content.splitlines()
    for rule in SECRET_RULES:
        for line_num, line in enumerate(lines, start=1):
            if rule.pattern.search(line):
                findings.append(
                    RawFinding(
                        title=rule.title,
                        severity=rule.severity,
                        category="hardcoded_secret",
                        source="secrets-scanner",
                        cvss=rule.cvss,
                        file_path=rel_path,
                        line_number=line_num,
                        description=(
                            f"Pattern match for '{rule.rule_id}' found. Hardcoded credentials in source "
                            "control are immediately compromised the moment the repository is cloned, "
                            "shared, or made public — rotate the credential and remove it from history."
                        ),
                    )
                )

    return findings


def run_secrets_scan(repo_path: Union[str, Path]) -> list[RawFinding]:
    """Walk the repository and flag hardcoded credentials matching known patterns."""
    repo_path = Path(repo_path).resolve()
    logger.info("secrets_scanner.start", repo_path=str(repo_path))

    all_findings: list[RawFinding] = []
    for root, dirs, files in os.walk(repo_path):
        # Named skip-list only -- secrets can and do leak into .github/workflows/
        # and similar dot-directories; a blanket exclusion would hide them.
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
        for filename in files:
            if filename in SKIP_FILES:
                continue
            file_path = Path(root) / filename
            if file_path.suffix.lower() in SKIP_EXTENSIONS:
                continue
            all_findings.extend(_scan_file(file_path, repo_path))

    logger.info("secrets_scanner.complete", findings=len(all_findings))
    return all_findings
