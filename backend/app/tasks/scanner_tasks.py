"""
KAVACH — Independent Scanner Celery Tasks
Each scanner (semgrep, ast-grep, joern, pip-audit, OSV, NVD, secrets,
Docker, YAML) is its own Celery task, dispatched together as a `group`
and fanned back in via a `chord` callback (`app/tasks/aggregator_tasks.py`).
That chord *is* "workers publish results back to Redis, aggregator waits
for all of them" — Celery's chord mechanism tracks group completion in
the Redis result backend natively; there's no hand-rolled polling loop.

Design decision that shapes every task below: a scanner task **never lets
an exception reach Celery**. It catches everything, retries transient
failures internally with backoff, and on exhaustion returns a result dict
with `success: False` instead of raising. This guarantees the chord
callback always fires — one broken/missing tool (Joern not installed,
NVD rate-limiting, a semgrep crash) degrades that one scanner's
contribution, never blocks the whole scan. A real Celery-level failure
(the task never returns at all) is still handled — that's what
`task_acks_late` + `task_reject_on_worker_lost` (redelivery to another
worker) and the stalled-job sweeper (heartbeat-based, for a worker that's
gone entirely) are for.

Filesystem note: every scanner task reads the same `repo_dir` prepared
once by `scan_tasks.py`'s prepare step. This only works because
docker-compose bind-mounts the same `./uploads` host directory into every
worker service — if you ever run workers across hosts without a shared
volume (NFS, S3-backed fuse mount, etc.), this breaks silently. That's an
infrastructure requirement, not an implementation detail to paper over.
"""

import time
from pathlib import Path
from typing import Callable, Optional

import structlog
from celery.exceptions import SoftTimeLimitExceeded

from app.core import metrics
from app.orchestrator import scan_status
from app.schemas.finding import RawFinding
from app.services.scanning.ast_grep_scanner import run_ast_grep_scan
from app.services.scanning.dependency_scanner import run_dependency_scan
from app.services.scanning.docker_scanner import run_docker_scan
from app.services.scanning.joern_scanner import run_joern_scan
from app.services.scanning.nvd_scanner import run_nvd_scan
from app.services.scanning.osv_scanner import run_osv_scan
from app.services.scanning.secrets_scanner import run_secrets_scan
from app.services.scanning.static_scanner import run_static_scan
from app.services.scanning.yaml_scanner import run_yaml_scan
from app.workers.celery_app import celery_app

logger = structlog.get_logger(__name__)

MAX_ATTEMPTS = 3


def _make_scanner_task(name: str, scanner_fn: Callable[[Path], list[RawFinding]]):
    """
    Factory for the 8 scanners that share an identical shape: take a
    repo_dir, return a list[RawFinding]. pip-audit is the one exception
    (needs reports_dir/scan_job_id and also returns an SBOM) and is
    defined by hand below instead of through this factory.
    """

    @celery_app.task(name=f"kavach.scan.{name}", bind=True)
    def _task(self, scan_job_id: str, repo_dir: str) -> dict:
        scan_status.register_task_id(scan_job_id, self.request.id)

        if scan_status.is_cancelled(scan_job_id):
            scan_status.set_status(scan_job_id, name, "cancelled", task_id=self.request.id)
            return {"scanner": name, "success": False, "cancelled": True, "findings": []}

        scan_status.set_status(scan_job_id, name, "running", task_id=self.request.id)

        last_error: Optional[str] = None
        # Timed across every retry attempt, not just the last one — a
        # scanner that failed twice before succeeding really did cost
        # that much wall-clock time, and the metric should reflect that.
        with metrics.ScannerTimer() as timer:
            for attempt in range(1, MAX_ATTEMPTS + 1):
                try:
                    findings = scanner_fn(Path(repo_dir))
                    scan_status.set_status(
                        scan_job_id, name, "completed", task_id=self.request.id, findings_count=len(findings)
                    )
                    metrics.record_scanner_result(name, duration_seconds=timer.elapsed, success=True)
                    return {"scanner": name, "success": True, "findings": [f.model_dump() for f in findings]}

                except SoftTimeLimitExceeded:
                    last_error = f"{name} scanner timed out"
                    logger.error("scanner_task.timed_out", scanner=name, scan_job_id=scan_job_id)
                    break  # a timeout will just recur — retrying wastes the rest of the time budget

                except Exception as exc:
                    last_error = str(exc)
                    logger.warning(
                        "scanner_task.attempt_failed",
                        scanner=name,
                        scan_job_id=scan_job_id,
                        attempt=attempt,
                        error=last_error,
                    )
                    if attempt < MAX_ATTEMPTS:
                        time.sleep(2**attempt)

        scan_status.set_status(scan_job_id, name, "failed", task_id=self.request.id, error=last_error)
        metrics.record_scanner_result(name, duration_seconds=timer.elapsed, success=False)
        return {"scanner": name, "success": False, "error": last_error, "findings": []}

    return _task


run_semgrep_task = _make_scanner_task("semgrep", run_static_scan)
run_ast_grep_task = _make_scanner_task("ast-grep", run_ast_grep_scan)
run_joern_task = _make_scanner_task("joern", run_joern_scan)
run_osv_task = _make_scanner_task("osv", run_osv_scan)
run_nvd_task = _make_scanner_task("nvd", run_nvd_scan)
run_secrets_task = _make_scanner_task("secrets", run_secrets_scan)
run_docker_task = _make_scanner_task("docker", run_docker_scan)
run_yaml_task = _make_scanner_task("yaml", run_yaml_scan)


@celery_app.task(name="kavach.scan.pip-audit", bind=True)
def run_pip_audit_task(
    self, scan_job_id: str, repo_dir: str, reports_dir: str, is_premade: bool, repo_name: str
) -> dict:
    """
    pip-audit's signature differs from the other 8: it also generates and
    writes the CycloneDX SBOM (needed later by the attack surface exposure module and
    the SBOM report), and the sandbox "premade" demo repos use a
    deterministic mock vulnerability set instead of a real pip-audit run
    (see dependency_scanner.py's `_get_mock_vulnerabilities`) — logic that
    used to live inline in the old monolithic orchestrator, moved here
    since this is now the only task that owns dependency scanning.
    """
    scan_status.register_task_id(scan_job_id, self.request.id)

    if scan_status.is_cancelled(scan_job_id):
        scan_status.set_status(scan_job_id, "pip-audit", "cancelled", task_id=self.request.id)
        return {"scanner": "pip-audit", "success": False, "cancelled": True, "findings": [], "sbom": None}

    scan_status.set_status(scan_job_id, "pip-audit", "running", task_id=self.request.id)
    repo_path = Path(repo_dir)

    last_error: Optional[str] = None
    with metrics.ScannerTimer() as timer:
        for attempt in range(1, MAX_ATTEMPTS + 1):
            try:
                if is_premade:
                    import json

                    from app.services.scanning.dependency_scanner import (
                        _generate_minimal_sbom,
                        _get_mock_vulnerabilities,
                        _parse_pip_audit_results,
                    )

                    req_files = list(repo_path.glob("requirements.txt"))
                    all_raw = []
                    if req_files:
                        for req_file in req_files:
                            all_raw.extend(_get_mock_vulnerabilities(req_file))
                        if repo_name == "premade_medium_risk":
                            for dep in all_raw:
                                for vuln in dep.get("vulns", []):
                                    vuln["description"] += " Information disclosure and password leak."
                        findings = _parse_pip_audit_results(all_raw)
                        sbom = _generate_minimal_sbom(req_files[0])
                    else:
                        findings = []
                        sbom = {
                            "bomFormat": "CycloneDX",
                            "specVersion": "1.4",
                            "version": 1,
                            "components": [],
                            "metadata": {"component": {"name": "no-requirements-found"}},
                        }
                    sbom_output_path = Path(reports_dir) / f"{scan_job_id}_sbom.json"
                    sbom_output_path.parent.mkdir(parents=True, exist_ok=True)
                    sbom_output_path.write_text(json.dumps(sbom, indent=2), encoding="utf-8")
                else:
                    findings, sbom = run_dependency_scan(repo_path, reports_dir, scan_job_id)

                scan_status.set_status(
                    scan_job_id, "pip-audit", "completed", task_id=self.request.id, findings_count=len(findings)
                )
                metrics.record_scanner_result("pip-audit", duration_seconds=timer.elapsed, success=True)
                return {
                    "scanner": "pip-audit",
                    "success": True,
                    "findings": [f.model_dump() for f in findings],
                    "sbom": sbom,
                }

            except SoftTimeLimitExceeded:
                last_error = "pip-audit scanner timed out"
                logger.error("scanner_task.timed_out", scanner="pip-audit", scan_job_id=scan_job_id)
                break

            except Exception as exc:
                last_error = str(exc)
                logger.warning(
                    "scanner_task.attempt_failed",
                    scanner="pip-audit",
                    scan_job_id=scan_job_id,
                    attempt=attempt,
                    error=last_error,
                )
                if attempt < MAX_ATTEMPTS:
                    time.sleep(2**attempt)

    scan_status.set_status(scan_job_id, "pip-audit", "failed", task_id=self.request.id, error=last_error)
    metrics.record_scanner_result("pip-audit", duration_seconds=timer.elapsed, success=False)
    return {"scanner": "pip-audit", "success": False, "error": last_error, "findings": [], "sbom": None}


ALL_SCANNER_TASK_NAMES = [
    "semgrep",
    "ast-grep",
    "joern",
    "pip-audit",
    "osv",
    "nvd",
    "secrets",
    "docker",
    "yaml",
]
