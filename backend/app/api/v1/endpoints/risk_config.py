"""
KAVACH — Risk Configuration API Routes
Runtime, no-deploy-required control over the BRS engine's business
modules and per-factor weights, plus a score-preview endpoint that runs
a synthetic finding through the *current* DB configuration — the fastest
way to see what a weight/module change would actually do before it hits
a real scan.
"""

from typing import Annotated

from fastapi import APIRouter, Depends

from app.auth.dependencies import get_current_active_user
from app.auth.permissions import Permission, require_permission
from app.core.exceptions import ConflictError, NotFoundError, ValidationAppError
from app.models.user import User
from app.repositories.business_module_repository import BusinessModuleRepository
from app.repositories.deps import get_business_module_repository, get_risk_factor_weight_repository
from app.repositories.risk_factor_weight_repository import RiskFactorWeightRepository
from app.schemas.finding import RawFinding
from app.schemas.risk_config import (
    BusinessModuleCreateRequest,
    BusinessModuleResponse,
    BusinessModuleUpdateRequest,
    RiskFactorWeightResponse,
    RiskFactorWeightUpsertRequest,
    ScorePreviewRequest,
    ScorePreviewResponse,
)
from app.services.risk.brs_engine import classify_module, score_finding

router = APIRouter()


# ── Business Modules ───────────────────────────────────────────────────────────

@router.get("/risk/modules", response_model=list[BusinessModuleResponse])
async def list_business_modules(
    modules: Annotated[BusinessModuleRepository, Depends(get_business_module_repository)],
    current_user: Annotated[User, Depends(get_current_active_user)],
):
    """List every configured business module — the DB-driven replacement for the old hardcoded MODULE_WEIGHTS."""
    return await modules.list_all()


@router.post("/risk/modules", response_model=BusinessModuleResponse, status_code=201)
async def create_business_module(
    payload: BusinessModuleCreateRequest,
    modules: Annotated[BusinessModuleRepository, Depends(get_business_module_repository)],
    current_user: Annotated[User, Depends(require_permission(Permission.RISK_CONFIG_WRITE))],
):
    """Add a new business module — this is what 'fully extensible' means in practice: no code change, no deploy."""
    existing = await modules.get_by_name(payload.name)
    if existing:
        raise ConflictError(f"A business module named '{payload.name}' already exists")

    return await modules.create(
        name=payload.name,
        keywords=payload.keywords,
        criticality_weight=payload.criticality_weight,
        asset_value=payload.asset_value,
        is_internet_facing_default=payload.is_internet_facing_default,
        is_default=payload.is_default,
        description=payload.description,
    )


@router.patch("/risk/modules/{module_name}", response_model=BusinessModuleResponse)
async def update_business_module(
    module_name: str,
    payload: BusinessModuleUpdateRequest,
    modules: Annotated[BusinessModuleRepository, Depends(get_business_module_repository)],
    current_user: Annotated[User, Depends(require_permission(Permission.RISK_CONFIG_WRITE))],
):
    """Adjust a module's weights/keywords — takes effect on the very next scan, no deploy."""
    module = await modules.get_by_name(module_name)
    if not module:
        raise NotFoundError(f"Business module '{module_name}' not found")

    return await modules.update(
        module,
        keywords=payload.keywords,
        criticality_weight=payload.criticality_weight,
        asset_value=payload.asset_value,
        is_internet_facing_default=payload.is_internet_facing_default,
        description=payload.description,
    )


@router.delete("/risk/modules/{module_name}", status_code=204)
async def delete_business_module(
    module_name: str,
    modules: Annotated[BusinessModuleRepository, Depends(get_business_module_repository)],
    current_user: Annotated[User, Depends(require_permission(Permission.RISK_CONFIG_WRITE))],
):
    """Remove a module. The fallback ('General', is_default=True) can't be deleted — scoring needs
    somewhere to land a finding that matches no other module's keywords."""
    module = await modules.get_by_name(module_name)
    if not module:
        raise NotFoundError(f"Business module '{module_name}' not found")
    if module.is_default:
        raise ValidationAppError("Cannot delete the default fallback module")

    await modules.delete(module)


# ── Risk Factor Weights ─────────────────────────────────────────────────────────

@router.get("/risk/factor-weights", response_model=list[RiskFactorWeightResponse])
async def list_risk_factor_weights(
    weights: Annotated[RiskFactorWeightRepository, Depends(get_risk_factor_weight_repository)],
    current_user: Annotated[User, Depends(get_current_active_user)],
):
    """List every factor's weight in the BRS blend (CVSS, exploitability, business criticality, ...)."""
    return await weights.list_all()


@router.patch("/risk/factor-weights/{factor_name}", response_model=RiskFactorWeightResponse)
async def update_risk_factor_weight(
    factor_name: str,
    payload: RiskFactorWeightUpsertRequest,
    weights: Annotated[RiskFactorWeightRepository, Depends(get_risk_factor_weight_repository)],
    current_user: Annotated[User, Depends(require_permission(Permission.RISK_CONFIG_WRITE))],
):
    """
    Set a factor's weight — 0 disables it entirely (the blend normalizes
    by the sum of active weights, so this is safe). Upserts: naming a
    factor that doesn't exist yet creates it, which is how a newly
    code-added factor (see brs_engine.py's registry note) gets its
    default weight without a migration.
    """
    return await weights.upsert(factor_name=factor_name, weight=payload.weight, description=payload.description)


# ── Score Preview ───────────────────────────────────────────────────────────────

@router.post("/risk/preview", response_model=ScorePreviewResponse)
async def preview_score(
    payload: ScorePreviewRequest,
    modules_repo: Annotated[BusinessModuleRepository, Depends(get_business_module_repository)],
    weights_repo: Annotated[RiskFactorWeightRepository, Depends(get_risk_factor_weight_repository)],
    current_user: Annotated[User, Depends(require_permission(Permission.RISK_CONFIG_READ))],
):
    """
    Score a synthetic finding against the *current* database configuration
    — the concrete way to see what changing a module's criticality_weight
    or a factor's weight actually does before it affects a real scan.
    Reuses brs_engine's own DB-loaders (repo-backed, falling back to
    defaults if unconfigured) rather than duplicating that logic here.
    """
    from app.services.risk.brs_engine import _load_factor_weights, _load_modules

    modules = await _load_modules(modules_repo.db)
    factor_weights = await _load_factor_weights(weights_repo.db)

    finding = RawFinding(
        title=payload.title,
        severity=payload.severity,
        category=payload.category,
        source="preview",
        cvss=payload.cvss,
        file_path=payload.file_path,
        description=payload.description,
        cve=payload.cve,
    )

    module = classify_module(finding, modules)
    score = score_finding(
        finding,
        module=module,
        factor_weights=factor_weights,
        compliance_framework_count=payload.compliance_framework_count,
        historical_incident_count=payload.historical_incident_count,
    )

    return ScorePreviewResponse(
        brs=score.brs,
        module=score.module,
        sub_scores=score.sub_scores,
        factor_weights={
            "cvss": factor_weights.cvss,
            "exploitability": factor_weights.exploitability,
            "business_criticality": factor_weights.business_criticality,
            "internet_exposure": factor_weights.internet_exposure,
            "compliance_impact": factor_weights.compliance_impact,
            "asset_value": factor_weights.asset_value,
            "historical_incidents": factor_weights.historical_incidents,
        },
    )
