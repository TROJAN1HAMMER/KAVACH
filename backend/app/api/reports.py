"""
KAVACH — Reports API Routes
Handles serving generated PDFs, SBOMs, and SARIF exports.
"""

import uuid
from pathlib import Path

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

from app.schemas.scan import ReportPathsResponse
from app.storage import local_store

router = APIRouter()


@router.get("/reports/{scan_id}", response_model=ReportPathsResponse)
async def get_report_status(scan_id: uuid.UUID):
    """
    Check which reports are available for download for a given scan.
    """
    scan = local_store.get_scan(str(scan_id))
    
    if not scan:
        raise HTTPException(status_code=404, detail="Scan not found")
        
    reports = local_store.get_reports(str(scan_id))
    types = [r["report_type"] for r in reports]
    
    return ReportPathsResponse(
        scan_id=scan["scan_id"],
        pdf_available="pdf" in types,
        sarif_available="sarif" in types,
        sbom_available="sbom" in types
    )


@router.get("/reports/{scan_id}/download/{report_type}")
async def download_report(scan_id: uuid.UUID, report_type: str):
    """
    Download a specific generated report (pdf, sarif, or sbom).
    """
    if report_type not in ["pdf", "sarif", "sbom"]:
        raise HTTPException(status_code=400, detail="Invalid report type")

    reports = local_store.get_reports(str(scan_id))
    report = next((r for r in reports if r["report_type"] == report_type), None)
    
    if not report:
        raise HTTPException(status_code=404, detail=f"{report_type.upper()} report not found for this scan")

    file_path = Path(report["file_path"])
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Report file missing on disk")

    media_type = "application/pdf" if report_type == "pdf" else "application/json"
    filename = file_path.name
    
    return FileResponse(
        path=file_path, 
        media_type=media_type, 
        filename=filename, 
        content_disposition_type="attachment"
    )
