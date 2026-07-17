"""
KAVACH — Docker Image/Dockerfile Security Scanner
Dedicated, deeper Dockerfile analysis than `config_scanner.py`'s generic
text-pattern checks (which apply the same rules across .env/.yaml/.json/
Dockerfile uniformly). This worker understands Dockerfile instruction
semantics: missing USER, unpinned base images, ADD vs COPY, etc.

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

DOCKERFILE_NAMES = {"Dockerfile", "dockerfile"}
DANGEROUS_PORTS = {22, 3306, 5432, 27017, 6379, 9200, 1433}


def _analyze_dockerfile(content: str, rel_path: str) -> list[RawFinding]:
    findings: list[RawFinding] = []
    lines = content.splitlines()

    has_user_directive = False
    has_healthcheck = False
    from_lines: list[tuple[int, str]] = []

    for line_num, raw_line in enumerate(lines, start=1):
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue

        upper = line.upper()

        if upper.startswith("USER "):
            has_user_directive = True

        if upper.startswith("HEALTHCHECK"):
            has_healthcheck = True

        if upper.startswith("FROM "):
            from_lines.append((line_num, line))
            image_ref = line.split(None, 1)[1].split(" AS ")[0].split(" as ")[0].strip()
            if ":" not in image_ref or image_ref.endswith(":latest"):
                findings.append(
                    RawFinding(
                        title="Unpinned or 'latest' Base Image",
                        severity="MEDIUM",
                        category="security_misconfiguration",
                        source="docker-scanner",
                        cvss=5.0,
                        file_path=rel_path,
                        line_number=line_num,
                        description=(
                            f"Base image '{image_ref}' has no pinned version tag (or uses :latest). "
                            "Builds become non-reproducible and can silently pull a newer, "
                            "potentially vulnerable image without any code change."
                        ),
                    )
                )

        if upper.startswith("ADD ") and not re.search(r"https?://", line):
            findings.append(
                RawFinding(
                    title="ADD Used Instead of COPY",
                    severity="LOW",
                    category="security_misconfiguration",
                    source="docker-scanner",
                    cvss=3.0,
                    file_path=rel_path,
                    line_number=line_num,
                    description=(
                        "ADD auto-extracts archives and fetches remote URLs, which is surprising "
                        "and has been the source of path-traversal issues in some tools. "
                        "Use COPY unless auto-extraction is specifically required."
                    ),
                )
            )

        if upper.startswith("EXPOSE "):
            for port_str in re.findall(r"\d+", line):
                if int(port_str) in DANGEROUS_PORTS:
                    findings.append(
                        RawFinding(
                            title="Dangerous Port Exposed",
                            severity="MEDIUM",
                            category="security_misconfiguration",
                            source="docker-scanner",
                            cvss=5.5,
                            file_path=rel_path,
                            line_number=line_num,
                            description=(
                                f"Port {port_str} (commonly a database/cache/search service) is exposed. "
                                "Backing services should stay on an internal network, not be published."
                            ),
                        )
                    )

        if re.search(r"(?i)--privileged\b", line):
            findings.append(
                RawFinding(
                    title="Privileged Mode Referenced",
                    severity="HIGH",
                    category="security_misconfiguration",
                    source="docker-scanner",
                    cvss=8.0,
                    file_path=rel_path,
                    line_number=line_num,
                    description="Privileged mode gives the container full access to the host device namespace — "
                    "a container escape here compromises the entire host.",
                )
            )

        if re.search(r"curl\s+[^|]*\|\s*(sh|bash)\b", line) or re.search(r"wget\s+[^|]*\|\s*(sh|bash)\b", line):
            findings.append(
                RawFinding(
                    title="Piping Remote Script Directly to Shell",
                    severity="HIGH",
                    category="security_misconfiguration",
                    source="docker-scanner",
                    cvss=7.5,
                    file_path=rel_path,
                    line_number=line_num,
                    description=(
                        "curl/wget piped straight into a shell executes unreviewed remote code at build "
                        "time with no integrity check. Download, checksum-verify, then execute instead."
                    ),
                )
            )

        if re.search(r"(?i)^(ENV|ARG)\s+\w*(SECRET|PASSWORD|TOKEN|KEY)\w*\s*=", line):
            findings.append(
                RawFinding(
                    title="Secret-like Value in ENV/ARG",
                    severity="HIGH",
                    category="hardcoded_secret",
                    source="docker-scanner",
                    cvss=8.0,
                    file_path=rel_path,
                    line_number=line_num,
                    description=(
                        "ENV/ARG values are baked into image layers and visible via `docker history`/"
                        "`docker inspect` even after removal in a later layer. Use build secrets "
                        "(`--mount=type=secret`) or inject at runtime instead."
                    ),
                )
            )

    if from_lines and not has_user_directive:
        findings.append(
            RawFinding(
                title="Container Runs as Root (No USER Directive)",
                severity="MEDIUM",
                category="security_misconfiguration",
                source="docker-scanner",
                cvss=6.0,
                file_path=rel_path,
                line_number=from_lines[-1][0],
                description=(
                    "No USER instruction found — the container runs as root by default. "
                    "A container-escape or arbitrary-file-write vulnerability in the app is far "
                    "more dangerous when the process inside is root."
                ),
            )
        )

    if from_lines and not has_healthcheck:
        findings.append(
            RawFinding(
                title="No HEALTHCHECK Defined",
                severity="INFO",
                category="security_misconfiguration",
                source="docker-scanner",
                cvss=2.0,
                file_path=rel_path,
                line_number=from_lines[-1][0],
                description=(
                    "No HEALTHCHECK instruction — orchestrators (Docker Swarm, some Kubernetes "
                    "setups relying on it) can't detect an unhealthy-but-running container."
                ),
            )
        )

    return findings


def run_docker_scan(repo_path: Union[str, Path]) -> list[RawFinding]:
    """Find and analyze every Dockerfile in the repository."""
    repo_path = Path(repo_path).resolve()
    logger.info("docker_scanner.start", repo_path=str(repo_path))

    all_findings: list[RawFinding] = []
    for root, dirs, files in os.walk(repo_path):
        dirs[:] = [d for d in dirs if d not in {".git", "node_modules", "__pycache__", ".venv", "venv"}]
        for filename in files:
            if filename in DOCKERFILE_NAMES or filename.startswith("Dockerfile."):
                file_path = Path(root) / filename
                try:
                    content = file_path.read_text(encoding="utf-8", errors="ignore")
                except Exception as exc:
                    logger.warning("docker_scanner.file_read_error", file=str(file_path), error=str(exc))
                    continue

                try:
                    rel_path = str(file_path.relative_to(repo_path))
                except ValueError:
                    rel_path = str(file_path)

                all_findings.extend(_analyze_dockerfile(content, rel_path))

    logger.info("docker_scanner.complete", findings=len(all_findings))
    return all_findings
