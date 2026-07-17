"""
KAVACH — Repository Dependency Injection
Wires each repository to the request-scoped `AsyncSession` from
`app.db.session.get_db`. Routes depend on these functions, e.g.:

    @router.get("/scan-jobs/{scan_job_id}")
    async def get_scan_job(
        scan_job_id: uuid.UUID,
        scan_jobs: Annotated[ScanJobRepository, Depends(get_scan_job_repository)],
    ):
        ...
"""

from typing import Annotated

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.repositories.audit_log_repository import AuditLogRepository
from app.repositories.business_module_repository import BusinessModuleRepository
from app.repositories.finding_repository import FindingRepository
from app.repositories.report_repository import ReportRepository
from app.repositories.repository_repository import RepositoryRepository
from app.repositories.risk_factor_weight_repository import RiskFactorWeightRepository
from app.repositories.scan_job_repository import ScanJobRepository
from app.repositories.scan_result_repository import ScanResultRepository
from app.repositories.user_repository import UserRepository


def get_repository_repository(db: Annotated[AsyncSession, Depends(get_db)]) -> RepositoryRepository:
    return RepositoryRepository(db)


def get_business_module_repository(db: Annotated[AsyncSession, Depends(get_db)]) -> BusinessModuleRepository:
    return BusinessModuleRepository(db)


def get_risk_factor_weight_repository(
    db: Annotated[AsyncSession, Depends(get_db)]
) -> RiskFactorWeightRepository:
    return RiskFactorWeightRepository(db)


def get_scan_job_repository(db: Annotated[AsyncSession, Depends(get_db)]) -> ScanJobRepository:
    return ScanJobRepository(db)


def get_scan_result_repository(db: Annotated[AsyncSession, Depends(get_db)]) -> ScanResultRepository:
    return ScanResultRepository(db)


def get_finding_repository(db: Annotated[AsyncSession, Depends(get_db)]) -> FindingRepository:
    return FindingRepository(db)


def get_report_repository(db: Annotated[AsyncSession, Depends(get_db)]) -> ReportRepository:
    return ReportRepository(db)


def get_user_repository(db: Annotated[AsyncSession, Depends(get_db)]) -> UserRepository:
    return UserRepository(db)


def get_audit_log_repository(db: Annotated[AsyncSession, Depends(get_db)]) -> AuditLogRepository:
    return AuditLogRepository(db)
