"""
KAVACH — Scan Activity Analytics
Pure aggregation over existing ScanJob/ScanResult/Finding/User data — no
new tables. Backs the Security Analyst's personal workload/efficiency
view and the Security Manager's org-wide team-activity view (see
app/schemas/analytics.py and app/api/v1/endpoints/analytics.py).

Deliberately scoped to what's actually measurable today: scan counts,
finding severity mix, average BRS, average scan duration. Finding-level
workflow metrics an analyst dashboard might eventually want — assigned
issues, pending reviews, mean time to *resolve* a finding, SLA status —
depend on a finding status/assignment/comment model that doesn't exist
yet (findings currently have no status field at all); those are a
follow-up, not approximated here with fake data.
"""

import uuid
from typing import Optional

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import ScanJobStatus
from app.models.finding import Finding
from app.models.repository import Repository
from app.models.scan_job import ScanJob
from app.models.scan_result import ScanResult
from app.models.user import User
from app.schemas.analytics import MyActivitySummary, RecentScanSummary, TeamActivitySummary, TeamMemberActivity

_RECENT_SCANS_LIMIT = 10


async def _scans_by_status(db: AsyncSession, *, owner_id: Optional[uuid.UUID]) -> dict[str, int]:
    query = select(ScanJob.status, func.count()).group_by(ScanJob.status)
    if owner_id is not None:
        query = query.where(ScanJob.owner_id == owner_id)
    result = await db.execute(query)
    return {status.value: count for status, count in result.all()}


async def _findings_by_severity(db: AsyncSession, *, owner_id: Optional[uuid.UUID]) -> dict[str, int]:
    query = select(Finding.severity, func.count()).join(ScanJob, Finding.scan_job_id == ScanJob.id).group_by(
        Finding.severity
    )
    if owner_id is not None:
        query = query.where(ScanJob.owner_id == owner_id)
    result = await db.execute(query)
    return {severity: count for severity, count in result.all()}


async def _averages(db: AsyncSession, *, owner_id: Optional[uuid.UUID]) -> tuple[Optional[float], Optional[float]]:
    """Returns (average_brs_score, average_scan_duration_seconds) across completed scans."""
    duration_expr = func.extract("epoch", ScanJob.finished_at - ScanJob.started_at)
    query = (
        select(func.avg(ScanResult.brs_score), func.avg(duration_expr))
        .join(ScanResult, ScanResult.scan_job_id == ScanJob.id)
        .where(ScanJob.status == ScanJobStatus.COMPLETED)
        .where(ScanJob.started_at.is_not(None))
        .where(ScanJob.finished_at.is_not(None))
    )
    if owner_id is not None:
        query = query.where(ScanJob.owner_id == owner_id)
    result = await db.execute(query)
    avg_brs, avg_duration = result.one()
    return (round(avg_brs, 2) if avg_brs is not None else None, round(avg_duration, 1) if avg_duration is not None else None)


async def get_my_activity(db: AsyncSession, *, user_id: uuid.UUID) -> MyActivitySummary:
    scans_by_status = await _scans_by_status(db, owner_id=user_id)
    findings_by_severity = await _findings_by_severity(db, owner_id=user_id)
    avg_brs, avg_duration = await _averages(db, owner_id=user_id)

    recent_query = (
        select(ScanJob, Repository.name, ScanResult.brs_score, ScanResult.brs_risk_level)
        .join(Repository, ScanJob.repository_id == Repository.id)
        .outerjoin(ScanResult, ScanResult.scan_job_id == ScanJob.id)
        .where(ScanJob.owner_id == user_id)
        .order_by(ScanJob.created_at.desc())
        .limit(_RECENT_SCANS_LIMIT)
    )
    recent_result = await db.execute(recent_query)
    recent_scans = [
        RecentScanSummary(
            scan_job_id=job.id,
            repository_name=repo_name,
            status=job.status.value,
            brs_score=brs_score,
            brs_risk_level=brs_risk_level,
            finished_at=job.finished_at.isoformat() if job.finished_at else None,
        )
        for job, repo_name, brs_score, brs_risk_level in recent_result.all()
    ]

    return MyActivitySummary(
        total_scans=sum(scans_by_status.values()),
        scans_by_status=scans_by_status,
        total_findings=sum(findings_by_severity.values()),
        findings_by_severity=findings_by_severity,
        average_scan_duration_seconds=avg_duration,
        average_brs_score=avg_brs,
        recent_scans=recent_scans,
    )


async def get_team_activity(db: AsyncSession) -> TeamActivitySummary:
    """Org-wide, grouped per owning user — every scan regardless of who
    triggered it, unlike get_my_activity's owner_id filter."""
    scans_by_status = await _scans_by_status(db, owner_id=None)
    findings_by_severity = await _findings_by_severity(db, owner_id=None)

    per_user_query = (
        select(
            User.id,
            User.email,
            User.full_name,
            func.count(func.distinct(ScanJob.id)).label("scan_count"),
            func.avg(ScanResult.brs_score).label("avg_brs"),
        )
        .join(ScanJob, ScanJob.owner_id == User.id)
        .outerjoin(ScanResult, ScanResult.scan_job_id == ScanJob.id)
        .group_by(User.id, User.email, User.full_name)
        .order_by(func.count(func.distinct(ScanJob.id)).desc())
    )
    per_user_result = await db.execute(per_user_query)

    per_user_findings_query = (
        select(ScanJob.owner_id, func.count())
        .join(Finding, Finding.scan_job_id == ScanJob.id)
        .where(ScanJob.owner_id.is_not(None))
        .group_by(ScanJob.owner_id)
    )
    findings_by_owner = dict((await db.execute(per_user_findings_query)).all())

    members = [
        TeamMemberActivity(
            user_id=user_id,
            email=email,
            full_name=full_name,
            total_scans=scan_count,
            total_findings=findings_by_owner.get(user_id, 0),
            average_brs_score=round(avg_brs, 2) if avg_brs is not None else None,
        )
        for user_id, email, full_name, scan_count, avg_brs in per_user_result.all()
    ]

    return TeamActivitySummary(
        total_scans=sum(scans_by_status.values()),
        total_findings=sum(findings_by_severity.values()),
        members=members,
    )
