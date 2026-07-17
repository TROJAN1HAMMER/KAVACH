"""
KAVACH — NVD (National Vulnerability Database) Lookup Scanner
Independently parses the repository's requirements files and queries
NVD's public CVE API by keyword — deliberately not dependent on another
scanner's output, consistent with `osv_scanner.py`.

Honest limitation: NVD's `keywordSearch` matches against CVE descriptions,
not a precise CPE (vendor:product:version) lookup — a proper CPE
dictionary match is out of scope here. Treat these as leads worth
triaging, not confirmed hits, the way OSV/pip-audit results can be.

Rate limits (enforced here, not just documented): unauthenticated
requests are capped at 5/30s by NVD; with `NVD_API_KEY` set, 50/30s. To
keep a single scan job's runtime bounded regardless, only the first
`MAX_PACKAGES_QUERIED` packages are queried — real fleets at "1000+
concurrent scans" scale should get an NVD API key and consider mirroring
the NVD feed locally rather than hitting the live API per scan.

Input:  repository_path (str | Path)
Output: list[RawFinding]
"""

import time
from pathlib import Path
from typing import Any, Union

import httpx
import structlog

from app.config import get_settings
from app.schemas.finding import RawFinding
from app.services.scanning.dependency_scanner import parse_requirements_files

logger = structlog.get_logger(__name__)
settings = get_settings()

NVD_API_URL = "https://services.nvd.nist.gov/rest/json/cves/2.0"
MAX_PACKAGES_QUERIED = 25
REQUEST_DELAY_NO_KEY = 6.5  # seconds — keeps us under 5 req/30s with margin
REQUEST_DELAY_WITH_KEY = 0.7  # seconds — keeps us under 50 req/30s with margin
MAX_RETRIES = 3


def _severity_from_nvd(cve: dict[str, Any]) -> tuple[str, float]:
    metrics = cve.get("metrics", {})
    for key in ("cvssMetricV31", "cvssMetricV30", "cvssMetricV2"):
        entries = metrics.get(key)
        if entries:
            cvss_data = entries[0].get("cvssData", {})
            score = cvss_data.get("baseScore")
            if score is not None:
                if score >= 9.0:
                    return "CRITICAL", score
                if score >= 7.0:
                    return "HIGH", score
                if score >= 4.0:
                    return "MEDIUM", score
                return "LOW", score
    return "MEDIUM", 5.0


def _query_nvd_with_retry(client: httpx.Client, package_name: str) -> list[dict]:
    headers = {"apiKey": settings.nvd_api_key} if settings.nvd_api_key else {}

    for attempt in range(1, MAX_RETRIES + 1):
        try:
            response = client.get(
                NVD_API_URL,
                params={"keywordSearch": package_name, "resultsPerPage": 5},
                headers=headers,
            )
            if response.status_code == 429:
                backoff = (2**attempt) + 1
                logger.warning("nvd_scanner.rate_limited", package=package_name, retry_in=backoff)
                time.sleep(backoff)
                continue
            response.raise_for_status()
            return response.json().get("vulnerabilities", [])
        except httpx.HTTPError as exc:
            logger.warning("nvd_scanner.request_failed", package=package_name, attempt=attempt, error=str(exc))
            time.sleep(2**attempt)

    return []


def run_nvd_scan(repo_path: Union[str, Path]) -> list[RawFinding]:
    """Look up each dependency by keyword against the NVD CVE database."""
    repo_path = Path(repo_path).resolve()
    logger.info("nvd_scanner.start", repo_path=str(repo_path))

    packages = parse_requirements_files(repo_path)
    if not packages:
        logger.info("nvd_scanner.no_packages_found")
        return []

    if len(packages) > MAX_PACKAGES_QUERIED:
        logger.warning(
            "nvd_scanner.truncating_package_list",
            total=len(packages),
            querying=MAX_PACKAGES_QUERIED,
        )
        packages = packages[:MAX_PACKAGES_QUERIED]

    delay = REQUEST_DELAY_WITH_KEY if settings.nvd_api_key else REQUEST_DELAY_NO_KEY
    findings: list[RawFinding] = []
    seen_cve_ids: set[str] = set()

    try:
        with httpx.Client(timeout=30.0) as client:
            for i, (name, version) in enumerate(packages):
                if i > 0:
                    time.sleep(delay)

                vulnerabilities = _query_nvd_with_retry(client, name)
                for entry in vulnerabilities:
                    cve = entry.get("cve", {})
                    cve_id = cve.get("id")
                    if not cve_id or cve_id in seen_cve_ids:
                        continue
                    seen_cve_ids.add(cve_id)

                    severity_label, cvss = _severity_from_nvd(cve)
                    descriptions = cve.get("descriptions", [])
                    summary = next(
                        (d["value"] for d in descriptions if d.get("lang") == "en"),
                        "No description available.",
                    )

                    findings.append(
                        RawFinding(
                            title=f"NVD Keyword Match: {name} — {cve_id}",
                            severity=severity_label,
                            category="vulnerable_dependency",
                            source="nvd-scanner",
                            cvss=cvss,
                            file_path=None,
                            line_number=None,
                            description=(
                                f"{summary[:800]} "
                                "(Matched by keyword search against CVE descriptions — verify this "
                                f"actually applies to {name} {version} before treating as confirmed.)"
                            ),
                            package=name,
                            package_version=version,
                            cve=cve_id,
                        )
                    )

    except Exception as exc:
        logger.exception("nvd_scanner.unexpected_error", error=str(exc))
        return findings

    logger.info("nvd_scanner.complete", findings=len(findings))
    return findings
