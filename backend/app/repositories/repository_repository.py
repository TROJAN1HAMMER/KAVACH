"""
KAVACH — Repository Repository
"""

import uuid
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import RepoProviderType
from app.models.repository import Repository


class RepositoryRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def create(
        self,
        *,
        name: str,
        provider: RepoProviderType,
        url: Optional[str] = None,
        default_branch: Optional[str] = None,
        owner_id: Optional[uuid.UUID] = None,
    ) -> Repository:
        repo = Repository(
            name=name, provider=provider, url=url, default_branch=default_branch, owner_id=owner_id
        )
        self.db.add(repo)
        await self.db.flush()
        await self.db.refresh(repo)
        return repo

    async def get(self, repository_id: uuid.UUID) -> Optional[Repository]:
        return await self.db.get(Repository, repository_id)

    async def get_by_url(self, url: str) -> Optional[Repository]:
        """
        Get-or-create anchor for anything that submits the same repo URL
        repeatedly — a re-scan, and especially a GitHub webhook, which
        fires on every push to the same repo. Without this, each call
        would insert a fresh Repository row and the dashboard's
        Repositories list would accumulate one duplicate per push.
        """
        result = await self.db.execute(select(Repository).where(Repository.url == url))
        return result.scalar_one_or_none()

    async def list_by_owner(
        self, owner_id: uuid.UUID, *, limit: int = 50, offset: int = 0
    ) -> list[Repository]:
        result = await self.db.execute(
            select(Repository)
            .where(Repository.owner_id == owner_id)
            .order_by(Repository.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
        return list(result.scalars().all())

    async def list_scheduled(self) -> list[Repository]:
        """Every repository opted in to nightly re-scanning — see app/tasks/scheduled_scan_tasks.py."""
        result = await self.db.execute(
            select(Repository).where(
                Repository.scheduled_scan_enabled.is_(True), Repository.url.is_not(None)
            )
        )
        return list(result.scalars().all())

    async def set_scheduled_scan(self, repository_id: uuid.UUID, enabled: bool) -> Optional[Repository]:
        repo = await self.get(repository_id)
        if repo is not None:
            repo.scheduled_scan_enabled = enabled
            await self.db.flush()
        return repo
