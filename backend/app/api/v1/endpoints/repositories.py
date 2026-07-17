"""
KAVACH — Repository API Routes
"""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query

from app.auth.dependencies import get_current_active_user
from app.auth.permissions import Permission, require_permission
from app.core.exceptions import NotFoundError, ValidationAppError
from app.models.user import User
from app.repositories.deps import get_repository_repository
from app.repositories.repository_repository import RepositoryRepository
from app.schemas.repository import RepositoryResponse, ScheduledScanUpdateRequest

router = APIRouter()


@router.get("/repositories", response_model=list[RepositoryResponse])
async def list_repositories(
    repositories: Annotated[RepositoryRepository, Depends(get_repository_repository)],
    current_user: Annotated[User, Depends(get_current_active_user)],
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
):
    """List the current user's submitted repositories (upload targets and repo-URL submissions alike)."""
    return await repositories.list_by_owner(current_user.id, limit=limit, offset=offset)


@router.patch("/repositories/{repository_id}/scheduled-scan", response_model=RepositoryResponse)
async def update_scheduled_scan(
    repository_id: uuid.UUID,
    payload: ScheduledScanUpdateRequest,
    repositories: Annotated[RepositoryRepository, Depends(get_repository_repository)],
    current_user: Annotated[User, Depends(require_permission(Permission.SCAN_CREATE))],
):
    """
    Opt a repository in to (or out of) nightly re-scanning — see
    app/tasks/scheduled_scan_tasks.py. Only URL-based repositories can be
    scheduled: a one-time zip upload has no re-fetchable source for a
    later re-scan to run against.
    """
    repo = await repositories.get(repository_id)
    if repo is None:
        raise NotFoundError("Repository not found")
    if payload.enabled and not repo.url:
        raise ValidationAppError(
            "Only repositories submitted by URL can be scheduled for nightly re-scans — this one has no URL to re-fetch"
        )
    return await repositories.set_scheduled_scan(repository_id, payload.enabled)
