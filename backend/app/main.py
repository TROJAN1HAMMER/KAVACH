"""
KAVACH — FastAPI Application Entry Point
AI-powered DevSecOps Security Platform for Banking & Financial Applications.
"""

import structlog
from contextlib import asynccontextmanager

import redis.asyncio as redis_asyncio
from fastapi import FastAPI, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
from prometheus_client import CONTENT_TYPE_LATEST, generate_latest
from sqlalchemy import text

from app.config import get_settings
from app.core.logging import configure_logging
from app.core.metrics import REGISTRY, collect_business_metrics, collect_scanner_metrics
from app.core.telemetry import instrument_fastapi, instrument_httpx, instrument_redis, instrument_sqlalchemy, setup_telemetry
from app.db.session import AsyncSessionLocal, engine
from app.core.error_handlers import register_exception_handlers
from app.middleware.metrics_middleware import MetricsMiddleware
from app.middleware.permission_middleware import PermissionMiddleware
from app.middleware.rate_limit import RateLimitMiddleware
from app.middleware.request_context import RequestContextMiddleware

settings = get_settings()
configure_logging(settings)
logger = structlog.get_logger(__name__)

setup_telemetry(service_name="kavach-api")


# ── Lifespan ──────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup / shutdown lifecycle handler."""
    logger.info("kavach.startup", version=settings.app_version, env=settings.app_env)

    # Generate pre-made sandbox payloads
    from app.utils.payload_generator import generate_premade_payloads
    from pathlib import Path
    generate_premade_payloads(Path(settings.data_dir))
    logger.info("kavach.premade_payloads.ready")
    
    yield
    logger.info("kavach.shutdown")


# ── Application ───────────────────────────────────────────────────────────────

app = FastAPI(
    title="KAVACH — AI-Powered DevSecOps Platform",
    description=(
        "KAVACH scans banking application repositories for vulnerabilities, "
        "calculates a Banking Risk Score (BRS), maps findings to regulatory "
        "controls (RBI / PCI-DSS / SWIFT), and generates AI-powered audit reports.\n\n"
        "## Pipeline\n"
        "`GitHub webhook` → `Create Scan Job` → `Queue` → `Distributed workers` → "
        "`Aggregation` → `Risk Engine` → `Compliance Engine` → `AI Explanation` → "
        "`Reports` → `Dashboard` → `Notifications` → `Archive`\n\n"
        "A scan enters this pipeline either via `POST /scan/repository` / `POST /scan` "
        "(an authenticated user submitting a URL or archive) or `POST /webhooks/github` "
        "(an unauthenticated, HMAC-verified push event) — both converge on the same "
        "queue → distributed-worker → aggregation path, so everything downstream behaves "
        "identically regardless of how the scan was triggered."
    ),
    version=settings.app_version,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    contact={"name": "KAVACH Platform Team", "url": "https://github.com/kavach-platform/kavach"},
    license_info={"name": "Proprietary — All Rights Reserved"},
    openapi_tags=[
        {"name": "Health", "description": "Liveness/readiness probes — no authentication required."},
        {"name": "Observability", "description": "Prometheus metrics scrape endpoint."},
        {
            "name": "Repositories",
            "description": "Repositories KAVACH has scanned, from a URL submission, an archive upload, or a GitHub webhook push.",
        },
        {
            "name": "Scanning",
            "description": "Submit a scan (URL, archive upload, or sandbox demo), track its progress (poll or WebSocket), and retrieve its findings/compliance results.",
        },
        {
            "name": "Webhooks",
            "description": "Inbound webhook receivers — currently GitHub push events. The first step of the automated pipeline: a verified push creates and dispatches a scan job with no user interaction.",
        },
        {
            "name": "Reports",
            "description": "Generated report artifacts (PDF, SARIF, SBOM, CSV, compliance report, unified findings JSON) for a completed scan.",
        },
        {
            "name": "Risk Configuration",
            "description": "Business-module classification and BRS factor-weight configuration that drives the Risk Engine's scoring.",
        },
        {"name": "Auth", "description": "Local email/password authentication — register, log in, refresh, and read the current user."},
        {"name": "Auth — SSO", "description": "OAuth2/OIDC, LDAP, and SAML single sign-on flows."},
        {"name": "Auth — Admin", "description": "User role/status management and audit-log querying — admin-only."},
    ],
    lifespan=lifespan,
)

# ── Observability ─────────────────────────────────────────────────────────────
# Instrumentation is wired up before any middleware/routes are registered —
# FastAPIInstrumentor in particular wraps the ASGI app, so it needs to run
# while `app` is still the object everything else attaches to.

instrument_fastapi(app)
instrument_sqlalchemy(engine)
instrument_httpx()
instrument_redis()

# ── CORS ──────────────────────────────────────────────────────────────────────

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(RequestContextMiddleware)
app.add_middleware(RateLimitMiddleware, requests_per_window=100, window_seconds=60)
app.add_middleware(PermissionMiddleware)
app.add_middleware(MetricsMiddleware)

# ── Error Handling ────────────────────────────────────────────────────────────

register_exception_handlers(app)

# ── Static Files (reports) ────────────────────────────────────────────────────

import os
os.makedirs(settings.reports_dir, exist_ok=True)
app.mount("/static/reports", StaticFiles(directory=settings.reports_dir), name="reports")

# ── Routers ───────────────────────────────────────────────────────────────────

from app.api.v1.router import api_router

app.include_router(api_router, prefix="/api/v1")


# ── Health Check ──────────────────────────────────────────────────────────────
# Three distinct endpoints for three distinct Kubernetes probe semantics —
# see each docstring. `/health` is kept exactly as it was (static, no
# dependency checks) for any existing caller relying on its current shape;
# `/health/live` and `/health/ready` are what the Helm chart's probes
# actually point at.

@app.get("/health", tags=["Health"])
async def health_check() -> dict:
    """Platform health check endpoint."""
    return {
        "status": "healthy",
        "storage": "ready",
        "reports": "ready"
    }


@app.get("/health/live", tags=["Health"])
async def liveness() -> dict:
    """
    Kubernetes liveness probe target: is the process itself alive and
    able to handle a request at all? Deliberately checks nothing beyond
    that — a Postgres or Redis outage must not make kubelet kill and
    restart otherwise-healthy API pods (that would turn a dependency
    outage into a self-inflicted restart storm on top of it). That
    distinction is exactly what `/health/ready` is for instead.
    """
    return {"status": "alive"}


@app.get("/health/ready", tags=["Health"])
async def readiness(response: Response) -> dict:
    """
    Kubernetes readiness probe target: can this pod actually serve a
    request right now? Checks Postgres and Redis are reachable — a pod
    that fails this is taken out of Service load-balancing (not killed,
    unlike a liveness failure) until it passes again, which is the
    correct response to "my dependency is temporarily down" rather than
    "I am broken and need a restart".
    """
    checks: dict[str, str] = {}
    healthy = True

    try:
        async with AsyncSessionLocal() as session:
            await session.execute(text("SELECT 1"))
        checks["database"] = "ready"
    except Exception as exc:
        checks["database"] = f"error: {exc}"
        healthy = False

    try:
        redis_client = redis_asyncio.from_url(settings.redis_url, decode_responses=True)
        try:
            await redis_client.ping()
            checks["redis"] = "ready"
        finally:
            await redis_client.aclose()
    except Exception as exc:
        checks["redis"] = f"error: {exc}"
        healthy = False

    response.status_code = 200 if healthy else 503
    return {"status": "ready" if healthy else "not_ready", "checks": checks}


@app.get("/metrics", tags=["Observability"])
async def metrics() -> Response:
    """
    Prometheus scrape target. See app/core/metrics.py's module docstring
    for why HTTP metrics are recorded in-process (by MetricsMiddleware)
    while business/scanner metrics are computed fresh from Postgres/Redis
    right here, on every scrape, instead.
    """
    async with AsyncSessionLocal() as db:
        await collect_business_metrics(db)
    collect_scanner_metrics()
    return Response(content=generate_latest(REGISTRY), media_type=CONTENT_TYPE_LATEST)


@app.get("/", tags=["Health"])
async def root() -> dict:
    """Root endpoint — redirects clients to API docs."""
    return {
        "message": "Welcome to KAVACH DevSecOps Platform",
        "docs": "/docs",
        "health": "/health",
    }
