"""
KAVACH — Scan API Routes
Handles uploading repositories and retrieving scan findings.
"""

import uuid
from pathlib import Path
from typing import Annotated
from datetime import datetime, timezone

from fastapi import APIRouter, UploadFile, File, BackgroundTasks, HTTPException

from app.schemas.scan import ScanCreateResponse, ScanStatusResponse
from app.schemas.finding import FindingsListResponse
from app.config import get_settings
from app.services.scan_orchestrator import execute_scan
from app.storage import local_store

router = APIRouter()
settings = get_settings()


@router.post("/scan", response_model=ScanCreateResponse)
async def upload_repo(
    background_tasks: BackgroundTasks,
    file: Annotated[UploadFile, File(...)],
):
    """
    Upload a repository ZIP file to start a DevSecOps scan.
    """
    if not file.filename.endswith('.zip'):
        raise HTTPException(status_code=400, detail="Only .zip files are supported.")

    # 1. Create Scan record in JSON store
    scan_id = str(uuid.uuid4())
    repo_name = file.filename.replace(".zip", "")
    
    scan_data = {
        "scan_id": scan_id,
        "repo_name": repo_name,
        "status": "pending",
        "total_findings": 0,
        "brs_score": None,
        "brs_risk_level": None,
        "zero_day_risk_score": None,
        "zero_day_risk_level": None,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "completed_at": None,
        "error_message": None,
    }
    local_store.save_scan(scan_data)

    # 2. Save uploaded file to disk
    zip_path = Path(settings.upload_dir) / f"{scan_id}.zip"
    zip_path.parent.mkdir(parents=True, exist_ok=True)
    
    try:
        with open(zip_path, "wb") as buffer:
            while content := await file.read(1024 * 1024):
                buffer.write(content)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to save uploaded file: {exc}")

    # 3. Queue the background pipeline task
    background_tasks.add_task(execute_scan, scan_id, zip_path)

    return ScanCreateResponse(scan_id=scan_id, message="Scan initiated successfully", status="pending")


@router.post("/scan/premade/{risk_level}", response_model=ScanCreateResponse)
async def trigger_premade_scan(
    risk_level: str,
    background_tasks: BackgroundTasks,
):
    """
    Trigger a scan for one of the pre-made sample repositories: low, medium, or high.
    """
    valid_risks = {"low", "medium", "high"}
    if risk_level not in valid_risks:
        raise HTTPException(status_code=400, detail=f"Invalid risk level. Must be one of: {valid_risks}")

    premade_filename = f"{risk_level}_risk.zip"
    premade_zip_path = Path(settings.data_dir) / "payloads" / premade_filename

    if not premade_zip_path.exists():
        # Fallback to recreate if missing
        from app.utils.payload_generator import generate_premade_payloads
        generate_premade_payloads(Path(settings.data_dir))
        if not premade_zip_path.exists():
            raise HTTPException(status_code=500, detail=f"Pre-made payload file '{premade_filename}' not found.")

    # 1. Create Scan record
    scan_id = str(uuid.uuid4())
    repo_name = f"premade_{risk_level}_risk"
    
    scan_data = {
        "scan_id": scan_id,
        "repo_name": repo_name,
        "status": "pending",
        "total_findings": 0,
        "brs_score": None,
        "brs_risk_level": None,
        "zero_day_risk_score": None,
        "zero_day_risk_level": None,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "completed_at": None,
        "error_message": None,
    }
    local_store.save_scan(scan_data)

    # 2. Copy the pre-made ZIP to standard upload location
    zip_path = Path(settings.upload_dir) / f"{scan_id}.zip"
    zip_path.parent.mkdir(parents=True, exist_ok=True)
    
    try:
        import shutil
        shutil.copy2(premade_zip_path, zip_path)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to copy pre-made payload: {exc}")

    # 3. Queue the background pipeline task
    background_tasks.add_task(execute_scan, scan_id, zip_path)

    return ScanCreateResponse(scan_id=scan_id, message=f"Premade {risk_level} risk scan initiated successfully", status="pending")


@router.get("/scan/{scan_id}", response_model=ScanStatusResponse)
async def get_scan_status(scan_id: uuid.UUID):
    """
    Get the current status of a scan, including BRS and Zero-Day risk scores if completed.
    """
    scan = local_store.get_scan(str(scan_id))
    if not scan:
        raise HTTPException(status_code=404, detail="Scan not found")
    
    return ScanStatusResponse(**scan)


@router.get("/findings/{scan_id}", response_model=FindingsListResponse)
async def get_scan_findings(scan_id: uuid.UUID):
    """
    Retrieve all findings for a given scan, including AI insights and compliance mappings.
    """
    scan = local_store.get_scan(str(scan_id))
    if not scan:
        raise HTTPException(status_code=404, detail="Scan not found")

    findings = local_store.get_findings(str(scan_id))

    return FindingsListResponse(
        scan_id=scan["scan_id"],
        total=len(findings),
        findings=findings
    )
