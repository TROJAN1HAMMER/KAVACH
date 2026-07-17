"""
KAVACH — Reports API Routes
Handles serving generated PDFs, SARIF/SBOM/CSV/JSON exports.

Persistence via `ReportRepository`/`ScanJobRepository`. Every route
requires a valid JWT via `get_current_active_user`.

Reports are generated asynchronously (see app/tasks/report_tasks.py) —
a `Report` row exists in "pending"/"generating" status before any file is
ready, so `get_report_status` reports per-type status rather than a
boolean "does a row exist", and `download_report` distinguishes "not
started yet" / "still generating" / "failed" from "ready".
"""

import uuid
from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse, RedirectResponse

from app.auth.dependencies import get_current_active_user
from app.core.exceptions import NotFoundError
from app.models.report import Report
from app.models.user import User
from app.repositories.deps import get_report_repository, get_scan_job_repository
from app.repositories.report_repository import ReportRepository
from app.repositories.scan_job_repository import ScanJobRepository
from app.schemas.report import ReportPathsResponse, ReportStatusDetail
from app.services.reports.storage import get_storage

router = APIRouter()

VALID_REPORT_TYPES = [
    "pdf",
    "pdf_technical",
    "sarif",
    "sbom",
    "csv",
    "unified_findings",
    "compliance_report",
]

MEDIA_TYPES = {
    "pdf": "application/pdf",
    "pdf_technical": "application/pdf",
    "csv": "text/csv",
    "sarif": "application/json",
    "sbom": "application/json",
    "unified_findings": "application/json",
    "compliance_report": "application/json",
}


@router.get("/reports/{scan_job_id}", response_model=ReportPathsResponse)
async def get_report_status(
    scan_job_id: uuid.UUID,
    scan_jobs: Annotated[ScanJobRepository, Depends(get_scan_job_repository)],
    reports: Annotated[ReportRepository, Depends(get_report_repository)],
    current_user: Annotated[User, Depends(get_current_active_user)],
):
    """Check which reports are ready for download for a given scan job, and the status of any still in progress."""
    job = await scan_jobs.get(scan_job_id)
    if not job:
        raise NotFoundError("Scan job not found")

    job_reports = await reports.list_by_scan_job(scan_job_id)
    completed_types = {r.report_type for r in job_reports if r.status == "completed"}

    return ReportPathsResponse(
        scan_job_id=job.id,
        pdf_available="pdf" in completed_types,
        pdf_technical_available="pdf_technical" in completed_types,
        sarif_available="sarif" in completed_types,
        sbom_available="sbom" in completed_types,
        unified_findings_available="unified_findings" in completed_types,
        compliance_report_available="compliance_report" in completed_types,
        csv_available="csv" in completed_types,
        reports=[
            ReportStatusDetail(report_type=r.report_type, status=r.status, error_message=r.error_message)
            for r in job_reports
        ],
    )


def _download_response(report: Report, report_type: str):
    media_type = MEDIA_TYPES.get(report_type, "application/octet-stream")

    if report.storage_backend == "s3":
        storage = get_storage()
        ref = storage.get_download_reference(report.storage_key)
        if ref.presigned_url is None:
            raise HTTPException(status_code=502, detail="Could not generate a download URL for this report")
        return RedirectResponse(url=ref.presigned_url, status_code=307)

    file_path = Path(report.file_path)
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Report file missing on disk")

    return FileResponse(
        path=file_path,
        media_type=media_type,
        filename=file_path.name,
        content_disposition_type="attachment",
    )


@router.get("/reports/{scan_job_id}/download/{report_type}")
async def download_report(
    scan_job_id: uuid.UUID,
    report_type: str,
    reports: Annotated[ReportRepository, Depends(get_report_repository)],
    current_user: Annotated[User, Depends(get_current_active_user)],
):
    """
    Download a specific generated report. For the "s3" storage backend
    this redirects (307) to a short-lived presigned URL rather than
    streaming the file through this process; for "local" it streams the
    file directly, unchanged from before S3 support existed.
    """
    if report_type not in VALID_REPORT_TYPES:
        raise HTTPException(status_code=400, detail="Invalid report type")

    report = await reports.get_by_type(scan_job_id, report_type)
    if not report:
        raise HTTPException(status_code=404, detail=f"{report_type.upper()} report not found for this scan job")

    if report.status != "completed":
        detail = (
            f"{report_type.upper()} report failed to generate: {report.error_message}"
            if report.status == "failed"
            else f"{report_type.upper()} report is still {report.status} — try again shortly"
        )
        raise HTTPException(status_code=409, detail=detail)

    return _download_response(report, report_type)
