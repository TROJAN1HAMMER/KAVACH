"""
KAVACH — Unified Finding Model
The aggregation layer's output schema. `UnifiedFinding` is a strict
superset of `RawFinding` — every field the BRS engine, compliance mapper,
zero-day predictor, and report generator already read (`.severity`,
`.cvss`, `.category`, `.file_path`, ...) is still there, unchanged. That's
deliberate: none of that downstream code needs to change to consume
enriched, cross-tool-correlated findings instead of one tool's raw
output — it just keeps working via inheritance.
"""

from typing import Optional

from pydantic import BaseModel, Field

from app.schemas.finding import RawFinding


class CVEDetail(BaseModel):
    cve_id: str
    sources: list[str] = Field(default_factory=list)
    description: Optional[str] = None


class UnifiedFinding(RawFinding):
    finding_id: str  # stable id derived from the cross-tool correlation key

    # `severity`/`cvss` (inherited from RawFinding) are overwritten with
    # the normalized values during enrichment — these two duplicate them
    # under more explicit names for API consumers who want the
    # normalization guarantee spelled out rather than inferred.
    canonical_severity: str
    severity_score: float

    sources: list[str] = Field(default_factory=list)
    occurrence_count: int = 1

    cwe_id: Optional[str] = None
    cwe_name: Optional[str] = None
    owasp_category: Optional[str] = None
    owasp_name: Optional[str] = None
    mitre_technique_ids: list[str] = Field(default_factory=list)
    mitre_technique_names: list[str] = Field(default_factory=list)
    cve_details: list[CVEDetail] = Field(default_factory=list)
