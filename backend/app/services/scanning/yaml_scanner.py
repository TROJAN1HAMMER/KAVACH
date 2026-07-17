"""
KAVACH — YAML Structural Security Scanner
Parses YAML into actual data structures and inspects fields with known
security meaning — Kubernetes pod specs, docker-compose services, GitHub
Actions workflows — rather than `config_scanner.py`'s format-agnostic text
patterns. Complementary, not a replacement: this catches issues that only
exist as a structural relationship (e.g. `securityContext.privileged`
nested under a specific container), which no single regex can express
reliably across arbitrary YAML shapes.

Input:  repository_path (str | Path)
Output: list[RawFinding]
"""

import os
from pathlib import Path
from typing import Any, Union

import structlog

try:
    import yaml

    YAML_AVAILABLE = True
except ImportError:
    YAML_AVAILABLE = False

from app.schemas.finding import RawFinding

logger = structlog.get_logger(__name__)

SKIP_DIRS = {".git", "node_modules", "__pycache__", ".venv", "venv"}


def _iter_containers(doc: dict) -> tuple[list[dict], dict]:
    """Best-effort extraction of (container specs, pod spec) from a Kubernetes-shaped document."""
    containers: list[dict] = []
    spec = doc.get("spec", {})
    if not isinstance(spec, dict):
        return containers, {}

    # Deployment/StatefulSet/DaemonSet/Job wrap the pod spec one level deeper.
    pod_spec = spec.get("template", {}).get("spec", {}) if isinstance(spec.get("template"), dict) else spec
    if not isinstance(pod_spec, dict):
        pod_spec = spec

    for key in ("containers", "initContainers"):
        value = pod_spec.get(key)
        if isinstance(value, list):
            containers.extend(c for c in value if isinstance(c, dict))

    return containers, pod_spec if isinstance(pod_spec, dict) else {}


def _scan_kubernetes_doc(doc: dict, rel_path: str, doc_index: int) -> list[RawFinding]:
    findings: list[RawFinding] = []
    kind = doc.get("kind")
    if not kind:
        return findings

    containers, pod_spec = _iter_containers(doc)

    if isinstance(pod_spec, dict):
        if pod_spec.get("hostNetwork") is True:
            findings.append(
                RawFinding(
                    title="Kubernetes Pod Uses hostNetwork",
                    severity="HIGH",
                    category="security_misconfiguration",
                    source="yaml-scanner",
                    cvss=7.5,
                    file_path=rel_path,
                    description=f"[doc #{doc_index}, kind={kind}] hostNetwork: true removes network "
                    "isolation between the pod and the underlying node.",
                )
            )
        if pod_spec.get("hostPID") is True:
            findings.append(
                RawFinding(
                    title="Kubernetes Pod Uses hostPID",
                    severity="HIGH",
                    category="security_misconfiguration",
                    source="yaml-scanner",
                    cvss=7.5,
                    file_path=rel_path,
                    description=f"[doc #{doc_index}, kind={kind}] hostPID: true lets the pod see and "
                    "signal every process on the host, including other containers'.",
                )
            )

    for container in containers:
        name = container.get("name", "unknown")
        security_context = container.get("securityContext", {}) or {}

        if security_context.get("privileged") is True:
            findings.append(
                RawFinding(
                    title="Privileged Container",
                    severity="CRITICAL",
                    category="security_misconfiguration",
                    source="yaml-scanner",
                    cvss=9.0,
                    file_path=rel_path,
                    description=f"[doc #{doc_index}, kind={kind}] Container '{name}' runs privileged: true "
                    "— equivalent to root access on the host.",
                )
            )
        if security_context.get("allowPrivilegeEscalation") is not False:
            findings.append(
                RawFinding(
                    title="allowPrivilegeEscalation Not Disabled",
                    severity="MEDIUM",
                    category="security_misconfiguration",
                    source="yaml-scanner",
                    cvss=5.0,
                    file_path=rel_path,
                    description=f"[doc #{doc_index}, kind={kind}] Container '{name}' doesn't set "
                    "allowPrivilegeEscalation: false, the safe default a hardened cluster should enforce.",
                )
            )
        if not container.get("resources", {}).get("limits"):
            findings.append(
                RawFinding(
                    title="No Resource Limits Defined",
                    severity="LOW",
                    category="security_misconfiguration",
                    source="yaml-scanner",
                    cvss=3.5,
                    file_path=rel_path,
                    description=f"[doc #{doc_index}, kind={kind}] Container '{name}' has no CPU/memory "
                    "limits — a single compromised or runaway container can starve the node.",
                )
            )
        for env in container.get("env", []) or []:
            if isinstance(env, dict) and "value" in env:
                env_name = str(env.get("name", "")).upper()
                if any(k in env_name for k in ("SECRET", "PASSWORD", "TOKEN", "KEY")):
                    findings.append(
                        RawFinding(
                            title="Secret-like Value in Plain env",
                            severity="HIGH",
                            category="hardcoded_secret",
                            source="yaml-scanner",
                            cvss=8.0,
                            file_path=rel_path,
                            description=f"[doc #{doc_index}, kind={kind}] Container '{name}' sets "
                            f"'{env.get('name')}' as a plain string — use a Secret + secretKeyRef instead.",
                        )
                    )

    if kind == "ClusterRole" or kind == "Role":
        for rule in doc.get("rules", []) or []:
            if not isinstance(rule, dict):
                continue
            if "*" in (rule.get("resources") or []) and "*" in (rule.get("verbs") or []):
                findings.append(
                    RawFinding(
                        title="Wildcard RBAC Rule",
                        severity="CRITICAL",
                        category="security_misconfiguration",
                        source="yaml-scanner",
                        cvss=9.0,
                        file_path=rel_path,
                        description=f"[doc #{doc_index}, kind={kind}] A rule grants verbs:['*'] on "
                        "resources:['*'] — full cluster-admin-equivalent access.",
                    )
                )

    return findings


def _scan_compose_doc(doc: dict, rel_path: str) -> list[RawFinding]:
    findings: list[RawFinding] = []
    services = doc.get("services", {})
    if not isinstance(services, dict):
        return findings

    for service_name, service in services.items():
        if not isinstance(service, dict):
            continue
        if service.get("privileged") is True:
            findings.append(
                RawFinding(
                    title="Privileged Compose Service",
                    severity="CRITICAL",
                    category="security_misconfiguration",
                    source="yaml-scanner",
                    cvss=9.0,
                    file_path=rel_path,
                    description=f"Service '{service_name}' runs privileged: true.",
                )
            )
        env = service.get("environment", {})
        env_items = env.items() if isinstance(env, dict) else [
            (str(e).split("=", 1)[0], str(e).split("=", 1)[1] if "=" in str(e) else "") for e in (env or [])
        ]
        for key, value in env_items:
            if any(k in str(key).upper() for k in ("SECRET", "PASSWORD", "TOKEN", "KEY")) and value:
                findings.append(
                    RawFinding(
                        title="Secret-like Value in Compose environment",
                        severity="HIGH",
                        category="hardcoded_secret",
                        source="yaml-scanner",
                        cvss=8.0,
                        file_path=rel_path,
                        description=f"Service '{service_name}' sets '{key}' directly — use an env_file "
                        "or secrets: block excluded from version control instead.",
                    )
                )

    return findings


def _scan_github_actions_doc(doc: dict, rel_path: str) -> list[RawFinding]:
    findings: list[RawFinding] = []
    if "jobs" not in doc:
        return findings

    on_trigger = doc.get(True, doc.get("on"))  # PyYAML parses bare `on:` as boolean True key in YAML 1.1
    triggers = on_trigger if isinstance(on_trigger, (dict, list)) else {}
    trigger_names = triggers if isinstance(triggers, list) else list(triggers.keys()) if isinstance(triggers, dict) else []

    if "pull_request_target" in trigger_names:
        findings.append(
            RawFinding(
                title="pull_request_target Trigger Used",
                severity="HIGH",
                category="security_misconfiguration",
                source="yaml-scanner",
                cvss=8.0,
                file_path=rel_path,
                description=(
                    "pull_request_target runs with write access to secrets and the base repo's token "
                    "even for forked PRs. If the workflow checks out and runs the PR's own code, "
                    "this is a well-known path to secret exfiltration/RCE."
                ),
            )
        )

    jobs = doc.get("jobs", {})
    if isinstance(jobs, dict):
        for job_name, job in jobs.items():
            if not isinstance(job, dict):
                continue
            for step in job.get("steps", []) or []:
                if not isinstance(step, dict):
                    continue
                run = step.get("run", "")
                if isinstance(run, str) and "${{ github.event." in run:
                    findings.append(
                        RawFinding(
                            title="Untrusted Input Interpolated into run: Script",
                            severity="CRITICAL",
                            category="command_injection",
                            source="yaml-scanner",
                            cvss=9.0,
                            file_path=rel_path,
                            description=(
                                f"[job '{job_name}'] `${{{{ github.event... }}}}` expressions are "
                                "interpolated directly into a shell script before execution — attacker-"
                                "controlled PR titles/branch names/commit messages become shell code. "
                                "Pass them through `env:` and reference the env var instead."
                            ),
                        )
                    )

    return findings


def _classify_and_scan(doc: dict, rel_path: str, doc_index: int) -> list[RawFinding]:
    if not isinstance(doc, dict):
        return []
    if "kind" in doc and "apiVersion" in doc:
        return _scan_kubernetes_doc(doc, rel_path, doc_index)
    if "services" in doc and isinstance(doc.get("services"), dict):
        return _scan_compose_doc(doc, rel_path)
    if "jobs" in doc:
        return _scan_github_actions_doc(doc, rel_path)
    return []


def run_yaml_scan(repo_path: Union[str, Path]) -> list[RawFinding]:
    """Structurally parse and analyze Kubernetes/compose/GitHub Actions YAML files."""
    repo_path = Path(repo_path).resolve()
    logger.info("yaml_scanner.start", repo_path=str(repo_path))

    if not YAML_AVAILABLE:
        logger.warning("yaml_scanner.pyyaml_not_available")
        return []

    all_findings: list[RawFinding] = []
    for root, dirs, files in os.walk(repo_path):
        # Named skip-list only -- NOT a blanket dot-dir exclusion. This file's own
        # _scan_github_actions_doc() specifically needs .github/workflows/*.yml,
        # which a blanket "skip anything starting with '.'" would make unreachable.
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
        for filename in files:
            if not (filename.endswith(".yaml") or filename.endswith(".yml")):
                continue
            file_path = Path(root) / filename
            try:
                content = file_path.read_text(encoding="utf-8", errors="ignore")
                docs = list(yaml.safe_load_all(content))
            except Exception as exc:
                logger.warning("yaml_scanner.parse_error", file=str(file_path), error=str(exc))
                continue

            try:
                rel_path = str(file_path.relative_to(repo_path))
            except ValueError:
                rel_path = str(file_path)

            for i, doc in enumerate(docs):
                if doc is None:
                    continue
                try:
                    all_findings.extend(_classify_and_scan(doc, rel_path, i))
                except Exception as exc:
                    logger.warning("yaml_scanner.doc_scan_error", file=rel_path, error=str(exc))

    logger.info("yaml_scanner.complete", findings=len(all_findings))
    return all_findings
