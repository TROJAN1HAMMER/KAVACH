"""
KAVACH — ScanResult Repository
"""

import uuid
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.scan_result import ScanResult


class ScanResultRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def create(
        self,
        *,
        scan_job_id: uuid.UUID,
        total_findings: int,
        brs_score: float,
        brs_risk_level: str,
        attack_surface_exposure_score: float,
        attack_surface_exposure_level: str,
        summary: dict,
        compliance_summary: dict,
    ) -> ScanResult:
        result = ScanResult(
            scan_job_id=scan_job_id,
            total_findings=total_findings,
            brs_score=brs_score,
            brs_risk_level=brs_risk_level,
            attack_surface_exposure_score=attack_surface_exposure_score,
            attack_surface_exposure_level=attack_surface_exposure_level,
            summary=summary,
            compliance_summary=compliance_summary,
        )
        self.db.add(result)
        await self.db.flush()
        return result

    async def get_by_scan_job(self, scan_job_id: uuid.UUID) -> Optional[ScanResult]:
        result = await self.db.execute(
            select(ScanResult).where(ScanResult.scan_job_id == scan_job_id)
        )
        return result.scalar_one_or_none()
