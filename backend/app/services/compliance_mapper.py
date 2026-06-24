"""
KAVACH — Regulatory DNA Engine (Compliance Mapper)
Maps vulnerability findings to regulatory control requirements.

Frameworks:
  - RBI IT Framework 2021
  - PCI DSS v4.0
  - SWIFT CSP (Customer Security Programme)

Implementation:
  JSON-based lookup table (no real-time compliance parser).
  Designed for prototype — can be upgraded to a full control graph later.

Input:  RawFinding
Output: ComplianceMappingData (rbi_clause, pci_clause, swift_clause)
"""

import json
from pathlib import Path
from dataclasses import dataclass
import structlog

from app.schemas.finding import RawFinding

logger = structlog.get_logger(__name__)


# ── Load Mappings ──────────────────────────────────────────────────────────────

_MAPPINGS_FILE = Path(__file__).parent.parent / "data" / "compliance_mappings.json"

def _load_mappings() -> dict:
    try:
        return json.loads(_MAPPINGS_FILE.read_text(encoding="utf-8"))
    except Exception as exc:
        logger.error("compliance_mapper.load_error", error=str(exc))
        return {}

# Loaded once at module import
_COMPLIANCE_MAPPINGS: dict = _load_mappings()


from typing import Optional


# ── Data Classes ──────────────────────────────────────────────────────────────

@dataclass
class ComplianceMappingData:
    rbi_clause: Optional[str]
    pci_clause: Optional[str]
    swift_clause: Optional[str]
    notes: Optional[str] = None


# ── Mapper ─────────────────────────────────────────────────────────────────────

def map_finding_to_compliance(finding: RawFinding) -> ComplianceMappingData:
    """
    Look up the regulatory controls applicable to a finding's category.

    Falls back to "unknown" mapping if category is not in the lookup table.

    Args:
        finding: A RawFinding with a populated `category` field.

    Returns:
        ComplianceMappingData with populated clauses.
    """
    category = (finding.category or "unknown").lower().replace("-", "_").replace(" ", "_")

    mapping = _COMPLIANCE_MAPPINGS.get(category)
    if not mapping:
        logger.debug("compliance_mapper.category_not_found", category=category)
        mapping = _COMPLIANCE_MAPPINGS.get("unknown", {})

    return ComplianceMappingData(
        rbi_clause=mapping.get("rbi"),
        pci_clause=mapping.get("pci"),
        swift_clause=mapping.get("swift"),
        notes=mapping.get("notes"),
    )


def map_all_findings(findings: list[RawFinding]) -> list[ComplianceMappingData]:
    """
    Map an entire findings list to compliance controls.

    Returns a list of ComplianceMappingData in the same order as findings.
    """
    results = []
    for finding in findings:
        results.append(map_finding_to_compliance(finding))

    unique_rbi = {r.rbi_clause for r in results if r.rbi_clause}
    unique_pci = {r.pci_clause for r in results if r.pci_clause}
    unique_swift = {r.swift_clause for r in results if r.swift_clause}

    logger.info(
        "compliance_mapper.summary",
        findings_mapped=len(results),
        unique_rbi_clauses=len(unique_rbi),
        unique_pci_clauses=len(unique_pci),
        unique_swift_clauses=len(unique_swift),
    )

    return results


def get_compliance_summary(findings: list[RawFinding]) -> dict:
    """
    Return a high-level compliance summary for dashboard display.
    Shows which regulatory frameworks have violations and how many.
    """
    rbi_violations = 0
    pci_violations = 0
    swift_violations = 0

    for finding in findings:
        mapping = map_finding_to_compliance(finding)
        if mapping.rbi_clause:
            rbi_violations += 1
        if mapping.pci_clause:
            pci_violations += 1
        if mapping.swift_clause:
            swift_violations += 1

    return {
        "rbi_it_framework_2021": {
            "name": "RBI IT Framework 2021",
            "violations": rbi_violations,
            "compliant": rbi_violations == 0,
        },
        "pci_dss_v4": {
            "name": "PCI DSS v4.0",
            "violations": pci_violations,
            "compliant": pci_violations == 0,
        },
        "swift_csp": {
            "name": "SWIFT Customer Security Programme",
            "violations": swift_violations,
            "compliant": swift_violations == 0,
        },
    }
