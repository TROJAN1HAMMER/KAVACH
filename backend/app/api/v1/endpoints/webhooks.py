"""
KAVACH — Inbound GitHub Webhook
The first step of the pipeline: GitHub webhook → Create Scan Job → Queue
→ Distributed workers → Aggregation → Risk Engine → Compliance Engine →
AI Explanation → Reports → Dashboard → Notifications → Archive. Every
step after "Create Scan Job" already existed (see
app/services/scan_intake.py → app/tasks/scan_tasks.py's dispatch chain →
app/tasks/aggregator_tasks.py); this endpoint is the entry point that was
missing.

Unauthenticated by JWT — GitHub can't obtain one. Authenticity instead
comes from verifying the `X-Hub-Signature-256` header GitHub signs every
delivery with: an HMAC-SHA256 of the *raw* request body, keyed with
`settings.github_webhook_secret`, configured identically on the GitHub
repo/org webhook settings page (Settings → Webhooks → Secret). A blank
secret means the endpoint refuses every delivery with 503 rather than
accepting unsigned payloads — there's no "insecure but working" mode for
an endpoint that must be reachable from the public internet.
"""

import hashlib
import hmac
import json
from typing import Annotated, Optional

import structlog
from fastapi import APIRouter, Depends, Header, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.db.session import get_db
from app.models.enums import RepoProviderType, ScanJobPriority
from app.repositories.deps import get_repository_repository, get_scan_job_repository
from app.repositories.repository_repository import RepositoryRepository
from app.repositories.scan_job_repository import ScanJobRepository
from app.schemas.webhook import WebhookAckResponse
from app.services.scan_intake import get_or_create_repository, queue_and_dispatch

router = APIRouter()
settings = get_settings()
logger = structlog.get_logger(__name__)


def _verify_github_signature(raw_body: bytes, signature_header: Optional[str]) -> None:
    if not settings.github_webhook_secret:
        raise HTTPException(status_code=503, detail="GitHub webhook is not configured on this instance")
    if not signature_header or not signature_header.startswith("sha256="):
        raise HTTPException(status_code=401, detail="Missing or malformed X-Hub-Signature-256 header")

    expected = "sha256=" + hmac.new(
        settings.github_webhook_secret.encode("utf-8"), raw_body, hashlib.sha256
    ).hexdigest()
    # constant-time comparison — a naive `==` leaks how many leading bytes
    # matched via response-timing, letting an attacker forge a valid
    # signature byte-by-byte.
    if not hmac.compare_digest(expected, signature_header):
        raise HTTPException(status_code=401, detail="Invalid webhook signature")


@router.post(
    "/webhooks/github",
    response_model=WebhookAckResponse,
    tags=["Webhooks"],
    summary="GitHub push event receiver",
    response_description="Whether a scan was queued, ignored, or the delivery was just a ping check",
)
async def github_webhook(
    request: Request,
    repositories: Annotated[RepositoryRepository, Depends(get_repository_repository)],
    scan_jobs: Annotated[ScanJobRepository, Depends(get_scan_job_repository)],
    db: Annotated[AsyncSession, Depends(get_db)],
    x_hub_signature_256: Annotated[Optional[str], Header()] = None,
    x_github_event: Annotated[Optional[str], Header()] = None,
) -> WebhookAckResponse:
    """
    Handles two GitHub event types:

    - `ping` — sent once when the webhook is first configured, to let
      GitHub confirm the endpoint is reachable and signs correctly.
      Acknowledged without creating a scan.
    - `push` — the trigger. Resolves (or reuses) the pushed repository's
      `Repository` row, creates a queued `ScanJob` for the pushed branch,
      and dispatches it exactly like `POST /scan/repository` — the rest
      of the pipeline (workers, aggregation, risk/compliance/AI, reports,
      notifications, archive) runs identically regardless of how the scan
      was triggered.

    Every other event type (`pull_request`, `issues`, `star`, ...) is
    acknowledged with 200 and a `status: "ignored"` body rather than
    erroring — GitHub retries/disables a webhook that responds with
    non-2xx too often, and subscribing to more events than intended on
    the GitHub side shouldn't be able to break delivery for the ones that
    matter.

    Responds fast (queues the job, does not wait for it): GitHub expects
    a response within 10 seconds and will consider the delivery failed
    (and may retry) otherwise.
    """
    raw_body = await request.body()
    _verify_github_signature(raw_body, x_hub_signature_256)

    try:
        payload = json.loads(raw_body)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Malformed JSON payload")

    if x_github_event == "ping":
        logger.info("webhooks.github_ping", zen=payload.get("zen"))
        return WebhookAckResponse(status="ping_ok", message="Webhook configured successfully")

    if x_github_event != "push":
        logger.info("webhooks.github_event_ignored", github_event=x_github_event)
        return WebhookAckResponse(status="ignored", message=f"Event type '{x_github_event}' is not handled")

    if payload.get("deleted"):
        return WebhookAckResponse(status="ignored", message="Branch deletion push — nothing to scan")

    repo_payload = payload.get("repository") or {}
    clone_url = repo_payload.get("clone_url") or repo_payload.get("html_url")
    if not clone_url:
        raise HTTPException(status_code=400, detail="Push event payload is missing repository.clone_url")

    ref = payload.get("ref", "")
    branch = ref[len("refs/heads/") :] if ref.startswith("refs/heads/") else ref
    default_branch = repo_payload.get("default_branch")

    if not settings.github_webhook_scan_all_branches and default_branch and branch and branch != default_branch:
        return WebhookAckResponse(
            status="ignored",
            message=f"Push to '{branch}' skipped — only the default branch ('{default_branch}') triggers a scan",
        )

    repository = await get_or_create_repository(
        repositories,
        url=clone_url,
        name=repo_payload.get("name") or branch or "unknown",
        provider=RepoProviderType.GITHUB,
        owner_id=None,  # no authenticated user behind a webhook delivery
        default_branch=default_branch,
    )
    job = await scan_jobs.create_queued(
        repository_id=repository.id,
        owner_id=None,
        ref=branch or None,
        priority=ScanJobPriority.NORMAL,
    )
    await queue_and_dispatch(job, scan_jobs, db)

    logger.info(
        "webhooks.github_push_scan_queued",
        repository_id=str(repository.id),
        scan_job_id=str(job.id),
        branch=branch,
    )

    return WebhookAckResponse(
        status="scan_queued",
        message=f"Scan queued for '{repo_payload.get('full_name', repository.name)}' @ {branch or '(unknown ref)'}",
        scan_job_id=job.id,
        repository_id=repository.id,
    )
