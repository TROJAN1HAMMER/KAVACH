"""
KAVACH — Risk Factor Weight Repository
"""

import uuid
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.risk_factor_weight import RiskFactorWeight


class RiskFactorWeightRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def list_all(self) -> list[RiskFactorWeight]:
        result = await self.db.execute(select(RiskFactorWeight).order_by(RiskFactorWeight.factor_name))
        return list(result.scalars().all())

    async def get(self, weight_id: uuid.UUID) -> Optional[RiskFactorWeight]:
        return await self.db.get(RiskFactorWeight, weight_id)

    async def get_by_factor_name(self, factor_name: str) -> Optional[RiskFactorWeight]:
        result = await self.db.execute(
            select(RiskFactorWeight).where(RiskFactorWeight.factor_name == factor_name)
        )
        return result.scalar_one_or_none()

    async def upsert(self, *, factor_name: str, weight: float, description: Optional[str] = None) -> RiskFactorWeight:
        existing = await self.get_by_factor_name(factor_name)
        if existing:
            existing.weight = weight
            if description is not None:
                existing.description = description
            await self.db.flush()
            return existing

        row = RiskFactorWeight(factor_name=factor_name, weight=weight, description=description)
        self.db.add(row)
        await self.db.flush()
        await self.db.refresh(row)
        return row
