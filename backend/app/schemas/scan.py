"""
KAVACH — Scan Pydantic Schemas
Request / Response DTOs for scan-related endpoints.
"""

import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


# ── Scan Status ───────────────────────────────────────────────────────────────

class ScanStatusResponse(BaseModel):
    scan_id: uuid.UUID
    repo_name: str
    status: str
    total_findings: int
    brs_score: Optional[float] = None
    brs_risk_level: Optional[str] = None
    zero_day_risk_score: Optional[float] = None
    zero_day_risk_level: Optional[str] = None
    created_at: datetime
    completed_at: Optional[datetime] = None
    error_message: Optional[str] = None

    model_config = {"from_attributes": True}


# ── Scan Create Response ──────────────────────────────────────────────────────

class ScanCreateResponse(BaseModel):
    scan_id: uuid.UUID
    message: str = "Scan initiated successfully"
    status: str = "pending"


# ── Report Paths ──────────────────────────────────────────────────────────────

class ReportPathsResponse(BaseModel):
    scan_id: uuid.UUID
    pdf_available: bool
    sarif_available: bool
    sbom_available: bool

    model_config = {"from_attributes": True}
