"""
KAVACH — ORM Models
Import every model module here so `Base.metadata` (and Alembic's
autogenerate) sees the full schema regardless of which module first
triggers the import.
"""

from app.models.user import User
from app.models.repository import Repository
from app.models.scan_job import ScanJob
from app.models.scan_result import ScanResult
from app.models.finding import Finding
from app.models.report import Report
from app.models.business_module import BusinessModule
from app.models.risk_factor_weight import RiskFactorWeight

__all__ = [
    "User",
    "Repository",
    "ScanJob",
    "ScanResult",
    "Finding",
    "Report",
    "BusinessModule",
    "RiskFactorWeight",
]
