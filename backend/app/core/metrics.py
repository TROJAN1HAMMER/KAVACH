"""
KAVACH — Prometheus Metrics

Three tiers, deliberately kept separate rather than unified into one
in-process registry shared across the API and Celery workers (that would
need `prometheus_client`'s multiprocess mode — a shared filesystem
directory plus extra collector ceremony — for comparatively little
benefit here):

  1. HTTP metrics — recorded directly in-process by `MetricsMiddleware`,
     one registry per API pod. Prometheus scrapes each pod individually
     (the Helm chart's ServiceMonitor uses pod-based service discovery,
     not the ClusterIP Service, which would only ever land on one random
     pod per scrape) and aggregates across pods at query time with
     PromQL `sum()`. This is the standard, correct pattern — nothing
     unusual about it.

  2. Business metrics (scan counts by status, findings by severity, BRS
     score average) — already durably persisted in Postgres by the time
     a scan finishes, so rather than trying to accumulate counters across
     ephemeral Celery worker processes, `/metrics` just runs a handful of
     cheap aggregate queries against Postgres at scrape time and exposes
     the current snapshot as gauges. Correct by construction — no drift,
     no "counters reset when a worker restarts" problem — and needs zero
     cross-process metric plumbing.

  3. Scanner-level metrics (per-tool duration/success/failure — semgrep,
     pip-audit, OSV, ...) — recorded into Redis by the scanner tasks
     themselves (right next to the existing per-scanner status store in
     `app/orchestrator/scan_status.py`), read back by `/metrics` at
     scrape time the same way business metrics are. Redis, not an
     in-process registry, because these are written by Celery worker
     processes, which the API process exposing `/metrics` never shares
     memory with.

Generic Celery/task-queue metrics (queue depth, task states, worker
counts) are intentionally NOT reimplemented here — see the Helm chart's
`celery-exporter` Deployment, which gets those for free from Celery's own
event stream without any KAVACH code needing to touch it.
"""

import time
from typing import Optional

import redis
import structlog
from prometheus_client import CollectorRegistry, Counter, Gauge, Histogram
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models.enums import ScanJobStatus
from app.models.finding import Finding
from app.models.scan_job import ScanJob
from app.models.scan_result import ScanResult

logger = structlog.get_logger(__name__)
settings = get_settings()

REGISTRY = CollectorRegistry()

# ── 1. HTTP metrics (in-process, per-pod) ──────────────────────────────────────

HTTP_REQUESTS_TOTAL = Counter(
    "kavach_http_requests_total",
    "Total HTTP requests handled by this pod",
    ["method", "path", "status"],
    registry=REGISTRY,
)
HTTP_REQUEST_DURATION_SECONDS = Histogram(
    "kavach_http_request_duration_seconds",
    "HTTP request duration in seconds",
    ["method", "path"],
    registry=REGISTRY,
)
HTTP_REQUESTS_IN_PROGRESS = Gauge(
    "kavach_http_requests_in_progress",
    "HTTP requests currently being handled by this pod",
    registry=REGISTRY,
)

# ── 2. Business metrics (Postgres snapshot at scrape time) ─────────────────────

SCAN_JOBS_BY_STATUS = Gauge(
    "kavach_scan_jobs_by_status",
    "Current scan job count by status",
    ["status"],
    registry=REGISTRY,
)
FINDINGS_BY_SEVERITY = Gauge(
    "kavach_findings_by_severity_recent",
    "Findings by severity across scans completed in the lookback window",
    ["severity"],
    registry=REGISTRY,
)
BRS_SCORE_AVG = Gauge(
    "kavach_brs_score_avg_recent",
    "Average Banking Risk Score across scans completed in the lookback window",
    registry=REGISTRY,
)
BRS_SCORE_MAX = Gauge(
    "kavach_brs_score_max_recent",
    "Maximum Banking Risk Score across scans completed in the lookback window",
    registry=REGISTRY,
)

BUSINESS_METRICS_LOOKBACK_HOURS = 24

_SEVERITIES = ("CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO")


async def collect_business_metrics(db: AsyncSession) -> None:
    """Called once per /metrics scrape — refreshes the Gauges above from Postgres."""
    status_counts = await db.execute(
        select(ScanJob.status, func.count(ScanJob.id)).group_by(ScanJob.status)
    )
    counts_by_status = {status.value: count for status, count in status_counts.all()}
    for status in ScanJobStatus:
        SCAN_JOBS_BY_STATUS.labels(status=status.value).set(counts_by_status.get(status.value, 0))

    from datetime import datetime, timedelta, timezone

    since = datetime.now(timezone.utc) - timedelta(hours=BUSINESS_METRICS_LOOKBACK_HOURS)

    severity_counts = await db.execute(
        select(Finding.severity, func.count(Finding.id))
        .join(ScanJob, Finding.scan_job_id == ScanJob.id)
        .where(ScanJob.finished_at >= since)
        .group_by(Finding.severity)
    )
    counts_by_severity = dict(severity_counts.all())
    for severity in _SEVERITIES:
        FINDINGS_BY_SEVERITY.labels(severity=severity).set(counts_by_severity.get(severity, 0))

    brs_stats = await db.execute(
        select(func.avg(ScanResult.brs_score), func.max(ScanResult.brs_score)).where(
            ScanResult.created_at >= since
        )
    )
    avg_brs, max_brs = brs_stats.one()
    BRS_SCORE_AVG.set(float(avg_brs) if avg_brs is not None else 0.0)
    BRS_SCORE_MAX.set(float(max_brs) if max_brs is not None else 0.0)


# ── 3. Scanner-level metrics (Redis, written by Celery workers) ────────────────

SCANNER_RUNS = Gauge(
    "kavach_scanner_runs",
    (
        "Cumulative scanner task outcomes, mirrored from the Redis-persisted "
        "true source of truth — a Gauge rather than a Counter deliberately: "
        "this process only ever *sets* the current total from Redis, never "
        "increments it in-process, and a Prometheus Counter's API doesn't "
        "support that (it's `.inc()`-only by design, precisely to prevent "
        "this class of mistake)."
    ),
    ["scanner", "outcome"],  # outcome: success | failure
    registry=REGISTRY,
)
SCANNER_AVG_DURATION_SECONDS = Gauge(
    "kavach_scanner_avg_duration_seconds",
    "Rolling average duration of a scanner task, across all outcomes",
    ["scanner"],
    registry=REGISTRY,
)

_redis_client: Optional[redis.Redis] = None


def _get_redis() -> redis.Redis:
    global _redis_client
    if _redis_client is None:
        _redis_client = redis.from_url(settings.redis_url, decode_responses=True)
    return _redis_client


def _scanner_metrics_key(scanner: str) -> str:
    return f"kavach:metrics:scanner:{scanner}"


def record_scanner_result(scanner: str, *, duration_seconds: float, success: bool) -> None:
    """
    Called by scanner_tasks.py at the end of every attempt (success or
    final failure). Fails open — a Redis hiccup here should never affect
    the scan itself, only the metric.
    """
    try:
        r = _get_redis()
        key = _scanner_metrics_key(scanner)
        pipe = r.pipeline()
        pipe.hincrby(key, "success" if success else "failure", 1)
        pipe.hincrbyfloat(key, "duration_sum", duration_seconds)
        pipe.hincrby(key, "duration_count", 1)
        pipe.expire(key, 60 * 60 * 24 * 7)  # 7 days — enough history for a meaningful rolling average
        pipe.execute()
    except redis.RedisError as exc:
        logger.warning("metrics.scanner_record_failed", scanner=scanner, error=str(exc))


# Every scanner this platform runs — used so /metrics always reports a
# complete set of series (0 for a scanner that hasn't run yet) rather than
# only whichever ones happen to have Redis keys at scrape time, which
# would make Grafana panels built against `scanner=~".*"` silently miss
# rows until each tool's first invocation.
KNOWN_SCANNERS = (
    "semgrep", "ast-grep", "joern", "osv", "nvd", "secrets", "docker", "yaml", "pip-audit",
)


def collect_scanner_metrics() -> None:
    """Called once per /metrics scrape — refreshes the scanner Gauges/Counters from Redis."""
    try:
        r = _get_redis()
        for scanner in KNOWN_SCANNERS:
            data = r.hgetall(_scanner_metrics_key(scanner))
            success = int(data.get("success", 0))
            failure = int(data.get("failure", 0))
            duration_sum = float(data.get("duration_sum", 0.0))
            duration_count = int(data.get("duration_count", 0))

            SCANNER_RUNS.labels(scanner=scanner, outcome="success").set(success)
            SCANNER_RUNS.labels(scanner=scanner, outcome="failure").set(failure)
            SCANNER_AVG_DURATION_SECONDS.labels(scanner=scanner).set(
                duration_sum / duration_count if duration_count else 0.0
            )
    except redis.RedisError as exc:
        logger.warning("metrics.scanner_collect_failed", error=str(exc))


# ── 4. RAG metrics (Milestone 5) ────────────────────────────────────────────────
# Same two sub-patterns as tiers 2/3 above, applied to the knowledge base/
# assistant/finding intelligence/executive intelligence features:
# document counts are already durable in Postgres (tier-2-style, collected
# fresh at scrape time); everything else (search/chat/ask latency, cache
# hit rate, estimated token usage, feedback) is written into Redis by the
# services themselves as it happens (tier-3-style) — necessary here too,
# since RAG requests can land on any API pod and this process doesn't
# share memory with whichever one actually served a given request.

RAG_DOCUMENTS_BY_STATUS = Gauge(
    "kavach_rag_documents_by_status",
    "Current knowledge base document count by status (latest version of each document only)",
    ["status"],
    registry=REGISTRY,
)
RAG_OPERATIONS = Gauge(
    "kavach_rag_operations",
    "Cumulative RAG operation outcomes, mirrored from Redis",
    ["feature", "outcome"],  # feature: knowledge_search|assistant_chat|finding_intelligence|executive_ask; outcome: success|error
    registry=REGISTRY,
)
RAG_AVG_LATENCY_SECONDS = Gauge(
    "kavach_rag_avg_latency_seconds",
    "Rolling average end-to-end latency of a RAG operation",
    ["feature"],
    registry=REGISTRY,
)
RAG_CACHE_OPERATIONS = Gauge(
    "kavach_rag_cache_operations",
    "Cumulative embedding/rerank cache hit/miss counts",
    ["cache", "outcome"],  # cache: embedding|rerank; outcome: hit|miss
    registry=REGISTRY,
)
RAG_TOKEN_USAGE_ESTIMATED = Gauge(
    "kavach_rag_token_usage_estimated_total",
    (
        "Estimated cumulative token usage for RAG LLM calls — the same "
        "4-characters-per-token heuristic as app/services/ai/"
        "token_estimator.py, an approximation, not an exact provider-"
        "reported count (see docs/production_hardening.md for why)."
    ),
    ["feature", "direction"],  # direction: prompt|completion
    registry=REGISTRY,
)
RAG_FEEDBACK = Gauge(
    "kavach_rag_feedback_total",
    "Cumulative user feedback submissions on RAG outputs",
    ["feature", "rating"],  # rating: positive|negative
    registry=REGISTRY,
)

KNOWN_RAG_FEATURES = ("knowledge_search", "assistant_chat", "finding_intelligence", "executive_ask")
KNOWN_RAG_CACHES = ("embedding", "rerank")


def _rag_metrics_key(suffix: str) -> str:
    return f"kavach:metrics:rag:{suffix}"


def record_rag_operation(feature: str, *, duration_seconds: float, success: bool) -> None:
    """Called at the end of every knowledge-base search / assistant chat
    turn / finding-intelligence lookup / executive-intelligence ask."""
    try:
        r = _get_redis()
        key = _rag_metrics_key(f"ops:{feature}")
        pipe = r.pipeline()
        pipe.hincrby(key, "success" if success else "error", 1)
        pipe.hincrbyfloat(key, "duration_sum", duration_seconds)
        pipe.hincrby(key, "duration_count", 1)
        pipe.expire(key, 60 * 60 * 24 * 7)
        pipe.execute()
    except redis.RedisError as exc:
        logger.warning("metrics.rag_operation_record_failed", feature=feature, error=str(exc))


def record_cache_result(cache: str, *, hit: bool) -> None:
    try:
        r = _get_redis()
        key = _rag_metrics_key(f"cache:{cache}")
        pipe = r.pipeline()
        pipe.hincrby(key, "hit" if hit else "miss", 1)
        pipe.expire(key, 60 * 60 * 24 * 7)
        pipe.execute()
    except redis.RedisError as exc:
        logger.warning("metrics.rag_cache_record_failed", cache=cache, error=str(exc))


def record_token_usage(feature: str, *, prompt_tokens: int, completion_tokens: int) -> None:
    try:
        r = _get_redis()
        key = _rag_metrics_key(f"tokens:{feature}")
        pipe = r.pipeline()
        pipe.hincrby(key, "prompt", prompt_tokens)
        pipe.hincrby(key, "completion", completion_tokens)
        pipe.expire(key, 60 * 60 * 24 * 7)
        pipe.execute()
    except redis.RedisError as exc:
        logger.warning("metrics.rag_token_record_failed", feature=feature, error=str(exc))


def record_feedback(feature: str, *, positive: bool) -> None:
    try:
        r = _get_redis()
        key = _rag_metrics_key(f"feedback:{feature}")
        pipe = r.pipeline()
        pipe.hincrby(key, "positive" if positive else "negative", 1)
        pipe.expire(key, 60 * 60 * 24 * 30)
        pipe.execute()
    except redis.RedisError as exc:
        logger.warning("metrics.rag_feedback_record_failed", feature=feature, error=str(exc))


def collect_rag_redis_metrics() -> None:
    """Called once per /metrics scrape — refreshes the Redis-backed RAG Gauges."""
    try:
        r = _get_redis()
        for feature in KNOWN_RAG_FEATURES:
            ops = r.hgetall(_rag_metrics_key(f"ops:{feature}"))
            duration_count = int(ops.get("duration_count", 0))
            RAG_OPERATIONS.labels(feature=feature, outcome="success").set(int(ops.get("success", 0)))
            RAG_OPERATIONS.labels(feature=feature, outcome="error").set(int(ops.get("error", 0)))
            RAG_AVG_LATENCY_SECONDS.labels(feature=feature).set(
                float(ops.get("duration_sum", 0.0)) / duration_count if duration_count else 0.0
            )

            tokens = r.hgetall(_rag_metrics_key(f"tokens:{feature}"))
            RAG_TOKEN_USAGE_ESTIMATED.labels(feature=feature, direction="prompt").set(int(tokens.get("prompt", 0)))
            RAG_TOKEN_USAGE_ESTIMATED.labels(feature=feature, direction="completion").set(
                int(tokens.get("completion", 0))
            )

            feedback = r.hgetall(_rag_metrics_key(f"feedback:{feature}"))
            RAG_FEEDBACK.labels(feature=feature, rating="positive").set(int(feedback.get("positive", 0)))
            RAG_FEEDBACK.labels(feature=feature, rating="negative").set(int(feedback.get("negative", 0)))

        for cache in KNOWN_RAG_CACHES:
            cache_data = r.hgetall(_rag_metrics_key(f"cache:{cache}"))
            RAG_CACHE_OPERATIONS.labels(cache=cache, outcome="hit").set(int(cache_data.get("hit", 0)))
            RAG_CACHE_OPERATIONS.labels(cache=cache, outcome="miss").set(int(cache_data.get("miss", 0)))
    except redis.RedisError as exc:
        logger.warning("metrics.rag_redis_collect_failed", error=str(exc))


async def collect_rag_document_metrics(db: AsyncSession) -> None:
    """Postgres-backed, same reasoning as `collect_business_metrics` — document
    counts by status are already durable, no Redis round-trip needed."""
    from app.models.knowledge import KnowledgeDocument

    status_counts = await db.execute(
        select(KnowledgeDocument.status, func.count(KnowledgeDocument.id))
        .where(KnowledgeDocument.is_latest.is_(True))
        .group_by(KnowledgeDocument.status)
    )
    counts_by_status = dict(status_counts.all())
    for status in ("pending", "processing", "indexed", "failed"):
        RAG_DOCUMENTS_BY_STATUS.labels(status=status).set(counts_by_status.get(status, 0))


class ScannerTimer:
    """
    `with ScannerTimer() as t: ...`, then `t.elapsed` — a property, not a
    value frozen in `__exit__`. It must be readable *before* the `with`
    block exits (e.g. on a success path that records the metric and
    returns from inside the block) and still give the real elapsed time
    so far, not the timer's unset initial value — a plain
    "set self.elapsed in __exit__" design silently returns 0.0 for every
    such read, since `__exit__` hasn't run yet at that point.
    """

    def __init__(self) -> None:
        self._start = 0.0

    def __enter__(self) -> "ScannerTimer":
        self._start = time.monotonic()
        return self

    def __exit__(self, *exc_info) -> None:
        return None

    @property
    def elapsed(self) -> float:
        return time.monotonic() - self._start
