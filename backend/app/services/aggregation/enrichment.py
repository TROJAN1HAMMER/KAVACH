"""
KAVACH — Finding Enrichment
Turns one correlation group (a set of RawFindings the deduplicator
decided represent the same underlying issue) into a single UnifiedFinding:
picks the most severe instance as the representative, normalizes its
severity, maps it to CWE/OWASP/MITRE ATT&CK, and combines any CVE detail
across the group.
"""

from app.schemas.finding import RawFinding
from app.services.aggregation.cwe_mapping import map_to_cwe
from app.services.aggregation.mitre_attack_mapping import map_to_attack
from app.services.aggregation.owasp_mapping import map_to_owasp
from app.services.aggregation.severity import normalize_severity
from app.services.aggregation.unified_finding import CVEDetail, UnifiedFinding


def enrich_group(finding_id: str, group: list[RawFinding]) -> UnifiedFinding:
    scored = sorted(
        ((normalize_severity(f.severity, f.cvss), f) for f in group),
        key=lambda item: item[0][1],
        reverse=True,
    )
    (canonical_severity, severity_score), primary = scored[0]

    sources = sorted({f.source for f in group})
    cwe_id, cwe_name = map_to_cwe(primary.category)
    owasp_code, owasp_name = map_to_owasp(cwe_id, primary.category)
    attack_ids, attack_names = map_to_attack(primary.category)

    cve_groups: dict[str, list[RawFinding]] = {}
    for f in group:
        if f.cve:
            cve_groups.setdefault(f.cve, []).append(f)
    cve_details = [
        CVEDetail(
            cve_id=cve_id,
            sources=sorted({f.source for f in cve_findings}),
            description=next((f.description for f in cve_findings if f.description), None),
        )
        for cve_id, cve_findings in cve_groups.items()
    ]

    merged_fields = primary.model_dump()
    merged_fields["severity"] = canonical_severity
    merged_fields["cvss"] = severity_score

    return UnifiedFinding(
        **merged_fields,
        finding_id=finding_id,
        canonical_severity=canonical_severity,
        severity_score=severity_score,
        sources=sources,
        occurrence_count=len(group),
        cwe_id=cwe_id,
        cwe_name=cwe_name,
        owasp_category=owasp_code,
        owasp_name=owasp_name,
        mitre_technique_ids=attack_ids,
        mitre_technique_names=attack_names,
        cve_details=cve_details,
    )
