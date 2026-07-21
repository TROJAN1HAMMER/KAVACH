"""
KAVACH — ScanJob Model
The unit of work the orchestrator queues, runs, and tracks. Supersedes the
earlier flat `Scan` model: queue/lifecycle concerns (status, priority,
retries, timeout, heartbeat, progress) live here; the computed outcome
(BRS score, attack surface exposure score, summaries) lives in `ScanResult` — a 1:1
sibling, not inline columns, so a job can exist (queued/running/failed)
before any result has been computed.
"""

import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.db.mixins import TimestampMixin, UUIDPrimaryKeyMixin
from app.models.enums import ScanJobPriority, ScanJobStatus

if TYPE_CHECKING:
    from app.models.finding import Finding
    from app.models.report import Report
    from app.models.repository import Repository
    from app.models.scan_result import ScanResult


class ScanJob(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "scan_jobs"

    repository_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("repositories.id", ondelete="CASCADE"), nullable=False, index=True
    )
    owner_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    status: Mapped[ScanJobStatus] = mapped_column(
        Enum(
            ScanJobStatus,
            name="scan_job_status",
            native_enum=True,
            # SQLAlchemy's Enum defaults to persisting the member's `.name`
            # ("QUEUED"), not `.value` ("queued") — even for `str, Enum`
            # hybrids. The Postgres enum type created in the migration only
            # permits the lowercase `.value` strings, so this is required,
            # not cosmetic: without it, every insert/update fails at the DB.
            values_callable=lambda enum_cls: [e.value for e in enum_cls],
        ),
        nullable=False,
        default=ScanJobStatus.QUEUED,
        index=True,
    )
    priority: Mapped[ScanJobPriority] = mapped_column(
        Enum(
            ScanJobPriority,
            name="scan_job_priority",
            native_enum=True,
            values_callable=lambda enum_cls: [e.value for e in enum_cls],
        ),
        nullable=False,
        default=ScanJobPriority.NORMAL,
        index=True,
    )

    # What to scan: branch/tag/commit for a Repository with a URL, unused
    # for uploads. `artifact_path` is where the zip to scan currently lives
    # on disk (uploaded directly, or downloaded by an integrations/ provider).
    ref: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    artifact_path: Mapped[Optional[str]] = mapped_column(String(1024), nullable=True)

    # Queue / retry bookkeeping
    celery_task_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True, index=True)
    retry_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    max_retries: Mapped[int] = mapped_column(Integer, nullable=False, default=2)
    timeout_seconds: Mapped[int] = mapped_column(Integer, nullable=False, default=900)

    # Progress / liveness — updated by the orchestrator at each pipeline
    # stage. `last_heartbeat_at` going stale while status stays RUNNING is
    # exactly what the timeout sweeper (app/tasks/maintenance_tasks.py)
    # watches for to detect a worker that died without raising.
    progress_percent: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    current_stage: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    last_heartbeat_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    queued_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    started_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    finished_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    # Set by app/tasks/archive_tasks.py once this job's report artifacts
    # have been purged past settings.archive_after_days — the job itself,
    # its Findings, and its ScanResult stay in Postgres forever (that's the
    # queryable history behind the Risk/Executive dashboards); only the
    # heavier rendered report files are reclaimed. Never set on a job
    # that's still queued/running.
    archived_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    repository: Mapped["Repository"] = relationship(back_populates="scan_jobs")
    result: Mapped[Optional["ScanResult"]] = relationship(
        back_populates="scan_job", uselist=False, cascade="all, delete-orphan"
    )
    findings: Mapped[list["Finding"]] = relationship(
        back_populates="scan_job", cascade="all, delete-orphan", lazy="selectin"
    )
    reports: Mapped[list["Report"]] = relationship(
        back_populates="scan_job", cascade="all, delete-orphan", lazy="selectin"
    )
