"""
KAVACH — Celery Application
Configures queueing, retries, and scheduled maintenance for the
distributed scan orchestrator.

Priority is implemented as separate named queues (`kavach.critical` down
to `kavach.low`) rather than Redis/Kombu's built-in priority emulation.
Kombu's Redis priority support works by faking priority levels as extra
per-queue sorted keys under the hood, and is widely documented as
unreliable at scale; named queues are unambiguous and let you run
dedicated worker capacity for high-priority work (see docker-compose.yml —
a small always-on pool listens only to `kavach.critical`/`kavach.high` so
a backlog of low-priority scans can never starve them).

`visibility_timeout` matters here specifically because of `task_acks_late`:
Redis (unlike RabbitMQ) doesn't have a true ack-based broker — a task
becomes visible for redelivery to another worker again after this many
seconds if it isn't acked. It must exceed the longest job's
`timeout_seconds`, or Redis will redeliver a task that's still legitimately
running to a second worker, causing duplicate execution.
"""

from celery import Celery
from celery.schedules import crontab
from kombu import Queue

from app.config import get_settings
from app.core.telemetry import instrument_celery, instrument_httpx, instrument_redis, setup_telemetry
from app.models.enums import ScanJobPriority

settings = get_settings()

# Safe to call from both a standalone worker/beat process (this is the
# first and only call, service_name correctly becomes "kavach-worker")
# and the API process, which imports this module too (to dispatch tasks)
# — main.py's own setup_telemetry(service_name="kavach-api") call always
# runs first there, before anything importing this module, so this becomes
# a no-op in that process. instrument_celery() runs unconditionally
# either way: instrumenting the *producer* side (API calling .delay()) is
# exactly what lets a trace continue from an HTTP request into the worker
# that picks the task up, via Celery's built-in trace-context propagation.
setup_telemetry(service_name="kavach-worker")
instrument_celery()
instrument_httpx()
instrument_redis()

QUEUE_BY_PRIORITY: dict[ScanJobPriority, str] = {
    ScanJobPriority.CRITICAL: "kavach.critical",
    ScanJobPriority.HIGH: "kavach.high",
    ScanJobPriority.NORMAL: "kavach.normal",
    ScanJobPriority.LOW: "kavach.low",
}


def queue_for_priority(priority: ScanJobPriority) -> str:
    return QUEUE_BY_PRIORITY.get(priority, "kavach.normal")


celery_app = Celery(
    "kavach",
    broker=settings.resolved_celery_broker_url,
    backend=settings.resolved_celery_result_backend,
    include=[
        "app.tasks.scan_tasks",
        "app.tasks.scanner_tasks",
        "app.tasks.aggregator_tasks",
        "app.tasks.report_tasks",
        "app.tasks.maintenance_tasks",
        "app.tasks.scheduled_scan_tasks",
        "app.tasks.archive_tasks",
    ],
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    # At-least-once delivery: acks happen after the task returns/raises, and
    # a worker killed mid-task (OOM, SIGKILL, node loss) causes Redis to
    # redeliver the message to another worker rather than lose it silently.
    task_acks_late=True,
    task_reject_on_worker_lost=True,
    worker_prefetch_multiplier=1,
    # Recycle worker processes periodically — long-running fleets of
    # semgrep/pip-audit subprocess calls are a realistic slow-leak source.
    worker_max_tasks_per_child=100,
    broker_transport_options={
        "visibility_timeout": 21600,  # 6h — comfortably above any realistic scan timeout
    },
    task_queues=[
        Queue("kavach.critical"),
        Queue("kavach.high"),
        Queue("kavach.normal"),
        Queue("kavach.low"),
    ],
    task_default_queue="kavach.normal",
    result_expires=60 * 60 * 24,
    beat_schedule={
        "sweep-stalled-scan-jobs": {
            "task": "kavach.sweep_stalled_jobs",
            "schedule": 60.0,
        },
        "nightly-scheduled-scans": {
            "task": "kavach.nightly_scheduled_scans",
            "schedule": crontab(hour=2, minute=0),  # 02:00 UTC — low-traffic window, well clear of any business-hours load
        },
        "archive-old-scans": {
            "task": "kavach.archive_old_scans",
            "schedule": crontab(hour=3, minute=0),  # 03:00 UTC — after the nightly scan sweep, same quiet window
        },
    },
)
