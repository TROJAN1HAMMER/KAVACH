"""
KAVACH — Scan API Routes
Two ways to start a scan:
  - `POST /scan`             — direct zip upload (unchanged contract, now
                                backed by Repository+ScanJob instead of Scan)
  - `POST /scan/repository`  — submit a repo URL. Validates it, stores
                                Repository metadata, creates a queued
                                ScanJob, and returns immediately — the
                                actual download + scan run asynchronously
                                on a Celery worker (see orchestrator).
  - `POST /scan/premade/{risk_level}` — the sandbox demo flow, unchanged.

Every route requires a valid JWT via `get_current_active_user`.
"""

import asyncio
import json
import shutil
import uuid
from pathlib import Path
from typing import Annotated, Optional

import redis.asyncio as redis_asyncio
import structlog
from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.responses import StreamingResponse
from jose import JWTError
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_active_user
from app.auth.permissions import Permission, require_permission
from app.auth.security import decode_token
from app.config import get_settings
from app.core.exceptions import NotFoundError
from app.db.session import get_db
from app.models.enums import RepoProviderType, ScanJobPriority, ScanJobStatus
from app.models.finding import Finding
from app.models.repository import Repository
from app.models.scan_job import ScanJob
from app.models.scan_result import ScanResult
from app.models.user import User
from app.orchestrator import scan_status
from app.repositories.deps import (
    get_finding_repository,
    get_repository_repository,
    get_scan_job_repository,
    get_scan_result_repository,
    get_user_repository,
)
from app.repositories.finding_repository import FindingRepository
from app.repositories.repository_repository import RepositoryRepository
from app.repositories.scan_job_repository import ScanJobRepository
from app.repositories.scan_result_repository import ScanResultRepository
from app.repositories.user_repository import UserRepository
from app.schemas.compliance import (
    ComplianceControlResultSchema,
    ComplianceEngineResultSchema,
    ComplianceEvidenceSchema,
    FrameworkComplianceReportSchema,
)
from app.schemas.finding import ComplianceMappingSchema, FindingResponse, FindingsListResponse, RawFinding
from app.schemas.scan_job import (
    ScanJobCreateResponse,
    ScanJobListResponse,
    ScanJobStatusResponse,
    ScanJobSubmitRequest,
)
from app.services.ai import ai_engine
from app.services.compliance.compliance_engine import ComplianceEngineResult, evaluate_compliance
from app.services.compliance.compliance_mapper import map_finding_to_compliance
from app.services.scan_intake import queue_and_dispatch, submit_repository_scan
from app.workers.celery_app import celery_app

router = APIRouter()
settings = get_settings()
logger = structlog.get_logger(__name__)


# ── Helpers ────────────────────────────────────────────────────────────────────
# `detect_provider`/`queue_and_dispatch`/`submit_repository_scan` live in
# app/services/scan_intake.py — shared with the GitHub webhook receiver
# (app/api/v1/endpoints/webhooks.py) so a repeat submission of the same
# URL, whether typed by hand or delivered by a push event, always resolves
# to the same Repository row instead of each caller minting its own.


def _to_status_response(
    job: ScanJob, repository: Optional[Repository], result: Optional[ScanResult]
) -> ScanJobStatusResponse:
    return ScanJobStatusResponse(
        scan_job_id=job.id,
        repository_id=job.repository_id,
        repository_name=repository.name if repository else "unknown",
        status=job.status,
        priority=job.priority,
        progress_percent=job.progress_percent,
        current_stage=job.current_stage,
        retry_count=job.retry_count,
        max_retries=job.max_retries,
        timeout_seconds=job.timeout_seconds,
        queued_at=job.queued_at,
        started_at=job.started_at,
        finished_at=job.finished_at,
        last_heartbeat_at=job.last_heartbeat_at,
        archived_at=job.archived_at,
        error_message=job.error_message,
        total_findings=result.total_findings if result else None,
        brs_score=result.brs_score if result else None,
        brs_risk_level=result.brs_risk_level if result else None,
        attack_surface_exposure_score=result.attack_surface_exposure_score if result else None,
        attack_surface_exposure_level=result.attack_surface_exposure_level if result else None,
        summary=result.summary if result else None,
        worker_status=scan_status.get_worker_status(str(job.id)),
    )


def _to_finding_response(finding: Finding) -> FindingResponse:
    compliance = None
    if finding.rbi_clause or finding.pci_clause or finding.swift_clause:
        compliance = ComplianceMappingSchema(
            rbi_clause=finding.rbi_clause,
            pci_clause=finding.pci_clause,
            swift_clause=finding.swift_clause,
        )
    return FindingResponse(
        id=finding.id,
        scan_job_id=finding.scan_job_id,
        title=finding.title,
        severity=finding.severity,
        category=finding.category,
        source=finding.source,
        cvss=finding.cvss,
        brs=finding.brs,
        brs_risk_level=finding.brs_risk_level,
        file_path=finding.file_path,
        line_number=finding.line_number,
        description=finding.description,
        package=finding.package,
        package_version=finding.package_version,
        cve=finding.cve,
        ai_explanation=finding.ai_explanation,
        ai_business_impact=finding.ai_business_impact,
        ai_remediation=finding.ai_remediation,
        compliance=compliance,
        sources=finding.sources,
        occurrence_count=finding.occurrence_count,
        cwe_id=finding.cwe_id,
        cwe_name=finding.cwe_name,
        owasp_category=finding.owasp_category,
        owasp_name=finding.owasp_name,
        mitre_technique_ids=finding.mitre_technique_ids,
    )


# ── Submit: zip upload ──────────────────────────────────────────────────────────

@router.post("/scan", response_model=ScanJobCreateResponse)
async def upload_repo(
    file: Annotated[UploadFile, File(...)],
    repositories: Annotated[RepositoryRepository, Depends(get_repository_repository)],
    scan_jobs: Annotated[ScanJobRepository, Depends(get_scan_job_repository)],
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_permission(Permission.SCAN_CREATE))],
    priority: Annotated[ScanJobPriority, Form()] = ScanJobPriority.NORMAL,
    max_retries: Annotated[int, Form(ge=0, le=10)] = 2,
    timeout_seconds: Annotated[int, Form(ge=30, le=7200)] = 900,
):
    """Upload a repository ZIP file to start a DevSecOps scan."""
    if not file.filename.endswith(".zip"):
        raise HTTPException(status_code=400, detail="Only .zip files are supported.")

    repo_name = file.filename.replace(".zip", "")
    repository = await repositories.create(
        name=repo_name, provider=RepoProviderType.UPLOAD, owner_id=current_user.id
    )
    job = await scan_jobs.create_queued(
        repository_id=repository.id,
        owner_id=current_user.id,
        priority=priority,
        max_retries=max_retries,
        timeout_seconds=timeout_seconds,
    )

    zip_path = Path(settings.upload_dir) / f"{job.id}.zip"
    zip_path.parent.mkdir(parents=True, exist_ok=True)

    try:
        with open(zip_path, "wb") as buffer:
            while content := await file.read(1024 * 1024):
                buffer.write(content)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to save uploaded file: {exc}")

    job.artifact_path = str(zip_path)
    await queue_and_dispatch(job, scan_jobs, db)

    return ScanJobCreateResponse(
        scan_job_id=job.id, repository_id=repository.id, status=job.status, priority=job.priority
    )


# ── Submit: repository URL ───────────────────────────────────────────────────────

@router.post("/scan/repository", response_model=ScanJobCreateResponse)
async def submit_repository(
    payload: ScanJobSubmitRequest,
    repositories: Annotated[RepositoryRepository, Depends(get_repository_repository)],
    scan_jobs: Annotated[ScanJobRepository, Depends(get_scan_job_repository)],
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_permission(Permission.SCAN_CREATE))],
):
    """
    Submit a repository by URL: validate it, resolve (or reuse) its
    Repository row, create a queued ScanJob, and return immediately. The
    archive download and the 9-scanner fan-out run asynchronously — see
    app/tasks/scan_tasks.py. Submitting the same URL again reuses the same
    Repository row (see app/services/scan_intake.py) rather than creating
    a duplicate.
    """
    repository, job = await submit_repository_scan(
        repo_url=payload.repo_url,
        ref=payload.ref,
        priority=payload.priority,
        max_retries=payload.max_retries,
        timeout_seconds=payload.timeout_seconds,
        owner_id=current_user.id,
        repositories=repositories,
        scan_jobs=scan_jobs,
        db=db,
    )

    return ScanJobCreateResponse(
        scan_job_id=job.id,
        repository_id=repository.id,
        status=job.status,
        priority=job.priority,
        message="Repository validated, scan job queued",
    )


# ── Submit: premade sandbox payload ───────────────────────────────────────────────

@router.post("/scan/premade/{risk_level}", response_model=ScanJobCreateResponse)
async def trigger_premade_scan(
    risk_level: str,
    repositories: Annotated[RepositoryRepository, Depends(get_repository_repository)],
    scan_jobs: Annotated[ScanJobRepository, Depends(get_scan_job_repository)],
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_permission(Permission.SCAN_CREATE))],
):
    """Trigger a scan for one of the pre-made benchmark repositories: very_low, low, medium, high, or critical."""
    valid_risks = {"very_low", "low", "medium", "high", "critical"}
    if risk_level not in valid_risks:
        raise HTTPException(status_code=400, detail=f"Invalid risk level. Must be one of: {valid_risks}")

    premade_filename = f"{risk_level}_risk.zip"
    premade_zip_path = Path(settings.data_dir) / "payloads" / premade_filename

    if not premade_zip_path.exists():
        from app.utils.payload_generator import generate_premade_payloads

        generate_premade_payloads(Path(settings.data_dir))
        if not premade_zip_path.exists():
            raise HTTPException(status_code=500, detail=f"Pre-made payload file '{premade_filename}' not found.")

    repo_name = f"premade_{risk_level}_risk"
    repository = await repositories.create(
        name=repo_name, provider=RepoProviderType.UPLOAD, owner_id=current_user.id
    )
    job = await scan_jobs.create_queued(repository_id=repository.id, owner_id=current_user.id)

    zip_path = Path(settings.upload_dir) / f"{job.id}.zip"
    zip_path.parent.mkdir(parents=True, exist_ok=True)

    try:
        shutil.copy2(premade_zip_path, zip_path)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to copy pre-made payload: {exc}")

    job.artifact_path = str(zip_path)
    await queue_and_dispatch(job, scan_jobs, db)

    return ScanJobCreateResponse(
        scan_job_id=job.id,
        repository_id=repository.id,
        status=job.status,
        priority=job.priority,
        message=f"Premade {risk_level} risk scan initiated successfully",
    )


# ── Status / list / cancel / findings ────────────────────────────────────────────

@router.get("/scan", response_model=ScanJobListResponse)
async def list_scan_jobs(
    scan_jobs: Annotated[ScanJobRepository, Depends(get_scan_job_repository)],
    repositories: Annotated[RepositoryRepository, Depends(get_repository_repository)],
    results: Annotated[ScanResultRepository, Depends(get_scan_result_repository)],
    current_user: Annotated[User, Depends(get_current_active_user)],
    status: Annotated[Optional[ScanJobStatus], Query()] = None,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
):
    """List the current user's scan jobs, optionally filtered by status."""
    jobs = await scan_jobs.list_by_owner(current_user.id, status=status, limit=limit, offset=offset)

    responses = []
    for job in jobs:
        repository = await repositories.get(job.repository_id)
        result = await results.get_by_scan_job(job.id)
        responses.append(_to_status_response(job, repository, result))

    return ScanJobListResponse(total=len(responses), scan_jobs=responses)


@router.get("/scan/{scan_job_id}", response_model=ScanJobStatusResponse)
async def get_scan_job_status(
    scan_job_id: uuid.UUID,
    scan_jobs: Annotated[ScanJobRepository, Depends(get_scan_job_repository)],
    repositories: Annotated[RepositoryRepository, Depends(get_repository_repository)],
    results: Annotated[ScanResultRepository, Depends(get_scan_result_repository)],
    current_user: Annotated[User, Depends(get_current_active_user)],
):
    """Get the current status/progress of a scan job, including BRS and Attack Surface Exposure scores once completed."""
    job = await scan_jobs.get(scan_job_id)
    if not job:
        raise NotFoundError("Scan job not found")

    repository = await repositories.get(job.repository_id)
    result = await results.get_by_scan_job(scan_job_id)

    return _to_status_response(job, repository, result)


@router.post("/scan/{scan_job_id}/cancel", response_model=ScanJobStatusResponse)
async def cancel_scan_job(
    scan_job_id: uuid.UUID,
    scan_jobs: Annotated[ScanJobRepository, Depends(get_scan_job_repository)],
    repositories: Annotated[RepositoryRepository, Depends(get_repository_repository)],
    results: Annotated[ScanResultRepository, Depends(get_scan_result_repository)],
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_permission(Permission.SCAN_CANCEL))],
):
    """
    Request cancellation. A QUEUED job is cancelled outright. A RUNNING
    job gets two things: every in-flight scanner task (semgrep, ast-grep,
    etc.) is revoked via Celery's control plane — `terminate=True` sends
    SIGTERM to a task already executing, not just a "don't start" marker
    for one still queued — and a Redis flag is set that each scanner task
    also checks cooperatively at its own start, in case a task is
    revoked before it's even been picked up by a worker. Jobs already in
    a terminal state are returned unchanged.
    """
    job = await scan_jobs.get(scan_job_id)
    if not job:
        raise NotFoundError("Scan job not found")

    if job.status in (ScanJobStatus.QUEUED, ScanJobStatus.RUNNING):
        await scan_jobs.mark_cancelled(job)
        await db.commit()

        scan_status.mark_cancelled(str(scan_job_id))
        for task_id in scan_status.get_all_task_ids(str(scan_job_id)):
            celery_app.control.revoke(task_id, terminate=True, signal="SIGTERM")

    repository = await repositories.get(job.repository_id)
    result = await results.get_by_scan_job(scan_job_id)
    return _to_status_response(job, repository, result)


_TERMINAL_STATUSES = {ScanJobStatus.COMPLETED.value, ScanJobStatus.FAILED.value, ScanJobStatus.CANCELLED.value}


@router.websocket("/scan/{scan_job_id}/ws")
async def scan_progress_ws(
    websocket: WebSocket,
    scan_job_id: uuid.UUID,
    scan_jobs: Annotated[ScanJobRepository, Depends(get_scan_job_repository)],
    repositories: Annotated[RepositoryRepository, Depends(get_repository_repository)],
    results: Annotated[ScanResultRepository, Depends(get_scan_result_repository)],
    users: Annotated[UserRepository, Depends(get_user_repository)],
):
    """
    Push-based alternative to polling `GET /scan/{scan_job_id}`. Browsers
    can't set an `Authorization` header on a WebSocket handshake, so the
    access token travels as `?token=...` instead and is validated by hand
    here (mirrors `get_current_user`, just adapted for `WebSocket` instead
    of `Request`).

    Sends one status snapshot immediately, then forwards every
    `app.orchestrator.scan_status.publish_update` event — from both
    per-scanner progress (`scanner_tasks.py`) and job-level lifecycle
    transitions (`scan_job_repository.py`) — until the job reaches a
    terminal state (one final snapshot is sent first) or the client
    disconnects.
    """
    token = websocket.query_params.get("token")
    if not token:
        await websocket.close(code=4401)
        return

    try:
        payload = decode_token(token)
        if payload.get("type") != "access":
            raise ValueError("not an access token")
        user = await users.get(uuid.UUID(payload["sub"]))
        if user is None or not user.is_active:
            raise ValueError("inactive or unknown user")
    except (JWTError, ValueError, KeyError):
        await websocket.close(code=4401)
        return

    job = await scan_jobs.get(scan_job_id)
    if job is None:
        await websocket.close(code=4404)
        return

    await websocket.accept()

    async def send_snapshot(current_job: ScanJob) -> None:
        repository = await repositories.get(current_job.repository_id)
        result = await results.get_by_scan_job(scan_job_id)
        await websocket.send_json(_to_status_response(current_job, repository, result).model_dump(mode="json"))

    await send_snapshot(job)

    if job.status.value in _TERMINAL_STATUSES:
        await websocket.close(code=1000)
        return

    redis_client = redis_asyncio.from_url(settings.redis_url, decode_responses=True)
    pubsub = redis_client.pubsub()
    channel = scan_status.updates_channel(str(scan_job_id))
    await pubsub.subscribe(channel)

    try:
        while True:
            try:
                message = await pubsub.get_message(ignore_subscribe_messages=True, timeout=25.0)
            except asyncio.CancelledError:
                raise
            if message is None:
                # No event in the last 25s — a lightweight keepalive that
                # also surfaces a client-side disconnect promptly instead
                # of waiting on the next real scan event.
                await websocket.send_json({"type": "ping"})
                continue

            event = json.loads(message["data"])
            await websocket.send_json(event)

            if event.get("type") == "job_status" and event.get("status") in _TERMINAL_STATUSES:
                # `fresh=True`: `job` (loaded once, above, when the socket
                # connected) is already in this session's identity map, so a
                # plain `.get()` here would silently hand back that same
                # stale object instead of re-querying — see the docstring on
                # ScanJobRepository.get().
                fresh_job = await scan_jobs.get(scan_job_id, fresh=True)
                if fresh_job is not None:
                    await send_snapshot(fresh_job)
                break
    except WebSocketDisconnect:
        pass
    finally:
        await pubsub.unsubscribe(channel)
        await pubsub.aclose()
        await redis_client.aclose()
        try:
            await websocket.close()
        except RuntimeError:
            pass  # already closed (e.g. client disconnected first)


@router.get("/scan/{scan_job_id}/findings", response_model=FindingsListResponse)
async def get_scan_job_findings(
    scan_job_id: uuid.UUID,
    scan_jobs: Annotated[ScanJobRepository, Depends(get_scan_job_repository)],
    findings_repo: Annotated[FindingRepository, Depends(get_finding_repository)],
    current_user: Annotated[User, Depends(get_current_active_user)],
):
    """Retrieve all findings for a given scan job, including AI insights and compliance mappings."""
    job = await scan_jobs.get(scan_job_id)
    if not job:
        raise NotFoundError("Scan job not found")

    findings = await findings_repo.list_by_scan_job(scan_job_id)

    return FindingsListResponse(
        scan_job_id=job.id,
        total=len(findings),
        findings=[_to_finding_response(f) for f in findings],
    )


def _finding_to_raw(finding: Finding) -> RawFinding:
    """The compliance engine takes list[RawFinding] — a persisted Finding
    row has every field it needs, just not as that exact type."""
    return RawFinding(
        title=finding.title,
        severity=finding.severity,
        category=finding.category,
        source=finding.source,
        cvss=finding.cvss,
        file_path=finding.file_path,
        line_number=finding.line_number,
        description=finding.description,
        package=finding.package,
        package_version=finding.package_version,
        cve=finding.cve,
    )


def _to_compliance_response(scan_job_id: uuid.UUID, result: ComplianceEngineResult) -> ComplianceEngineResultSchema:
    return ComplianceEngineResultSchema(
        scan_job_id=str(scan_job_id),
        overall_compliance_percentage=result.overall_compliance_percentage,
        frameworks=[
            FrameworkComplianceReportSchema(
                framework_name=r.framework_name,
                short_code=r.short_code,
                version=r.version,
                total_controls=r.total_controls,
                passed_controls=r.passed_controls,
                failed_controls=r.failed_controls,
                compliance_percentage=r.compliance_percentage,
                controls=[
                    ComplianceControlResultSchema(
                        requirement_id=c.requirement_id,
                        title=c.title,
                        description=c.description,
                        status=c.status,
                        recommendation=c.recommendation,
                        evidence=[
                            ComplianceEvidenceSchema(
                                finding_title=e.finding_title,
                                severity=e.severity,
                                file_path=e.file_path,
                                line_number=e.line_number,
                                source=e.source,
                            )
                            for e in c.evidence
                        ],
                    )
                    for c in r.controls
                ],
            )
            for r in result.frameworks
        ],
    )


@router.get("/scan/{scan_job_id}/compliance", response_model=ComplianceEngineResultSchema)
async def get_scan_job_compliance(
    scan_job_id: uuid.UUID,
    scan_jobs: Annotated[ScanJobRepository, Depends(get_scan_job_repository)],
    findings_repo: Annotated[FindingRepository, Depends(get_finding_repository)],
    current_user: Annotated[User, Depends(get_current_active_user)],
):
    """
    Live PCI DSS v4.0 / RBI IT Framework / SWIFT CSP compliance evaluation,
    recomputed on demand from this scan's persisted findings rather than a
    frozen snapshot. Because the rule catalog is YAML
    (app/data/compliance_rules/), editing a rule file changes this
    endpoint's answer immediately without re-running the scan — the
    frozen point-in-time record from when the scan actually completed is
    the downloadable 'compliance_report' artifact instead
    (GET /reports/{scan_job_id}/download/compliance_report).
    """
    job = await scan_jobs.get(scan_job_id)
    if not job:
        raise NotFoundError("Scan job not found")

    findings = await findings_repo.list_by_scan_job(scan_job_id)
    raw_findings = [_finding_to_raw(f) for f in findings]

    result = evaluate_compliance(raw_findings)
    return _to_compliance_response(scan_job_id, result)


def _sse_pack(data: str, *, event: Optional[str] = None) -> str:
    prefix = f"event: {event}\n" if event else ""
    # Every line of a multi-line SSE payload needs its own "data: " prefix.
    data_lines = "\n".join(f"data: {line}" for line in data.split("\n"))
    return f"{prefix}{data_lines}\n\n"


@router.get("/scan/{scan_job_id}/findings/{finding_id}/explain/stream")
async def stream_finding_explanation(
    scan_job_id: uuid.UUID,
    finding_id: uuid.UUID,
    scan_jobs: Annotated[ScanJobRepository, Depends(get_scan_job_repository)],
    findings_repo: Annotated[FindingRepository, Depends(get_finding_repository)],
    current_user: Annotated[User, Depends(get_current_active_user)],
):
    """
    Server-Sent Events stream of an AI-generated, plain-prose explanation
    for a single finding (see `ai_engine.explain_vulnerability_stream`).

    Provider selection follows `AI_MODE` (see app/config.py): in the
    default "hybrid" mode, a local Ollama/vLLM model is tried first and
    cloud providers (Claude/OpenAI/Gemini) are the fallback if no local
    model is reachable — "local" or "cloud" modes restrict to just one
    side. Emits a single `error` event (not an HTTP error) if no provider
    is configured or reachable, since the connection is already open as
    an event stream at that point; the non-streaming
    `GET /scan/{scan_job_id}/findings` endpoint always has a deterministic
    template answer regardless of AI availability, if a caller needs a
    guaranteed non-empty explanation instead of best-effort streaming.
    """
    job = await scan_jobs.get(scan_job_id)
    if not job:
        raise NotFoundError("Scan job not found")

    finding = await findings_repo.get_by_id(finding_id)
    if not finding or finding.scan_job_id != scan_job_id:
        raise NotFoundError("Finding not found for this scan job")

    raw_finding = _finding_to_raw(finding)
    compliance = map_finding_to_compliance(raw_finding)

    def _event_source():
        try:
            chunk_iter = ai_engine.explain_vulnerability_stream(raw_finding, compliance)
            if chunk_iter is None:
                yield _sse_pack("No AI provider is configured or reachable.", event="error")
                return
            for chunk in chunk_iter:
                yield _sse_pack(chunk)
            yield _sse_pack("", event="done")
        except Exception as exc:
            logger.warning("scan_api.explain_stream_failed", scan_job_id=str(scan_job_id), error=str(exc))
            yield _sse_pack("The explanation stream failed part-way through.", event="error")

    return StreamingResponse(
        _event_source(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
