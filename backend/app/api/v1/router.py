"""
KAVACH — API v1 Router
Aggregates every v1 endpoint router into a single object `main.py` mounts
once at `/api/v1`. Adding a v2 means creating `app/api/v2/` alongside this
file with its own router — v1 keeps serving existing clients unchanged.
"""

from fastapi import APIRouter

from app.api.v1.endpoints.analytics import router as analytics_router
from app.api.v1.endpoints.assistant import router as assistant_router
from app.api.v1.endpoints.executive_intelligence import router as executive_intelligence_router
from app.api.v1.endpoints.finding_intelligence import router as finding_intelligence_router
from app.api.v1.endpoints.knowledge import router as knowledge_router
from app.api.v1.endpoints.rag_operations import router as rag_operations_router
from app.api.v1.endpoints.reports import router as reports_router
from app.api.v1.endpoints.repositories import router as repositories_router
from app.api.v1.endpoints.risk_config import router as risk_config_router
from app.api.v1.endpoints.scan import router as scan_router
from app.api.v1.endpoints.webhooks import router as webhooks_router
from app.auth.admin_router import router as auth_admin_router
from app.auth.router import router as auth_router
from app.auth.sso_router import router as auth_sso_router

api_router = APIRouter()
api_router.include_router(repositories_router, tags=["Repositories"])
api_router.include_router(scan_router, tags=["Scanning"])
api_router.include_router(webhooks_router, tags=["Webhooks"])
api_router.include_router(reports_router, tags=["Reports"])
api_router.include_router(risk_config_router, tags=["Risk Configuration"])
api_router.include_router(analytics_router, tags=["Analytics"])
api_router.include_router(knowledge_router, tags=["Knowledge Base"])
api_router.include_router(assistant_router, tags=["AI Assistant"])
api_router.include_router(finding_intelligence_router, tags=["Finding Intelligence"])
api_router.include_router(executive_intelligence_router, tags=["Executive Intelligence"])
api_router.include_router(rag_operations_router, tags=["RAG Operations"])
api_router.include_router(auth_router, tags=["Auth"])
api_router.include_router(auth_sso_router, tags=["Auth — SSO"])
api_router.include_router(auth_admin_router, tags=["Auth — Admin"])
