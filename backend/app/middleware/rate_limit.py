"""
KAVACH — Redis-backed Rate Limiting Middleware
Fixed-window limiter keyed by client IP. Reuses the same Redis instance
Celery's broker/backend already depend on (Phase 5) — no new
infrastructure requirement. Fails open (lets the request through) if
Redis is unreachable, logging a warning instead of taking the API down.
"""

import time

import redis.asyncio as redis
import structlog
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

from app.config import get_settings

logger = structlog.get_logger(__name__)


class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, *, requests_per_window: int = 100, window_seconds: int = 60) -> None:
        super().__init__(app)
        settings = get_settings()
        self._redis = redis.from_url(settings.redis_url, decode_responses=True)
        self.requests_per_window = requests_per_window
        self.window_seconds = window_seconds

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        client_ip = request.client.host if request.client else "unknown"
        window = int(time.time() // self.window_seconds)
        key = f"kavach:ratelimit:{client_ip}:{window}"

        try:
            count = await self._redis.incr(key)
            if count == 1:
                await self._redis.expire(key, self.window_seconds)
        except Exception:
            logger.warning("rate_limit.redis_unavailable_failing_open")
            return await call_next(request)

        if count > self.requests_per_window:
            logger.warning("rate_limit.exceeded", client_ip=client_ip, count=count)
            return JSONResponse(
                status_code=429,
                content={"detail": "Too many requests. Please slow down."},
            )

        return await call_next(request)
