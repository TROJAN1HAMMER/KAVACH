"""
KAVACH — ScanResult Model
The computed outcome of a completed ScanJob: BRS/zero-day scores plus the
summary dicts used for report generation. Split from ScanJob (1:1) so a
job can exist in any status — queued, running, failed — with no result
row at all, rather than a wide table full of nulls until completion.
"""

import uuid
from typing import TYPE_CHECKING, Optional

from sqlalchemy import Float, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.db.mixins import TimestampMixin, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from app.models.scan_job import ScanJob


class ScanResult(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "scan_results"

    scan_job_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("scan_jobs.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )

    total_findings: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    brs_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    brs_risk_level: Mapped[Optional[str]] = mapped_column(String(16), nullable=True)
    zero_day_risk_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    zero_day_risk_level: Mapped[Optional[str]] = mapped_column(String(16), nullable=True)

    summary: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    compliance_summary: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)

    scan_job: Mapped["ScanJob"] = relationship(back_populates="result")
