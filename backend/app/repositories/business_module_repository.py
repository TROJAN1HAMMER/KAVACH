"""
KAVACH — Business Module Repository
"""

import uuid
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.business_module import BusinessModule


class BusinessModuleRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def list_all(self) -> list[BusinessModule]:
        result = await self.db.execute(select(BusinessModule).order_by(BusinessModule.criticality_weight.desc()))
        return list(result.scalars().all())

    async def get(self, module_id: uuid.UUID) -> Optional[BusinessModule]:
        return await self.db.get(BusinessModule, module_id)

    async def get_by_name(self, name: str) -> Optional[BusinessModule]:
        result = await self.db.execute(select(BusinessModule).where(BusinessModule.name == name))
        return result.scalar_one_or_none()

    async def get_default(self) -> Optional[BusinessModule]:
        result = await self.db.execute(select(BusinessModule).where(BusinessModule.is_default.is_(True)))
        return result.scalars().first()

    async def create(
        self,
        *,
        name: str,
        keywords: list[str],
        criticality_weight: float,
        asset_value: float,
        is_internet_facing_default: bool = False,
        is_default: bool = False,
        description: Optional[str] = None,
    ) -> BusinessModule:
        module = BusinessModule(
            name=name,
            keywords=keywords,
            criticality_weight=criticality_weight,
            asset_value=asset_value,
            is_internet_facing_default=is_internet_facing_default,
            is_default=is_default,
            description=description,
        )
        self.db.add(module)
        await self.db.flush()
        await self.db.refresh(module)
        return module

    async def update(self, module: BusinessModule, **fields) -> BusinessModule:
        for key, value in fields.items():
            if value is not None:
                setattr(module, key, value)
        await self.db.flush()
        return module

    async def delete(self, module: BusinessModule) -> None:
        await self.db.delete(module)
        await self.db.flush()
