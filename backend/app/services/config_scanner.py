"""
KAVACH — Configuration Scanner
Detects insecure configurations in .env, YAML, JSON, and Dockerfiles.

Checks for:
  - DEBUG=True / development mode flags
  - Hardcoded passwords and secrets in configs
  - SSL disabled
  - Exposed dangerous ports
  - Public cloud storage settings (AWS S3 public-read)
  - Default/weak credentials
  - Missing TLS/HTTPS enforcement
  - Permissive CORS settings (allow all origins)

Input:  repository_path (str | Path)
Output: list[RawFinding]
"""

import json
import os
import re
from pathlib import Path
from typing import Any
import structlog

try:
    import yaml
    YAML_AVAILABLE = True
except ImportError:
    YAML_AVAILABLE = False

from app.schemas.finding import RawFinding

logger = structlog.get_logger(__name__)


# ── Config Rule Definitions ───────────────────────────────────────────────────

class ConfigRule:
    def __init__(
        self,
        rule_id: str,
        title: str,
        severity: str,
        cvss: float,
        category: str,
        description: str,
        check_fn,  # callable(content: str, parsed: Any) -> bool
    ):
        self.rule_id = rule_id
        self.title = title
        self.severity = severity
        self.cvss = cvss
        self.category = category
        self.description = description
        self.check_fn = check_fn


# ── Rule Implementations ──────────────────────────────────────────────────────

def _check_debug_true(content: str, parsed: Any) -> bool:
    return bool(re.search(r'(?i)\bDEBUG\s*[=:]\s*(true|1|yes)\b', content))

def _check_password_admin(content: str, parsed: Any) -> bool:
    return bool(re.search(r'(?i)(password|passwd|pwd)\s*[=:]\s*["\']?(admin|password|123456|test|changeme|secret)["\']?', content))

def _check_ssl_false(content: str, parsed: Any) -> bool:
    return bool(re.search(r'(?i)ssl\s*[=:]\s*(false|0|no|disabled)', content))

def _check_tls_false(content: str, parsed: Any) -> bool:
    return bool(re.search(r'(?i)(tls|https|verify_ssl|verify_certs)\s*[=:]\s*(false|0|no|disabled)', content))

def _check_exposed_ports(content: str, parsed: Any) -> bool:
    # Dockerfile EXPOSE with dangerous ports (22, 3306, 5432, 27017, 6379, 9200)
    dangerous_ports = {22, 3306, 5432, 27017, 6379, 9200, 1433, 8080, 8443}
    matches = re.findall(r'(?i)EXPOSE\s+(\d+)', content)
    for port_str in matches:
        if int(port_str) in dangerous_ports:
            return True
    return False

def _check_hardcoded_aws_secret(content: str, parsed: Any) -> bool:
    return bool(re.search(r'(?i)(aws_secret_access_key|aws_access_key_id)\s*[=:]\s*[A-Za-z0-9+/]{20,}', content))

def _check_s3_public(content: str, parsed: Any) -> bool:
    return bool(re.search(r'(?i)(public-read|public-read-write|authenticated-read)', content))

def _check_allow_all_origins(content: str, parsed: Any) -> bool:
    return bool(re.search(r'(?i)(allow_?origins?\s*[=:]\s*["\']?\*["\']?|Access-Control-Allow-Origin:\s*\*)', content))

def _check_default_secret_key(content: str, parsed: Any) -> bool:
    return bool(re.search(
        r'(?i)(secret_?key|SECRET_KEY)\s*[=:]\s*["\']?(django-insecure|changeme|your-secret-key|mysecretkey|secret|development)["\']?',
        content
    ))

def _check_hardcoded_db_password(content: str, parsed: Any) -> bool:
    return bool(re.search(
        r'(?i)(DB_PASSWORD|DATABASE_PASSWORD|POSTGRES_PASSWORD|MYSQL_ROOT_PASSWORD)\s*[=:]\s*["\']?[^\s"\']{4,}["\']?',
        content
    ))

def _check_http_not_https(content: str, parsed: Any) -> bool:
    # Flags URLs that use plain http:// in config (not localhost)
    matches = re.findall(r'http://(?!localhost|127\.0\.0\.1|0\.0\.0\.0)[A-Za-z0-9\.\-]+', content)
    return len(matches) > 0

def _check_no_auth_docker(content: str, parsed: Any) -> bool:
    # Docker allows privileged mode
    return bool(re.search(r'(?i)--privileged|privileged\s*:\s*true', content))


CONFIG_RULES: list[ConfigRule] = [
    ConfigRule(
        "cfg-debug-true",
        "DEBUG Mode Enabled",
        "HIGH", 7.0, "security_misconfiguration",
        "DEBUG=true exposes stack traces, internal paths, and sensitive data to attackers. "
        "Never enable debug mode in production banking systems.",
        _check_debug_true,
    ),
    ConfigRule(
        "cfg-weak-password",
        "Weak/Default Password in Configuration",
        "CRITICAL", 9.0, "hardcoded_secret",
        "Default or weak password detected in configuration file. "
        "Banking systems must enforce strong credential policies.",
        _check_password_admin,
    ),
    ConfigRule(
        "cfg-ssl-disabled",
        "SSL/TLS Disabled",
        "HIGH", 7.5, "security_misconfiguration",
        "SSL is explicitly disabled in configuration. "
        "All banking communications must be encrypted in transit per RBI and PCI-DSS requirements.",
        _check_ssl_false,
    ),
    ConfigRule(
        "cfg-tls-verify-off",
        "TLS Certificate Verification Disabled",
        "HIGH", 7.5, "security_misconfiguration",
        "TLS certificate verification is disabled. This makes the system vulnerable to MITM attacks.",
        _check_tls_false,
    ),
    ConfigRule(
        "cfg-exposed-db-port",
        "Dangerous Port Exposed in Dockerfile",
        "MEDIUM", 5.5, "security_misconfiguration",
        "A sensitive service port (database, cache, search engine) is exposed in the Dockerfile. "
        "Database ports should never be exposed to the public internet.",
        _check_exposed_ports,
    ),
    ConfigRule(
        "cfg-aws-secret",
        "Hardcoded AWS Credentials",
        "CRITICAL", 9.5, "hardcoded_secret",
        "AWS access key or secret key found in configuration. "
        "Rotate immediately and use IAM roles instead.",
        _check_hardcoded_aws_secret,
    ),
    ConfigRule(
        "cfg-s3-public-acl",
        "Public S3 Bucket ACL",
        "HIGH", 8.0, "security_misconfiguration",
        "S3 bucket configured with public-read ACL. "
        "Customer financial data must never be stored in publicly accessible buckets.",
        _check_s3_public,
    ),
    ConfigRule(
        "cfg-cors-wildcard",
        "Permissive CORS Policy (Allow All Origins)",
        "MEDIUM", 6.0, "security_misconfiguration",
        "CORS configured to allow all origins (*). "
        "Banking APIs should restrict origins to known trusted domains.",
        _check_allow_all_origins,
    ),
    ConfigRule(
        "cfg-default-secret-key",
        "Default/Insecure Secret Key",
        "CRITICAL", 8.5, "hardcoded_secret",
        "Framework secret key is set to a default or placeholder value. "
        "This key is used for session signing and must be cryptographically random.",
        _check_default_secret_key,
    ),
    ConfigRule(
        "cfg-hardcoded-db-password",
        "Hardcoded Database Password",
        "CRITICAL", 9.0, "hardcoded_secret",
        "Database password found in plain text in configuration file. "
        "Use secrets management (Vault, AWS Secrets Manager) for database credentials.",
        _check_hardcoded_db_password,
    ),
    ConfigRule(
        "cfg-http-not-https",
        "Plain HTTP URL in Configuration",
        "MEDIUM", 5.0, "security_misconfiguration",
        "Non-localhost HTTP URL detected in configuration. "
        "All service communication must use HTTPS in banking environments.",
        _check_http_not_https,
    ),
    ConfigRule(
        "cfg-docker-privileged",
        "Docker Container Running in Privileged Mode",
        "HIGH", 8.0, "security_misconfiguration",
        "Container is configured to run in privileged mode, giving it full host access. "
        "This violates container isolation principles.",
        _check_no_auth_docker,
    ),
]


# ── File Type Handlers ────────────────────────────────────────────────────────

CONFIG_FILE_PATTERNS = {
    "env": [".env", ".env.local", ".env.production", ".env.staging", ".env.development"],
    "yaml": [".yaml", ".yml"],
    "json": [".json"],
    "dockerfile": ["Dockerfile", "dockerfile", "Dockerfile.prod", "Dockerfile.dev"],
    "ini": [".ini", ".cfg", ".conf"],
    "toml": [".toml"],
}

SKIP_DIRS = {".git", "__pycache__", "node_modules", ".venv", "venv", ".tox", "dist", "build"}
SKIP_FILES = {"package-lock.json", "yarn.lock", "poetry.lock", "Pipfile.lock"}


def _classify_file(file_path: Path) -> str | None:
    """Return the config file type or None if not a config file."""
    name = file_path.name
    suffix = file_path.suffix.lower()

    for file_type, patterns in CONFIG_FILE_PATTERNS.items():
        for pattern in patterns:
            if name == pattern or suffix == pattern:
                return file_type
    return None


def _scan_file(file_path: Path, repo_path: Path) -> list[RawFinding]:
    """Apply all config rules to a single file."""
    findings: list[RawFinding] = []

    try:
        content = file_path.read_text(encoding="utf-8", errors="ignore")
    except Exception as exc:
        logger.warning("config_scanner.file_read_error", file=str(file_path), error=str(exc))
        return []

    # Try to parse structured formats
    parsed: Any = None
    file_type = _classify_file(file_path)

    if file_type == "yaml" and YAML_AVAILABLE:
        try:
            parsed = yaml.safe_load(content)
        except Exception:
            parsed = None
    elif file_type == "json":
        try:
            parsed = json.loads(content)
        except Exception:
            parsed = None

    try:
        rel_path = str(file_path.relative_to(repo_path))
    except ValueError:
        rel_path = str(file_path)

    for rule in CONFIG_RULES:
        try:
            if rule.check_fn(content, parsed):
                findings.append(
                    RawFinding(
                        title=rule.title,
                        severity=rule.severity,
                        category=rule.category,
                        source="config-scanner",
                        cvss=rule.cvss,
                        file_path=rel_path,
                        line_number=None,
                        description=rule.description,
                    )
                )
        except Exception as exc:
            logger.warning(
                "config_scanner.rule_error",
                rule=rule.rule_id,
                file=rel_path,
                error=str(exc),
            )

    return findings


# ── Main Entry Point ──────────────────────────────────────────────────────────

def run_config_scan(repo_path: str | Path) -> list[RawFinding]:
    """
    Scan all configuration files in the repository for security misconfigurations.

    Returns a list of normalized RawFinding objects.
    """
    repo_path = Path(repo_path).resolve()
    logger.info("config_scanner.start", repo_path=str(repo_path))

    all_findings: list[RawFinding] = []

    for root, dirs, files in os.walk(repo_path):
        # Skip irrelevant directories
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS and not d.startswith(".")]

        for filename in files:
            if filename in SKIP_FILES:
                continue

            file_path = Path(root) / filename
            if _classify_file(file_path) is not None:
                file_findings = _scan_file(file_path, repo_path)
                all_findings.extend(file_findings)

    logger.info("config_scanner.complete", findings=len(all_findings))
    return all_findings
