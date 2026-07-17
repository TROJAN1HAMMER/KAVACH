"""
KAVACH — AST-Grep Structural Analysis Engine
Uses the `ast-grep` CLI (pip-installable via the `ast-grep-cli` package,
providing the `sg`/`ast-grep` binary) for structural, AST-aware pattern
matching — complements semgrep with different rule semantics and
independent tooling, so the two can cross-validate each other.

Falls back to an empty result set (with a warning) if the binary isn't
installed, matching every other scanner in this package.

Input:  repository_path (str | Path)
Output: list[RawFinding]
"""

import json
import subprocess
from pathlib import Path
from typing import Any, Union

import structlog

from app.schemas.finding import RawFinding

logger = structlog.get_logger(__name__)

# ast-grep's inline YAML rule format — a small, independent rule set
# rather than reusing semgrep's KAVACH_RULES, since the two tools' pattern
# languages aren't compatible.
AST_GREP_RULES = """
id: kavach-eval-call
language: Python
rule:
  pattern: eval($X)
message: Use of eval() on potentially untrusted input can lead to arbitrary code execution
severity: error
metadata:
  category: command_injection
  cvss: "8.5"
---
id: kavach-exec-call
language: Python
rule:
  pattern: exec($X)
message: Use of exec() on potentially untrusted input can lead to arbitrary code execution
severity: error
metadata:
  category: command_injection
  cvss: "8.5"
---
id: kavach-subprocess-shell-js
language: JavaScript
rule:
  pattern: child_process.exec($X)
message: child_process.exec() invokes a shell — prefer execFile/spawn with an argument array
severity: warning
metadata:
  category: command_injection
  cvss: "7.0"
---
id: kavach-assert-disabled
language: Python
rule:
  pattern: assert $X
message: assert statements are stripped when Python runs with -O — never use them for security checks
severity: warning
metadata:
  category: security_misconfiguration
  cvss: "5.0"
"""

SEVERITY_MAP = {"error": ("HIGH", 7.5), "warning": ("MEDIUM", 5.0), "info": ("LOW", 3.0)}


def _parse_ast_grep_output(raw_results: list[dict[str, Any]], repo_path: Path) -> list[RawFinding]:
    findings: list[RawFinding] = []
    for result in raw_results:
        rule_id = result.get("ruleId", "unknown")
        message = result.get("message", rule_id)
        severity_str = str(result.get("severity", "warning")).lower()
        severity_label, default_cvss = SEVERITY_MAP.get(severity_str, ("MEDIUM", 5.0))

        metadata = result.get("metadata", {}) or {}
        category = metadata.get("category", "unknown")
        try:
            cvss = float(metadata.get("cvss", default_cvss))
        except (TypeError, ValueError):
            cvss = default_cvss

        raw_path = result.get("file", "")
        try:
            file_path = str(Path(raw_path).relative_to(repo_path))
        except ValueError:
            file_path = raw_path

        line_number = None
        range_info = result.get("range", {})
        if isinstance(range_info, dict):
            start = range_info.get("start", {})
            if isinstance(start, dict):
                line_number = start.get("line")
                if line_number is not None:
                    line_number += 1  # ast-grep uses 0-indexed lines

        findings.append(
            RawFinding(
                title=message,
                severity=severity_label,
                category=category,
                source="ast-grep",
                cvss=cvss,
                file_path=file_path,
                line_number=line_number,
                description=f"{message} [Rule: {rule_id}]",
            )
        )

    return findings


def run_ast_grep_scan(repo_path: Union[str, Path]) -> list[RawFinding]:
    """
    Execute ast-grep on the given repository path using inline rules.
    Returns an empty list (with a warning logged) if ast-grep isn't installed.
    """
    repo_path = Path(repo_path).resolve()
    logger.info("ast_grep_scanner.start", repo_path=str(repo_path))

    rules_file = repo_path.parent / f"kavach_ast_grep_rules_{repo_path.name}.yaml"
    rules_file.write_text(AST_GREP_RULES, encoding="utf-8")

    try:
        result = subprocess.run(
            ["ast-grep", "scan", "--rule", str(rules_file), "--json", str(repo_path)],
            capture_output=True,
            text=True,
            timeout=180,
        )

        if not result.stdout.strip():
            logger.info("ast_grep_scanner.no_output", stderr_preview=result.stderr[:200] if result.stderr else "")
            return []

        try:
            raw_results = json.loads(result.stdout)
        except json.JSONDecodeError:
            logger.warning("ast_grep_scanner.json_parse_error", stdout=result.stdout[:500])
            return []

        findings = _parse_ast_grep_output(raw_results, repo_path)
        logger.info("ast_grep_scanner.complete", findings=len(findings))
        return findings

    except FileNotFoundError:
        logger.warning("ast_grep_scanner.binary_not_found — install with `pip install ast-grep-cli`")
        return []
    except subprocess.TimeoutExpired:
        logger.error("ast_grep_scanner.timeout")
        return []
    except Exception as exc:
        logger.exception("ast_grep_scanner.error", error=str(exc))
        return []
    finally:
        if rules_file.exists():
            rules_file.unlink()
