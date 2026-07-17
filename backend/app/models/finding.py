"""
KAVACH — Finding Model
Mirrors `app/schemas/finding.py::FindingResponse`. The `ComplianceMappingSchema`
(rbi_clause/pci_clause/swift_clause) is flattened onto this table rather than
given its own table — it has no independent identity or lifecycle, it's a
1:1 annotation of a finding.
"""

import uuid
from typing import TYPE_CHECKING, Optional

from sqlalchemy import Float, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.db.mixins import TimestampMixin, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from app.models.scan_job import ScanJob


class Finding(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "findings"

    scan_job_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("scan_jobs.id", ondelete="CASCADE"), nullable=False, index=True
    )

    title: Mapped[str] = mapped_column(String(500), nullable=False)
    severity: Mapped[str] = mapped_column(String(16), nullable=False, index=True)
    category: Mapped[str] = mapped_column(String(64), nullable=False, default="unknown")
    source: Mapped[str] = mapped_column(String(32), nullable=False)
    cvss: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    brs: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    brs_risk_level: Mapped[Optional[str]] = mapped_column(String(16), nullable=True)
    # Business module the BRS engine classified this finding into
    # (Payments/Authentication/.../General) — persisted so the
    # "historical incidents" BRS factor can query per-module CRITICAL/HIGH
    # counts across this repository's past scans without re-deriving
    # classification from category/file_path every time.
    module: Mapped[Optional[str]] = mapped_column(String(64), nullable=True, index=True)

    file_path: Mapped[Optional[str]] = mapped_column(String(1024), nullable=True)
    line_number: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")

    package: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    package_version: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    cve: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)

    ai_explanation: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    ai_business_impact: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    ai_remediation: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # 255, not the original 64: app/data/compliance_mappings.json's real
    # clause descriptions ("RBI IT Framework 2021 — Section 4.2: Access
    # Control & Identity Management; Annex II: Sensitive Data Protection")
    # run up to 141 characters — 64 truncated the moment a real compliance
    # mapping (not just a short test string) got persisted, raising
    # StringDataRightTruncationError on every finding with a full-length
    # clause. See alembic/versions/0009_widen_compliance_clause_columns.py.
    rbi_clause: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    pci_clause: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    swift_clause: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    # Populated by the aggregation layer (app/services/aggregation/) —
    # cross-tool provenance + taxonomy mapping. Full CVE detail and the
    # complete correlation group stay in the unified_findings.json report
    # artifact rather than being duplicated here; these columns carry just
    # what's worth filtering/displaying per-finding in the main API.
    sources: Mapped[Optional[list]] = mapped_column(JSONB, nullable=True)
    occurrence_count: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    cwe_id: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    cwe_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    owasp_category: Mapped[Optional[str]] = mapped_column(String(8), nullable=True)
    owasp_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    mitre_technique_ids: Mapped[Optional[list]] = mapped_column(JSONB, nullable=True)

    scan_job: Mapped["ScanJob"] = relationship(back_populates="findings")
