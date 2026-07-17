"""
KAVACH — Risk Factor Weight Model
The other half of "weights configurable, database driven": how much each
of the 7 factors (CVSS, exploitability, business criticality, internet
exposure, compliance impact, asset value, historical incidents)
contributes to a finding's blended BRS sub-score. One row per factor;
`app/services/risk/brs_engine.py` normalizes by their sum, so they don't
need to add to any particular total — set one to 0 to disable a factor
entirely without touching code.
"""

from typing import Optional

from sqlalchemy import Float
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.db.mixins import TimestampMixin, UUIDPrimaryKeyMixin


class RiskFactorWeight(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "risk_factor_weights"

    factor_name: Mapped[str] = mapped_column(unique=True, nullable=False)
    weight: Mapped[float] = mapped_column(Float, nullable=False, default=1.0)
    description: Mapped[Optional[str]] = mapped_column(nullable=True)
