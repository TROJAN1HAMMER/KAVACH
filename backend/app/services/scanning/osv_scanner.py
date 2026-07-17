"""
KAVACH — OSV.dev Vulnerability Database Scanner
Independently parses the repository's own requirements files (via
`dependency_scanner.parse_requirements_files`) and queries OSV.dev's
public API directly — deliberately not dependent on pip-audit's output,
since this is meant to run as its own independent Celery task, and
different vulnerability databases catch different CVEs (defense in depth
through tool diversity, same rationale as running semgrep + ast-grep).

Input:  repository_path (str | Path)
Output: list[RawFinding]
"""

from pathlib import Path
from typing import Any, Union

import httpx
import structlog

from app.schemas.finding import RawFinding
from app.services.scanning.dependency_scanner import parse_requirements_files

logger = structlog.get_logger(__name__)

OSV_QUERYBATCH_URL = "https://api.osv.dev/v1/querybatch"
OSV_VULN_URL = "https://api.osv.dev/v1/vulns/{vuln_id}"
BATCH_SIZE = 100


def _severity_from_osv(vuln: dict[str, Any]) -> tuple[str, float]:
    for sev in vuln.get("severity", []) or []:
        if sev.get("type") == "CVSS_V3":
            try:
                score = float(sev["score"].split("/")[0]) if "/" in sev.get("score", "") else None
            except (ValueError, KeyError):
                score = None
            if score is not None:
                if score >= 9.0:
                    return "CRITICAL", score
                if score >= 7.0:
                    return "HIGH", score
                if score >= 4.0:
                    return "MEDIUM", score
                return "LOW", score
    # No parsed CVSS — fall back to a conservative default rather than
    # dropping the finding; OSV entries without a machine-readable score
    # are still real, disclosed vulnerabilities.
    return "MEDIUM", 5.0


def run_osv_scan(repo_path: Union[str, Path], *, timeout_seconds: float = 30.0) -> list[RawFinding]:
    """
    Query OSV.dev for every (package, version) pair found in the repo's
    requirements files. Network errors degrade to an empty result set —
    this must never be the reason a whole scan job fails.
    """
    repo_path = Path(repo_path).resolve()
    logger.info("osv_scanner.start", repo_path=str(repo_path))

    packages = parse_requirements_files(repo_path)
    if not packages:
        logger.info("osv_scanner.no_packages_found")
        return []

    findings: list[RawFinding] = []

    try:
        with httpx.Client(timeout=timeout_seconds) as client:
            vuln_ids_by_package: dict[str, tuple[str, str]] = {}

            for batch_start in range(0, len(packages), BATCH_SIZE):
                batch = packages[batch_start : batch_start + BATCH_SIZE]
                queries = [
                    {"package": {"name": name, "ecosystem": "PyPI"}, "version": version}
                    for name, version in batch
                ]
                response = client.post(OSV_QUERYBATCH_URL, json={"queries": queries})
                response.raise_for_status()
                results = response.json().get("results", [])

                for (name, version), result in zip(batch, results):
                    for vuln_stub in result.get("vulns", []) or []:
                        vuln_ids_by_package[vuln_stub["id"]] = (name, version)

            for vuln_id, (package, version) in vuln_ids_by_package.items():
                try:
                    detail_response = client.get(OSV_VULN_URL.format(vuln_id=vuln_id))
                    detail_response.raise_for_status()
                    vuln = detail_response.json()
                except Exception as exc:
                    logger.warning("osv_scanner.vuln_detail_fetch_failed", vuln_id=vuln_id, error=str(exc))
                    continue

                severity_label, cvss = _severity_from_osv(vuln)
                summary = vuln.get("summary") or vuln.get("details", "No description available.")

                findings.append(
                    RawFinding(
                        title=f"OSV Vulnerability: {package} {version} [{vuln_id}]",
                        severity=severity_label,
                        category="vulnerable_dependency",
                        source="osv-scanner",
                        cvss=cvss,
                        file_path=None,
                        line_number=None,
                        description=summary[:1000],
                        package=package,
                        package_version=version,
                        cve=vuln_id,
                    )
                )

    except httpx.HTTPError as exc:
        logger.warning("osv_scanner.api_error — degrading to empty result", error=str(exc))
        return []
    except Exception as exc:
        logger.exception("osv_scanner.unexpected_error", error=str(exc))
        return []

    logger.info("osv_scanner.complete", findings=len(findings))
    return findings
