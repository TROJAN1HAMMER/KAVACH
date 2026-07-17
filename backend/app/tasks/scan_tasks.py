"""
KAVACH — Scan Job Dispatch: Prepare Step + Chord Fan-out
`dispatch_scan_job` (called by the API and by every retry path) queues
the "prepare" task. Prepare does the one thing that has to happen exactly
once, before any scanner runs: resolve the artifact (already on disk for
uploads/premade jobs, downloaded via an `integrations/` provider for
repo-URL jobs) and extract it. It then fans out into the 9 independent
scanner tasks (app/tasks/scanner_tasks.py) via a Celery `chord` — the
group runs in parallel, and `aggregate_scan_results_task`
(app/tasks/aggregator_tasks.py) fires once every one of them has returned.

Each scanner gets its own timeout, capped by the job's configured
`timeout_seconds` so that setting still means something in this fan-out
design — without the cap, a user-specified short timeout would silently
do nothing once scanning stopped being one sequential task.
"""

import asyncio
import shutil
import tarfile
import uuid
import zipfile
from pathlib import Path
from typing import Optional

import structlog
from celery import chord, group
from celery.exceptions import SoftTimeLimitExceeded

from app.config import get_settings
from app.core.exceptions import ValidationAppError
from app.db.session import AsyncSessionLocal
from app.integrations.base import RepoProvider
from app.models.enums import RepoProviderType
from app.models.scan_job import ScanJob
from app.repositories.repository_repository import RepositoryRepository
from app.repositories.scan_job_repository import ScanJobRepository
from app.workers.celery_app import celery_app, queue_for_priority

logger = structlog.get_logger(__name__)
settings = get_settings()

SCANNER_DEFAULT_TIMEOUTS = {
    "semgrep": 600,
    "ast-grep": 300,
    "joern": 600,
    "pip-audit": 180,
    "osv": 120,
    "nvd": 240,
    "secrets": 120,
    "docker": 60,
    "yaml": 60,
}


def _timeout_for(scanner_name: str, job_timeout_seconds: int) -> tuple[int, int]:
    """(hard, soft) time limits — capped by the job's own configured timeout."""
    default = SCANNER_DEFAULT_TIMEOUTS.get(scanner_name, 180)
    hard = min(default, job_timeout_seconds)
    soft = max(hard - 30, 10)
    return hard, soft


def _get_provider(provider_type: RepoProviderType) -> RepoProvider:
    if provider_type == RepoProviderType.GITHUB:
        from app.integrations.github.client import GitHubRepoProvider

        return GitHubRepoProvider()
    if provider_type == RepoProviderType.GITLAB:
        from app.integrations.gitlab.client import GitLabRepoProvider

        return GitLabRepoProvider()
    if provider_type == RepoProviderType.BITBUCKET:
        from app.integrations.bitbucket.client import BitbucketRepoProvider

        return BitbucketRepoProvider()
    raise ValidationAppError(f"No downloadable provider for repository type: {provider_type}")


def _extract_archive(archive_path: Path, dest_dir: Path) -> None:
    """Zip uploads use `.zip`; GitHub/GitLab/Bitbucket downloads use `.tar.gz`."""
    if archive_path.suffix == ".zip":
        with zipfile.ZipFile(archive_path, "r") as zf:
            zf.extractall(dest_dir)
    elif archive_path.name.endswith(".tar.gz") or archive_path.suffix == ".tgz":
        with tarfile.open(archive_path, "r:gz") as tf:
            tf.extractall(dest_dir)
    else:
        raise ValidationAppError(f"Unsupported archive format: {archive_path.name}")


def _flatten_single_subdirectory(repo_dir: Path) -> None:
    """Normalize provider archives' single wrapper directory away — see docstring in the old
    orchestrator module for the full rationale (dependency_scanner's non-recursive glob)."""
    entries = list(repo_dir.iterdir())
    if len(entries) == 1 and entries[0].is_dir():
        nested = entries[0]
        for item in nested.iterdir():
            shutil.move(str(item), str(repo_dir / item.name))
        nested.rmdir()


@celery_app.task(name="kavach.prepare_scan_job", bind=True)
def prepare_scan_job_task(self, scan_job_id: str) -> None:
    logger.info("prepare_task.started", scan_job_id=scan_job_id, task_id=self.request.id)
    try:
        asyncio.run(_prepare_and_dispatch(scan_job_id))
    except SoftTimeLimitExceeded:
        logger.error("prepare_task.timed_out", scan_job_id=scan_job_id)
        asyncio.run(_handle_prepare_timeout(scan_job_id))
    except Exception:
        logger.exception("prepare_task.unhandled_error", scan_job_id=scan_job_id)
        raise


async def _prepare_and_dispatch(scan_job_id: str) -> None:
    job_uuid = uuid.UUID(scan_job_id)

    async with AsyncSessionLocal() as db:
        scan_jobs = ScanJobRepository(db)
        repositories_repo = RepositoryRepository(db)

        job = await scan_jobs.get(job_uuid)
        if not job:
            logger.error("prepare_task.job_not_found", scan_job_id=scan_job_id)
            return

        repository = await repositories_repo.get(job.repository_id)
        repo_name = repository.name if repository else "unknown"

        await scan_jobs.mark_running(job)
        await db.commit()

        repo_dir = Path(settings.upload_dir) / f"repo_{scan_job_id}"

        try:
            if job.artifact_path and Path(job.artifact_path).exists():
                artifact_path = Path(job.artifact_path)
            elif repository and repository.url:
                provider = _get_provider(repository.provider)
                artifact_path = await provider.download_archive(
                    repository.url, job.ref, dest_dir=Path(settings.upload_dir)
                )
                job.artifact_path = str(artifact_path)
                await db.commit()
            else:
                raise ValidationAppError("Scan job has no artifact on disk and no repository URL to fetch")

            repo_dir.mkdir(parents=True, exist_ok=True)
            _extract_archive(artifact_path, repo_dir)
            _flatten_single_subdirectory(repo_dir)
            logger.info("prepare_task.extract_complete", scan_job_id=scan_job_id, repo_dir=str(repo_dir))

        except Exception as exc:
            logger.exception("prepare_task.failed", scan_job_id=scan_job_id, error=str(exc))
            if scan_jobs.should_retry(job):
                await scan_jobs.prepare_retry(job)
                await db.commit()
                dispatch_scan_job(job, countdown=2**job.retry_count * 30)
            else:
                await scan_jobs.mark_failed(job, error_message=str(exc))
                await db.commit()
            if repo_dir.exists():
                shutil.rmtree(repo_dir, ignore_errors=True)
            return

        is_premade = repo_name.startswith("premade_")
        priority = job.priority
        timeout_seconds = job.timeout_seconds

    # Session closed — fan-out is pure Celery dispatch, no DB access needed.
    _dispatch_chord(scan_job_id, str(repo_dir), is_premade, repo_name, priority, timeout_seconds)


async def _handle_prepare_timeout(scan_job_id: str) -> None:
    async with AsyncSessionLocal() as db:
        scan_jobs = ScanJobRepository(db)
        job = await scan_jobs.get(uuid.UUID(scan_job_id))
        if not job:
            return
        if scan_jobs.should_retry(job):
            await scan_jobs.prepare_retry(job)
            await db.commit()
            dispatch_scan_job(job, countdown=2**job.retry_count * 30)
        else:
            await scan_jobs.mark_failed(job, error_message="Scan preparation (download/extract) timed out")
            await db.commit()


def _dispatch_chord(
    scan_job_id: str,
    repo_dir: str,
    is_premade: bool,
    repo_name: str,
    priority,
    job_timeout_seconds: int,
) -> None:
    # Deferred imports: scanner_tasks/aggregator_tasks would otherwise
    # create a circular import with this module at load time.
    from app.tasks.aggregator_tasks import aggregate_scan_results_task
    from app.tasks.scanner_tasks import (
        run_ast_grep_task,
        run_docker_task,
        run_joern_task,
        run_nvd_task,
        run_osv_task,
        run_pip_audit_task,
        run_secrets_task,
        run_semgrep_task,
        run_yaml_task,
    )

    queue = queue_for_priority(priority)

    def _opts(name: str) -> dict:
        hard, soft = _timeout_for(name, job_timeout_seconds)
        return {"queue": queue, "time_limit": hard, "soft_time_limit": soft}

    scanner_group = group(
        run_semgrep_task.s(scan_job_id, repo_dir).set(**_opts("semgrep")),
        run_ast_grep_task.s(scan_job_id, repo_dir).set(**_opts("ast-grep")),
        run_joern_task.s(scan_job_id, repo_dir).set(**_opts("joern")),
        run_pip_audit_task.s(scan_job_id, repo_dir, settings.reports_dir, is_premade, repo_name).set(
            **_opts("pip-audit")
        ),
        run_osv_task.s(scan_job_id, repo_dir).set(**_opts("osv")),
        run_nvd_task.s(scan_job_id, repo_dir).set(**_opts("nvd")),
        run_secrets_task.s(scan_job_id, repo_dir).set(**_opts("secrets")),
        run_docker_task.s(scan_job_id, repo_dir).set(**_opts("docker")),
        run_yaml_task.s(scan_job_id, repo_dir).set(**_opts("yaml")),
    )

    # The aggregator does real work too (AI insight calls, PDF/SARIF/SBOM
    # generation) — bounded the same way every scanner task is, not left
    # to run indefinitely.
    chord(scanner_group)(
        aggregate_scan_results_task.s(scan_job_id).set(queue=queue, time_limit=300, soft_time_limit=270)
    )
    logger.info("prepare_task.chord_dispatched", scan_job_id=scan_job_id, scanner_count=9)


def dispatch_scan_job(job: ScanJob, *, countdown: Optional[int] = None) -> str:
    """
    Queue the prepare step, which itself fans out into the 9 scanner
    tasks once the artifact is ready. Returns the prepare task's Celery
    id — `ScanJobRepository.set_celery_task_id` persists it, though the
    real per-scanner task ids (needed for cancellation) come from
    `app/orchestrator/scan_status.py` once the fan-out actually happens.
    """
    async_result = prepare_scan_job_task.apply_async(
        args=[str(job.id)],
        queue=queue_for_priority(job.priority),
        time_limit=180,
        soft_time_limit=150,
        countdown=countdown,
    )
    return async_result.id
