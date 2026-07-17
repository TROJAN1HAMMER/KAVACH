"""
KAVACH — Scan Intake
Single shared path from "a repository URL, from wherever it came from" to
"a queued, dispatched ScanJob" — used by both `POST /scan/repository`
(`app/api/v1/endpoints/scan.py`, an authenticated user submitting a URL by
hand) and the GitHub webhook receiver (`app/api/v1/endpoints/webhooks.py`,
an unauthenticated push event). Keeping this in one place means a repeat
submission of the same URL — a manual re-scan, or a second push to the
same repo — always resolves to the same Repository row via
`get_or_create_repository` instead of each caller accumulating its own
duplicate.
"""

import uuid
from typing import Optional
from urllib.parse import urlparse

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import RepoProviderType, ScanJobPriority
from app.models.repository import Repository
from app.models.scan_job import ScanJob
from app.repositories.repository_repository import RepositoryRepository
from app.repositories.scan_job_repository import ScanJobRepository
from app.tasks.scan_tasks import dispatch_scan_job


def detect_provider(repo_url: str) -> tuple[RepoProviderType, str]:
    """Validate the URL and infer both provider + a display name from it."""
    parsed = urlparse(repo_url)
    if parsed.scheme not in ("http", "https") or not parsed.netloc:
        raise HTTPException(status_code=400, detail="repo_url must be a valid http(s) URL")

    host = parsed.netloc.lower()
    parts = [p for p in parsed.path.split("/") if p]
    if len(parts) < 2:
        raise HTTPException(status_code=400, detail="repo_url must include an owner and repository name")

    name = parts[1]
    if name.endswith(".git"):
        name = name[: -len(".git")]

    if "github.com" in host:
        return RepoProviderType.GITHUB, name
    if "gitlab.com" in host:
        return RepoProviderType.GITLAB, name
    if "bitbucket.org" in host:
        return RepoProviderType.BITBUCKET, name

    raise HTTPException(
        status_code=400,
        detail=f"Unsupported repository host '{host}' — only GitHub, GitLab, and Bitbucket are supported",
    )


async def get_or_create_repository(
    repositories: RepositoryRepository,
    *,
    url: str,
    name: str,
    provider: RepoProviderType,
    owner_id: Optional[uuid.UUID],
    default_branch: Optional[str] = None,
) -> Repository:
    existing = await repositories.get_by_url(url)
    if existing is not None:
        return existing
    return await repositories.create(
        name=name, provider=provider, url=url, default_branch=default_branch, owner_id=owner_id
    )


async def queue_and_dispatch(job: ScanJob, scan_jobs: ScanJobRepository, db: AsyncSession) -> None:
    """
    Commit the queued job *before* dispatching to Celery: `.delay()`/
    `.apply_async()` publishes to Redis immediately, and a worker on a
    separate DB connection won't see this row until the transaction
    commits — without this, the worker could query for the job before it
    exists from its point of view.
    """
    await db.commit()
    task_id = dispatch_scan_job(job)
    await scan_jobs.set_celery_task_id(job, task_id)
    await db.commit()


async def submit_repository_scan(
    *,
    repo_url: str,
    ref: Optional[str],
    priority: ScanJobPriority,
    max_retries: int,
    timeout_seconds: int,
    owner_id: Optional[uuid.UUID],
    repositories: RepositoryRepository,
    scan_jobs: ScanJobRepository,
    db: AsyncSession,
) -> tuple[Repository, ScanJob]:
    """
    The full intake path: validate the URL, resolve (or reuse) its
    Repository row, create a queued ScanJob, and dispatch it. `owner_id`
    is nullable throughout — a webhook-triggered scan has no authenticated
    user behind it, only a verified GitHub delivery.
    """
    provider_type, name = detect_provider(repo_url)

    repository = await get_or_create_repository(
        repositories, url=repo_url, name=name, provider=provider_type, owner_id=owner_id
    )
    job = await scan_jobs.create_queued(
        repository_id=repository.id,
        owner_id=owner_id,
        ref=ref,
        priority=priority,
        max_retries=max_retries,
        timeout_seconds=timeout_seconds,
    )

    await queue_and_dispatch(job, scan_jobs, db)

    return repository, job
