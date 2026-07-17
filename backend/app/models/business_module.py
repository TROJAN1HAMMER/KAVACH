"""
KAVACH — Business Module Model
Database-driven replacement for the hardcoded `MODULE_WEIGHTS` list the
BRS engine used to carry in source: each row is one business module
(Payments, Authentication, ...) with its keyword-matching rules and the
two factors of the BRS formula that are module-specific — business
criticality and asset value. Editable via
`app/api/v1/endpoints/risk_config.py` with no code deploy required, which
is what "weights configurable" / "database driven" actually mean here.
"""

from typing import Optional

from sqlalchemy import Boolean, Float
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.db.mixins import TimestampMixin, UUIDPrimaryKeyMixin


class BusinessModule(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "business_modules"

    name: Mapped[str] = mapped_column(unique=True, nullable=False)
    keywords: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)

    # 0-10 scale, same as every other sub-score in the BRS formula.
    criticality_weight: Mapped[float] = mapped_column(Float, nullable=False, default=4.0)
    asset_value: Mapped[float] = mapped_column(Float, nullable=False, default=4.0)
    is_internet_facing_default: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    # Exactly one row should have this set — the fallback when no
    # keyword matches (was the hardcoded "General"/DEFAULT_MODULE case).
    is_default: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    description: Mapped[Optional[str]] = mapped_column(nullable=True)
