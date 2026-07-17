"""
KAVACH — Finding Repository
"""

import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.finding import Finding
from app.models.scan_job import ScanJob


class FindingRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def bulk_create(self, findings: list[Finding]) -> list[Finding]:
        self.db.add_all(findings)
        await self.db.flush()
        return findings

    async def get_by_id(self, finding_id: uuid.UUID) -> Finding | None:
        return await self.db.get(Finding, finding_id)

    async def list_by_scan_job(self, scan_job_id: uuid.UUID) -> list[Finding]:
        result = await self.db.execute(
            select(Finding).where(Finding.scan_job_id == scan_job_id).order_by(Finding.brs.desc())
        )
        return list(result.scalars().all())

    async def count_historical_high_severity_by_module(
        self, repository_id: uuid.UUID, *, exclude_scan_job_id: uuid.UUID | None = None
    ) -> dict[str, int]:
        """
        CRITICAL/HIGH finding counts per module, across every past scan of
        this repository — the input to the BRS engine's "historical
        incidents" factor. `exclude_scan_job_id` leaves the scan currently
        being scored out of its own history.
        """
        query = (
            select(Finding.module, func.count(Finding.id))
            .join(ScanJob, Finding.scan_job_id == ScanJob.id)
            .where(
                ScanJob.repository_id == repository_id,
                Finding.severity.in_(["CRITICAL", "HIGH"]),
                Finding.module.is_not(None),
            )
            .group_by(Finding.module)
        )
        if exclude_scan_job_id is not None:
            query = query.where(Finding.scan_job_id != exclude_scan_job_id)

        result = await self.db.execute(query)
        return {module: count for module, count in result.all()}
