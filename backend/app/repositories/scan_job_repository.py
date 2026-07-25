"""
KAVACH — ScanJob Repository
Owns every state transition in the job lifecycle: queued → running →
(completed | failed | cancelled), plus retry bookkeeping and the
progress/heartbeat fields the orchestrator updates as it works.

`is_cancelled()` deliberately runs a fresh column-only SELECT rather than
returning a cached attribute off an already-loaded ORM object: the
orchestrator holds one long-lived session/transaction for the whole
pipeline, and needs to see a cancellation committed by a *different*
session (the API request handling `POST /scan-jobs/{id}/cancel`). Under
Postgres's default READ COMMITTED isolation, a fresh statement in an
already-open transaction still sees other transactions' commits, so this
works without any special isolation-level handling.
"""

import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import ScanJobPriority, ScanJobStatus
from app.models.scan_job import ScanJob
from app.orchestrator import scan_status


class ScanJobRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def create_queued(
        self,
        *,
        repository_id: uuid.UUID,
        owner_id: Optional[uuid.UUID] = None,
        ref: Optional[str] = None,
        artifact_path: Optional[str] = None,
        priority: ScanJobPriority = ScanJobPriority.NORMAL,
        max_retries: int = 2,
        timeout_seconds: int = 900,
    ) -> ScanJob:
        job = ScanJob(
            repository_id=repository_id,
            owner_id=owner_id,
            ref=ref,
            artifact_path=artifact_path,
            priority=priority,
            status=ScanJobStatus.QUEUED,
            max_retries=max_retries,
            timeout_seconds=timeout_seconds,
            queued_at=datetime.now(timezone.utc),
        )
        self.db.add(job)
        await self.db.flush()
        await self.db.refresh(job)
        return job

    async def get(self, scan_job_id: uuid.UUID, *, fresh: bool = False) -> Optional[ScanJob]:
        """
        `fresh=True` forces a real SELECT even if this job is already in the
        session's identity map (e.g. loaded earlier on the same long-lived
        WebSocket session) — otherwise `AsyncSession.get()` happily returns
        the stale cached object instead of the DB's current row. Needed
        anywhere a job already loaded once in this session might have since
        been mutated by a different session (a Celery worker committing a
        status transition), which is exactly the situation in
        `scan_progress_ws`'s post-completion re-fetch.
        """
        return await self.db.get(ScanJob, scan_job_id, populate_existing=fresh)

    async def list_by_owner(
        self,
        owner_id: uuid.UUID,
        *,
        status: Optional[ScanJobStatus] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> list[ScanJob]:
        try:
            query = select(ScanJob).where((ScanJob.owner_id == owner_id) | (ScanJob.owner_id.is_(None)))
            if status is not None:
                query = query.where(ScanJob.status == status)
            query = query.order_by(ScanJob.created_at.desc()).limit(limit).offset(offset)
            result = await self.db.execute(query)
            return list(result.scalars().all())
        except Exception:
            return []


    async def list_running(self) -> list[ScanJob]:
        """
        Every RUNNING job, for the periodic stalled-job sweeper to inspect.
        Staleness deliberately isn't filtered here in SQL: heartbeats only
        land at coarse stage boundaries (see the orchestrator's
        `checkpoint()`), and a single scanner subprocess call can
        legitimately run for a large fraction of a job's own configured
        `timeout_seconds` between two of them. A fixed cutoff here would
        false-positive on jobs that are merely slow, not dead — so the
        sweeper compares each job's heartbeat age against *its own*
        `timeout_seconds` instead of one global threshold.
        """
        result = await self.db.execute(select(ScanJob).where(ScanJob.status == ScanJobStatus.RUNNING))
        return list(result.scalars().all())

    async def set_celery_task_id(self, job: ScanJob, task_id: str) -> ScanJob:
        job.celery_task_id = task_id
        await self.db.flush()
        return job

    def _publish_job_status(self, job: ScanJob) -> None:
        scan_status.publish_update(
            str(job.id),
            {
                "type": "job_status",
                "status": job.status.value,
                "progress_percent": job.progress_percent,
                "current_stage": job.current_stage,
            },
        )

    async def _commit_and_publish(self, job: ScanJob) -> None:
        """
        Commit *before* publishing, not after. `publish_update` fans out
        over Redis pub/sub to the `/scan/{id}/ws` endpoint, which lives in a
        different process (the API server) on a different DB
        connection/transaction than this one (a Celery worker). Under
        Postgres's READ COMMITTED isolation, that subscriber can only see
        this row's new state once our transaction actually commits — so
        publishing first (this used to be `flush()` then publish, with the
        caller committing afterwards) opened a window where a WS client
        could receive the "completed" event and re-query the job before the
        commit landed, and get served the pre-completion row. Committing
        here, before the event goes out, closes that window. `db.commit()`
        implies a flush, and the session is configured with
        `expire_on_commit=False` (see app/db/session.py), so `job`'s
        attributes stay populated and safe to read in `_publish_job_status`
        right after.
        """
        await self.db.commit()
        self._publish_job_status(job)

    async def mark_running(self, job: ScanJob) -> ScanJob:
        now = datetime.now(timezone.utc)
        job.status = ScanJobStatus.RUNNING
        job.started_at = now
        job.last_heartbeat_at = now
        job.progress_percent = 0
        job.current_stage = "starting"
        await self._commit_and_publish(job)
        return job

    async def update_progress(self, job: ScanJob, *, percent: int, stage: str) -> ScanJob:
        job.progress_percent = percent
        job.current_stage = stage
        job.last_heartbeat_at = datetime.now(timezone.utc)
        await self._commit_and_publish(job)
        return job

    async def mark_completed(self, job: ScanJob) -> ScanJob:
        job.status = ScanJobStatus.COMPLETED
        job.progress_percent = 100
        job.current_stage = "completed"
        job.finished_at = datetime.now(timezone.utc)
        await self._commit_and_publish(job)
        return job

    async def mark_failed(self, job: ScanJob, *, error_message: str) -> ScanJob:
        job.status = ScanJobStatus.FAILED
        job.error_message = error_message
        job.finished_at = datetime.now(timezone.utc)
        await self._commit_and_publish(job)
        return job

    async def mark_cancelled(self, job: ScanJob) -> ScanJob:
        job.status = ScanJobStatus.CANCELLED
        job.finished_at = datetime.now(timezone.utc)
        await self._commit_and_publish(job)
        return job

    def should_retry(self, job: ScanJob) -> bool:
        return job.retry_count < job.max_retries

    async def prepare_retry(self, job: ScanJob) -> ScanJob:
        """Reset a failed run back to QUEUED for another attempt."""
        job.retry_count += 1
        job.status = ScanJobStatus.QUEUED
        job.progress_percent = 0
        job.current_stage = None
        job.error_message = None
        job.started_at = None
        job.last_heartbeat_at = None
        await self.db.flush()
        return job

    async def is_cancelled(self, scan_job_id: uuid.UUID) -> bool:
        result = await self.db.execute(select(ScanJob.status).where(ScanJob.id == scan_job_id))
        status = result.scalar_one_or_none()
        return status == ScanJobStatus.CANCELLED

    _TERMINAL_STATUSES = (ScanJobStatus.COMPLETED, ScanJobStatus.FAILED, ScanJobStatus.CANCELLED)

    async def list_archivable(self, *, older_than: datetime, limit: int = 500) -> list[ScanJob]:
        """
        Terminal jobs, past the retention cutoff, not yet archived — see
        app/tasks/archive_tasks.py. Capped at `limit` per call so one
        nightly sweep after a long gap (or a big backlog) processes in
        bounded batches rather than one unbounded query.
        """
        result = await self.db.execute(
            select(ScanJob)
            .where(
                ScanJob.status.in_(self._TERMINAL_STATUSES),
                ScanJob.archived_at.is_(None),
                ScanJob.finished_at.is_not(None),
                ScanJob.finished_at < older_than,
            )
            .order_by(ScanJob.finished_at.asc())
            .limit(limit)
        )
        return list(result.scalars().all())

    async def mark_archived(self, job: ScanJob) -> ScanJob:
        job.archived_at = datetime.now(timezone.utc)
        await self.db.flush()
        return job
