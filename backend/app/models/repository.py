"""
KAVACH — Repository Model
The scan target: either a URL resolved through an `app/integrations/`
provider (GitHub/GitLab/Bitbucket) or a direct zip upload. One Repository
can have many ScanJobs (re-scans, different branches/commits over time).
"""

import uuid
from typing import TYPE_CHECKING, Optional

from sqlalchemy import Boolean, Enum, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.db.mixins import TimestampMixin, UUIDPrimaryKeyMixin
from app.models.enums import RepoProviderType

if TYPE_CHECKING:
    from app.models.scan_job import ScanJob


class Repository(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "repositories"

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    url: Mapped[Optional[str]] = mapped_column(String(1024), nullable=True)
    provider: Mapped[RepoProviderType] = mapped_column(
        Enum(
            RepoProviderType,
            name="repo_provider_type",
            native_enum=True,
            # See the same values_callable note on ScanJob.status/priority —
            # without it, SQLAlchemy binds "UPLOAD" instead of "upload" and
            # every insert fails against the Postgres enum type.
            values_callable=lambda enum_cls: [e.value for e in enum_cls],
        ),
        nullable=False,
        default=RepoProviderType.UPLOAD,
    )
    default_branch: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    # Opt-in nightly re-scan (see app/tasks/scheduled_scan_tasks.py). Only
    # meaningful for URL-based repositories — a one-time zip upload has no
    # re-fetchable source to scan again, so the API layer refuses to set
    # this true for a repository with no `url`.
    scheduled_scan_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    owner_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    scan_jobs: Mapped[list["ScanJob"]] = relationship(
        back_populates="repository", cascade="all, delete-orphan", lazy="selectin"
    )
