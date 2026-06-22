"""
KAVACH — FastAPI Application Entry Point
AI-powered DevSecOps Security Platform for Banking & Financial Applications.
"""

import structlog
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse

from app.config import get_settings

logger = structlog.get_logger(__name__)
settings = get_settings()


# ── Lifespan ──────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup / shutdown lifecycle handler."""
    logger.info("kavach.startup", version=settings.app_version, env=settings.app_env)
    
    # Initialize JSON local storage
    from app.storage.local_store import init_store
    init_store()
    logger.info("kavach.storage.ready")
    
    yield
    logger.info("kavach.shutdown")


# ── Application ───────────────────────────────────────────────────────────────

app = FastAPI(
    title="KAVACH — AI-Powered DevSecOps Platform",
    description=(
        "KAVACH scans banking application repositories for vulnerabilities, "
        "calculates a Banking Risk Score (BRS), maps findings to regulatory "
        "controls (RBI / PCI-DSS / SWIFT), and generates AI-powered audit reports."
    ),
    version=settings.app_version,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    lifespan=lifespan,
)

# ── CORS ──────────────────────────────────────────────────────────────────────

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Static Files (reports) ────────────────────────────────────────────────────

import os
os.makedirs(settings.reports_dir, exist_ok=True)
app.mount("/static/reports", StaticFiles(directory=settings.reports_dir), name="reports")

# ── Routers ───────────────────────────────────────────────────────────────────

from app.api.scan import router as scan_router
from app.api.reports import router as reports_router

app.include_router(scan_router, prefix="/api/v1", tags=["Scanning"])
app.include_router(reports_router, prefix="/api/v1", tags=["Reports"])


# ── Health Check ──────────────────────────────────────────────────────────────

@app.get("/health", tags=["Health"])
async def health_check() -> dict:
    """Platform health check endpoint."""
    return {
        "status": "healthy",
        "platform": "KAVACH",
        "version": settings.app_version,
        "environment": settings.app_env,
    }


@app.get("/", tags=["Health"])
async def root() -> dict:
    """Root endpoint — redirects clients to API docs."""
    return {
        "message": "Welcome to KAVACH DevSecOps Platform",
        "docs": "/docs",
        "health": "/health",
    }
