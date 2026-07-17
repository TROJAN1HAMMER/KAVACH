"""
KAVACH — Nightly Scheduled Scans
Celery Beat fires `nightly_scheduled_scans_task` once a day (see
`app/workers/celery_app.py`'s `beat_schedule`) for every repository
opted in via `Repository.scheduled_scan_enabled` — a re-scan on its
default branch, at LOW priority so a night's worth of scheduled scans
never competes with an interactive user submission for worker capacity
(see `app/workers/celery_app.py`'s `QUEUE_BY_PRIORITY`).

Only URL-based repositories can be scheduled (enforced when the flag is
set, in the API layer — see `app/api/v1/endpoints/repositories.py`) since
re-scanning means re-fetching from the repository's own URL; a one-time
zip upload has nothing left to re-fetch.
"""

import asyncio

import structlog

from app.db.session import AsyncSessionLocal
from app.models.enums import ScanJobPriority
from app.repositories.repository_repository import RepositoryRepository
from app.repositories.scan_job_repository import ScanJobRepository
from app.workers.celery_app import celery_app

logger = structlog.get_logger(__name__)


@celery_app.task(name="kavach.nightly_scheduled_scans")
def nightly_scheduled_scans_task() -> None:
    asyncio.run(_run_nightly_scheduled_scans())


async def _run_nightly_scheduled_scans() -> None:
    from app.tasks.scan_tasks import dispatch_scan_job

    async with AsyncSessionLocal() as db:
        repositories_repo = RepositoryRepository(db)
        scan_jobs = ScanJobRepository(db)

        scheduled = await repositories_repo.list_scheduled()
        logger.info("scheduled_scans.starting", repository_count=len(scheduled))

        for repository in scheduled:
            job = await scan_jobs.create_queued(
                repository_id=repository.id,
                owner_id=repository.owner_id,
                ref=repository.default_branch,
                priority=ScanJobPriority.LOW,
            )
            # Commit before dispatch, not after: `.delay()`/`.apply_async()`
            # publishes to Redis immediately, and a worker on a separate DB
            # connection won't see this row until the transaction commits
            # — the same race this pattern already guards against at every
            # other scan-dispatch call site (see scan.py's
            # `_queue_and_dispatch`).
            await db.commit()
            task_id = dispatch_scan_job(job)
            await scan_jobs.set_celery_task_id(job, task_id)
            await db.commit()

            logger.info(
                "scheduled_scans.dispatched",
                repository_id=str(repository.id),
                repository_name=repository.name,
                scan_job_id=str(job.id),
            )

        logger.info("scheduled_scans.complete", repository_count=len(scheduled))
