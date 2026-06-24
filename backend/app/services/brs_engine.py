"""
KAVACH — Banking Risk Score (BRS) Engine
Prioritizes findings according to their banking business impact.

Formula:
    BRS = CVSS × Module Weight × Severity Multiplier

Module Weights (inferred from file path / category):
    Payments        = 3.0
    Authentication  = 2.5
    Customer Data   = 2.0
    Admin Portal    = 1.5
    Reporting       = 1.0
    Default         = 1.2

Risk Levels:
    0–10:   Low
    10–20:  Medium
    20–30:  High
    30+:    Critical

Input:  list[RawFinding]
Output: BRS score, risk level, per-finding BRS scores
"""

import re
from dataclasses import dataclass
import structlog

from app.schemas.finding import RawFinding

logger = structlog.get_logger(__name__)


# ── Module Weight Configuration ────────────────────────────────────────────────

MODULE_WEIGHTS: list[tuple[list[str], float, str]] = [
    # (path/category keywords, weight, module_label)
    (["payment", "pay", "transaction", "transfer", "remittance", "upi", "neft", "imps", "rtgs"], 3.0, "Payments"),
    (["auth", "login", "jwt", "session", "oauth", "token", "password", "credential", "2fa", "mfa"], 2.5, "Authentication"),
    (["customer", "kyc", "pii", "personal", "account", "user_data", "profile", "aadhaar", "pan"], 2.0, "CustomerData"),
    (["admin", "management", "superuser", "root", "dashboard", "config", "setting"], 1.5, "AdminPortal"),
    (["report", "audit", "log", "analytics", "statement", "export"], 1.0, "Reporting"),
]

DEFAULT_WEIGHT = 1.2
DEFAULT_MODULE = "General"


# ── Severity Multipliers ───────────────────────────────────────────────────────

SEVERITY_MULTIPLIERS = {
    "CRITICAL": 1.5,
    "HIGH": 1.2,
    "MEDIUM": 1.0,
    "LOW": 0.7,
    "INFO": 0.3,
}


@dataclass
class BRSResult:
    total_brs: float
    risk_level: str
    finding_scores: list[dict]  # {finding_index, brs, module, weight}


def _infer_module(finding: RawFinding) -> tuple[str, float]:
    """
    Infer the banking module and weight from a finding's file path and category.
    Returns (module_label, weight).
    """
    search_text = " ".join(filter(None, [
        finding.file_path or "",
        finding.category or "",
        finding.title or "",
        finding.description or "",
    ])).lower()

    for keywords, weight, label in MODULE_WEIGHTS:
        if any(kw in search_text for kw in keywords):
            return label, weight

    return DEFAULT_MODULE, DEFAULT_WEIGHT


def calculate_brs(findings: list[RawFinding]) -> BRSResult:
    """
    Calculate Banking Risk Score for a list of findings.

    Returns:
        BRSResult with total BRS, risk level, and per-finding scores.
    """
    if not findings:
        return BRSResult(total_brs=0.0, risk_level="Low", finding_scores=[])

    finding_scores = []
    brs_list = []

    for i, finding in enumerate(findings):
        module_label, weight = _infer_module(finding)
        severity_mult = SEVERITY_MULTIPLIERS.get(finding.severity.upper(), 1.0)

        # BRS = CVSS × Module Weight × Severity Multiplier
        brs = round(finding.cvss * weight * severity_mult, 2)
        brs_list.append(brs)

        finding_scores.append({
            "finding_index": i,
            "brs": brs,
            "module": module_label,
            "weight": weight,
            "severity_multiplier": severity_mult,
        })

    # Avoid dilution: Use the highest BRS as baseline, plus 10% of the rest of findings
    max_brs = max(brs_list) if brs_list else 0.0
    other_brs_sum = sum(brs_list) - max_brs if brs_list else 0.0
    normalized_brs = round(min(max_brs + (other_brs_sum * 0.1), 100.0), 2)

    risk_level = _calculate_risk_level(normalized_brs)

    logger.info(
        "brs_engine.complete",
        total_findings=len(findings),
        total_raw_brs=sum(brs_list),
        normalized_brs=normalized_brs,
        risk_level=risk_level,
    )

    return BRSResult(
        total_brs=normalized_brs,
        risk_level=risk_level,
        finding_scores=finding_scores,
    )


def _calculate_risk_level(brs: float) -> str:
    """Map BRS score to risk level label."""
    if brs >= 30:
        return "Critical"
    elif brs >= 20:
        return "High"
    elif brs >= 10:
        return "Medium"
    else:
        return "Low"


def get_finding_brs(finding: RawFinding) -> tuple[float, str]:
    """
    Calculate BRS for a single finding.
    Returns (brs_score, risk_level).
    """
    module_label, weight = _infer_module(finding)
    severity_mult = SEVERITY_MULTIPLIERS.get(finding.severity.upper(), 1.0)
    brs = round(finding.cvss * weight * severity_mult, 2)
    return brs, _calculate_risk_level(brs)
