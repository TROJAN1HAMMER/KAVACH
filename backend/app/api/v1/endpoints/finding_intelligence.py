"""
KAVACH — Finding Intelligence Routes (RAG Milestone 3)
"""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_active_user
from app.core.exceptions import NotFoundError
from app.db.session import get_db
from app.middleware.rate_limit import require_rate_limit
from app.models.finding import Finding
from app.models.user import User
from app.repositories.deps import get_finding_repository
from app.repositories.finding_repository import FindingRepository
from app.schemas.finding import RawFinding
from app.schemas.finding_intelligence import FindingIntelligenceResponse
from app.services.finding_intelligence import intelligence_service

router = APIRouter()

_RATE_LIMIT = require_rate_limit("finding_intelligence", limit=30, window_seconds=60)


def _finding_to_raw(finding: Finding) -> RawFinding:
    """Mirrors app/api/v1/endpoints/scan.py's own private helper of the
    same name — small and stable enough that duplicating it here beats
    extracting a shared module for one extra call site (the same
    reasoning that file's own `_sse_pack` duplication follows)."""
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


@router.get("/findings/{finding_id}/intelligence", response_model=FindingIntelligenceResponse)
async def get_finding_intelligence(
    finding_id: uuid.UUID,
    findings_repo: Annotated[FindingRepository, Depends(get_finding_repository)],
    db: Annotated[AsyncSession, Depends(get_db)],
    _current_user: Annotated[User, Depends(get_current_active_user)],
    _rate_limited: Annotated[User, Depends(_RATE_LIMIT)],
):
    """
    Grounded, structured explanation of a finding via the knowledge base
    (see docs/finding_intelligence.md). Gated the same way every other
    finding-read endpoint in scan.py is (`get_current_active_user`, no
    finer-grained permission) — the frontend's route-level RBAC already
    limits who reaches the Finding Explorer page this lives under.
    """
    finding = await findings_repo.get_by_id(finding_id)
    if finding is None:
        raise NotFoundError(f"Finding '{finding_id}' not found.")

    raw = _finding_to_raw(finding)
    result = await intelligence_service.build_intelligence(db, finding=finding, raw=raw)
    return FindingIntelligenceResponse(
        finding_id=result.finding_id,
        cwe_id=result.cwe_id,
        cwe_name=result.cwe_name,
        owasp_category=result.owasp_category,
        owasp_name=result.owasp_name,
        mitre_technique_ids=result.mitre_technique_ids,
        pci_clause=result.pci_clause,
        rbi_clause=result.rbi_clause,
        swift_clause=result.swift_clause,
        why_detected=result.why_detected,
        plain_english_explanation=result.plain_english_explanation,
        business_impact=result.business_impact,
        technical_impact=result.technical_impact,
        recommended_remediation=result.recommended_remediation,
        verification_steps=result.verification_steps,
        code_example=result.code_example,
        citations=[
            {
                "document_id": c.document_id,
                "filename": c.filename,
                "page_number": c.page_number,
                "section_path": c.section_path,
                "heading": c.heading,
                "similarity_score": c.similarity_score,
                "rerank_score": c.rerank_score,
                "excerpt": c.excerpt,
            }
            for c in result.citations
        ],
        confidence=result.confidence,
        retrieved_count=result.retrieved_count,
        grounded=result.grounded,
        note=result.note,
        latency_ms=result.latency_ms,
    )
