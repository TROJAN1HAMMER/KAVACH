"""
KAVACH — API v1 Router
Aggregates every v1 endpoint router into a single object `main.py` mounts
once at `/api/v1`. Adding a v2 means creating `app/api/v2/` alongside this
file with its own router — v1 keeps serving existing clients unchanged.
"""

from fastapi import APIRouter

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
api_router.include_router(auth_router, tags=["Auth"])
api_router.include_router(auth_sso_router, tags=["Auth — SSO"])
api_router.include_router(auth_admin_router, tags=["Auth — Admin"])
