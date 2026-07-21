"""
KAVACH — Executive Evidence Aggregation
Deterministic, org-wide aggregation over ScanJob/ScanResult/Repository/
Finding — no LLM, no vector search, nothing here is generated. This is
the "never fabricate statistics" guarantee: every number that ends up in
an executive answer traces back to a field computed in this file, and the
LLM prompt built from `render_evidence_block()` contains ONLY these
pre-computed numbers, never raw per-scan/per-finding data it could
misread or embellish.

Reuses the same "small aggregation queries, no new tables" approach
app/services/analytics/activity_service.py already established for the
Security Manager's team-activity view — this module answers a different
(portfolio/compliance/trend) question, so it isn't a call site of that
one, but it's built the same way.
"""

import uuid
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import ScanJobStatus
from app.models.finding import Finding
from app.models.repository import Repository
from app.models.scan_job import ScanJob
from app.models.scan_result import ScanResult

TOP_RISK_REPO_LIMIT = 5
TREND_WEEKS = 8


@dataclass
class RepositoryRiskEvidence:
    repository_id: str
    repository_name: str
    latest_brs_score: float
    latest_brs_risk_level: Optional[str]
    latest_scan_finished_at: Optional[str]


@dataclass
class ComplianceFrameworkEvidence:
    framework_key: str
    framework_name: str
    compliant_repo_count: int
    non_compliant_repo_count: int
    total_violations: int


@dataclass
class WeeklyTrendPoint:
    week_start: str  # ISO date, Monday of that week
    scan_count: int
    average_brs: Optional[float]
    critical_high_findings: int


@dataclass
class WeekOverWeekDelta:
    scans_this_week: int
    scans_last_week: int
    findings_this_week: int
    findings_last_week: int
    average_brs_this_week: Optional[float]
    average_brs_last_week: Optional[float]


@dataclass
class ExecutiveEvidenceSnapshot:
    generated_at: str
    total_repositories: int
    total_completed_scans: int
    total_findings: int
    findings_by_severity: dict[str, int]
    portfolio_average_brs: Optional[float]
    top_risk_repositories: list[RepositoryRiskEvidence] = field(default_factory=list)
    compliance_by_framework: list[ComplianceFrameworkEvidence] = field(default_factory=list)
    weekly_trend: list[WeeklyTrendPoint] = field(default_factory=list)
    week_over_week: Optional[WeekOverWeekDelta] = None

    @property
    def has_any_data(self) -> bool:
        return self.total_completed_scans > 0


def render_evidence_block(snapshot: ExecutiveEvidenceSnapshot) -> str:
    """
    The ONLY scan-history text that reaches the LLM prompt — a flat list
    of the exact numbers computed above, nothing else. There is no raw
    per-scan or per-finding data anywhere in this string for a model to
    misread, round differently, or embellish; every number in an
    executive answer must trace back to a line here.
    """
    lines = [f"Data as of: {snapshot.generated_at}"]
    lines.append(f"Total repositories: {snapshot.total_repositories}")
    lines.append(f"Total completed scans: {snapshot.total_completed_scans}")

    if not snapshot.has_any_data:
        lines.append("No completed scans exist yet — there is no scan history to report on.")
        return "\n".join(lines)

    lines.append(f"Total findings across all completed scans: {snapshot.total_findings}")
    severity_line = ", ".join(f"{sev}={count}" for sev, count in sorted(snapshot.findings_by_severity.items()))
    lines.append(f"Findings by severity: {severity_line or 'none'}")
    lines.append(
        f"Portfolio average Banking Risk Score: "
        f"{snapshot.portfolio_average_brs if snapshot.portfolio_average_brs is not None else 'N/A'}"
    )

    if snapshot.top_risk_repositories:
        lines.append("Top risk repositories (by latest scan's Banking Risk Score):")
        for repo in snapshot.top_risk_repositories:
            lines.append(
                f"  - {repo.repository_name}: BRS {repo.latest_brs_score:.1f} ({repo.latest_brs_risk_level or 'N/A'}), "
                f"last scanned {repo.latest_scan_finished_at or 'unknown'}"
            )

    if snapshot.compliance_by_framework:
        lines.append("Regulatory compliance (based on each repository's most recent scan):")
        for fw in snapshot.compliance_by_framework:
            total_repos = fw.compliant_repo_count + fw.non_compliant_repo_count
            lines.append(
                f"  - {fw.framework_name}: {fw.compliant_repo_count} of {total_repos} repositories compliant, "
                f"{fw.total_violations} total violations recorded"
            )

    if snapshot.week_over_week:
        wow = snapshot.week_over_week
        lines.append(
            f"This week vs. last week: {wow.scans_this_week} scans (avg BRS "
            f"{wow.average_brs_this_week if wow.average_brs_this_week is not None else 'N/A'}) vs. "
            f"{wow.scans_last_week} scans (avg BRS "
            f"{wow.average_brs_last_week if wow.average_brs_last_week is not None else 'N/A'}); "
            f"{wow.findings_this_week} findings this week vs. {wow.findings_last_week} findings last week."
        )

    if snapshot.weekly_trend:
        lines.append(f"Weekly trend (last {len(snapshot.weekly_trend)} weeks, oldest first):")
        for point in snapshot.weekly_trend:
            lines.append(
                f"  - Week of {point.week_start}: {point.scan_count} scan(s), "
                f"avg BRS {point.average_brs if point.average_brs is not None else 'N/A'}, "
                f"{point.critical_high_findings} critical/high finding(s)"
            )

    return "\n".join(lines)


async def build_evidence_snapshot(db: AsyncSession) -> ExecutiveEvidenceSnapshot:
    now = datetime.now(timezone.utc)
    generated_at = now.isoformat()

    total_repositories = (await db.execute(select(Repository.id))).all()
    total_repositories = len(total_repositories)

    scan_rows = (
        await db.execute(
            select(
                ScanJob.id,
                ScanJob.repository_id,
                ScanJob.finished_at,
                Repository.name,
                ScanResult.brs_score,
                ScanResult.brs_risk_level,
                ScanResult.compliance_summary,
                ScanResult.summary,
            )
            .join(Repository, ScanJob.repository_id == Repository.id)
            .outerjoin(ScanResult, ScanResult.scan_job_id == ScanJob.id)
            .where(ScanJob.status == ScanJobStatus.COMPLETED)
            .where(ScanJob.finished_at.is_not(None))
            .order_by(ScanJob.finished_at.asc())
        )
    ).all()

    total_completed_scans = len(scan_rows)
    if total_completed_scans == 0:
        return ExecutiveEvidenceSnapshot(
            generated_at=generated_at,
            total_repositories=total_repositories,
            total_completed_scans=0,
            total_findings=0,
            findings_by_severity={},
            portfolio_average_brs=None,
        )

    severity_rows = (
        await db.execute(
            select(Finding.severity, Finding.id)
            .join(ScanJob, Finding.scan_job_id == ScanJob.id)
            .where(ScanJob.status == ScanJobStatus.COMPLETED)
        )
    ).all()
    findings_by_severity: dict[str, int] = defaultdict(int)
    for severity, _ in severity_rows:
        findings_by_severity[severity] += 1
    total_findings = len(severity_rows)

    brs_scores = [row.brs_score for row in scan_rows if row.brs_score is not None]
    portfolio_average_brs = round(sum(brs_scores) / len(brs_scores), 2) if brs_scores else None

    # Latest scan per repository — drives both top-risk repos and
    # per-framework compliance (a repo's CURRENT posture, not its history).
    latest_by_repo: dict[uuid.UUID, tuple] = {}
    for row in scan_rows:
        latest_by_repo[row.repository_id] = row  # rows are ascending by finished_at, so last write wins

    top_risk_repositories = sorted(
        (
            RepositoryRiskEvidence(
                repository_id=str(row.repository_id),
                repository_name=row.name,
                latest_brs_score=row.brs_score,
                latest_brs_risk_level=row.brs_risk_level,
                latest_scan_finished_at=row.finished_at.isoformat() if row.finished_at else None,
            )
            for row in latest_by_repo.values()
            if row.brs_score is not None
        ),
        key=lambda r: r.latest_brs_score,
        reverse=True,
    )[:TOP_RISK_REPO_LIMIT]

    compliance_by_framework = _aggregate_compliance(latest_by_repo.values())
    weekly_trend = _weekly_trend(scan_rows, now)
    week_over_week = _week_over_week(scan_rows, now)

    return ExecutiveEvidenceSnapshot(
        generated_at=generated_at,
        total_repositories=total_repositories,
        total_completed_scans=total_completed_scans,
        total_findings=total_findings,
        findings_by_severity=dict(findings_by_severity),
        portfolio_average_brs=portfolio_average_brs,
        top_risk_repositories=top_risk_repositories,
        compliance_by_framework=compliance_by_framework,
        weekly_trend=weekly_trend,
        week_over_week=week_over_week,
    )


def _aggregate_compliance(latest_rows) -> list[ComplianceFrameworkEvidence]:
    """
    Reads the `compliance_summary` JSON already persisted on each scan's
    ScanResult (app/services/compliance/compliance_engine.py's output,
    computed once at scan time) rather than re-running the compliance
    engine over historical findings — the summary already IS the
    deterministic fact this needs, so recomputing it would just be
    duplicate work for the same answer.
    """
    per_framework: dict[str, dict] = {}
    for row in latest_rows:
        summary = row.compliance_summary
        if not summary:
            continue
        for framework_key, detail in summary.items():
            entry = per_framework.setdefault(
                framework_key,
                {"name": detail.get("name", framework_key), "compliant": 0, "non_compliant": 0, "violations": 0},
            )
            if detail.get("compliant"):
                entry["compliant"] += 1
            else:
                entry["non_compliant"] += 1
            entry["violations"] += int(detail.get("violations", 0) or 0)

    return [
        ComplianceFrameworkEvidence(
            framework_key=key,
            framework_name=data["name"],
            compliant_repo_count=data["compliant"],
            non_compliant_repo_count=data["non_compliant"],
            total_violations=data["violations"],
        )
        for key, data in sorted(per_framework.items())
    ]


def _week_start(dt: datetime) -> datetime:
    monday = dt - timedelta(days=dt.weekday())
    return monday.replace(hour=0, minute=0, second=0, microsecond=0)


def _critical_high_count(summary: Optional[dict]) -> int:
    if not summary:
        return 0
    return int(summary.get("CRITICAL", 0) or 0) + int(summary.get("HIGH", 0) or 0)


def _total_findings_count(summary: Optional[dict]) -> int:
    if not summary:
        return 0
    return int(summary.get("total", 0) or 0)


def _weekly_trend(scan_rows, now: datetime) -> list[WeeklyTrendPoint]:
    buckets: dict[datetime, list] = defaultdict(list)
    earliest_week = _week_start(now) - timedelta(weeks=TREND_WEEKS - 1)
    for row in scan_rows:
        if row.finished_at is None or row.finished_at < earliest_week:
            continue
        buckets[_week_start(row.finished_at)].append(row)

    points = []
    for week_offset in range(TREND_WEEKS):
        week_start = earliest_week + timedelta(weeks=week_offset)
        rows = buckets.get(week_start, [])
        brs_values = [r.brs_score for r in rows if r.brs_score is not None]
        points.append(
            WeeklyTrendPoint(
                week_start=week_start.date().isoformat(),
                scan_count=len(rows),
                average_brs=round(sum(brs_values) / len(brs_values), 2) if brs_values else None,
                critical_high_findings=sum(_critical_high_count(r.summary) for r in rows),
            )
        )
    return points


def _week_over_week(scan_rows, now: datetime) -> WeekOverWeekDelta:
    this_week_start = now - timedelta(days=7)
    last_week_start = now - timedelta(days=14)

    this_week = [r for r in scan_rows if r.finished_at and r.finished_at >= this_week_start]
    last_week = [r for r in scan_rows if r.finished_at and last_week_start <= r.finished_at < this_week_start]

    def avg_brs(rows) -> Optional[float]:
        values = [r.brs_score for r in rows if r.brs_score is not None]
        return round(sum(values) / len(values), 2) if values else None

    return WeekOverWeekDelta(
        scans_this_week=len(this_week),
        scans_last_week=len(last_week),
        findings_this_week=sum(_total_findings_count(r.summary) for r in this_week),
        findings_last_week=sum(_total_findings_count(r.summary) for r in last_week),
        average_brs_this_week=avg_brs(this_week),
        average_brs_last_week=avg_brs(last_week),
    )
