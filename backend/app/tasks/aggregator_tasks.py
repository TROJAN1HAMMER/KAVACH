"""
KAVACH — Scan Result Aggregator
The Celery chord callback: fires once every scanner task in the group
(app/tasks/scanner_tasks.py) has returned — success or best-effort
failure, since scanner tasks never raise. Celery hands this the group's
results as `results` automatically; `scan_job_id` is bound via `.s()`
when the chord is built in `scan_tasks.py`.

Responsibilities:
  1. Reconstruct findings from each scanner's JSON-safe result dict
  2. Cross-tool correlate, deduplicate, and taxonomy-enrich them via the
     aggregation layer (app/services/aggregation/) — this replaced the
     old per-source-only fingerprint dedup in
     app/services/scanning/aggregator.py's `aggregate_findings`, which
     structurally can't merge the same issue reported by two different
     tools (its fingerprint includes `source`, so two tools always
     produce two fingerprints for what's really one finding)
  3. Score (BRS, attack surface exposure), map to compliance, generate AI insights —
     identical calls to what the pipeline always made; `UnifiedFinding`
     is a strict superset of `RawFinding`, so none of that code changed
  4. Persist Finding/Report/ScanResult (now carrying cross-tool
     provenance + CWE/OWASP/MITRE ATT&CK columns), finalize the ScanJob
  5. Write the unified, enriched JSON as a new downloadable report
     artifact — the literal "generate unified JSON" deliverable
  6. Clean up the extracted repo_dir and artifact — only safe here, now
     that every scanner is confirmed done reading from it
  7. If literally every scanner failed, treat it as a whole-job failure
     eligible for the same job-level retry as before (a systemic issue —
     broken environment, corrupted artifact — not a single tool's problem)
"""

import asyncio
import shutil
import uuid
from pathlib import Path
from typing import Optional

import structlog

from app.config import get_settings
from app.db.session import AsyncSessionLocal
from app.models.enums import ScanJobStatus
from app.models.finding import Finding
from app.orchestrator import scan_status
from app.repositories.finding_repository import FindingRepository
from app.repositories.report_repository import ReportRepository
from app.repositories.repository_repository import RepositoryRepository
from app.repositories.scan_job_repository import ScanJobRepository
from app.repositories.scan_result_repository import ScanResultRepository
from app.schemas.finding import RawFinding
from app.services.aggregation.aggregation_engine import aggregate, to_unified_json
from app.services.aggregation.unified_finding import UnifiedFinding
from app.services.ai.ai_engine import generate_batch_insights
from app.services.compliance.compliance_engine import evaluate_compliance
from app.services.compliance.compliance_mapper import get_compliance_summary, map_all_findings
from app.services.notifications.notification_service import get_notification_service
from app.services.reports import report_generator
from app.services.risk.brs_engine import _calculate_risk_level, calculate_brs
from app.services.risk.attack_surface_exposure import calculate_attack_surface_exposure
from app.services.scanning.aggregator import summarize_findings
from app.tasks.report_tasks import generate_reports_task
from app.workers.celery_app import celery_app, queue_for_priority

logger = structlog.get_logger(__name__)
settings = get_settings()

FALLBACK_SBOM = {
    "bomFormat": "CycloneDX",
    "specVersion": "1.4",
    "version": 1,
    "components": [],
    "metadata": {"component": {"name": "pip-audit-unavailable"}},
}


@celery_app.task(name="kavach.aggregate_scan_results", bind=True)
def aggregate_scan_results_task(self, results: list[dict], scan_job_id: str) -> None:
    logger.info("aggregator.started", scan_job_id=scan_job_id, scanner_results=len(results))
    asyncio.run(_aggregate(results, scan_job_id))


async def _aggregate(results: list[dict], scan_job_id: str) -> None:
    job_uuid = uuid.UUID(scan_job_id)
    repo_dir = Path(settings.upload_dir) / f"repo_{scan_job_id}"

    async with AsyncSessionLocal() as db:
        scan_jobs = ScanJobRepository(db)
        findings_repo = FindingRepository(db)
        reports_repo = ReportRepository(db)
        results_repo = ScanResultRepository(db)
        repositories_repo = RepositoryRepository(db)

        job = await scan_jobs.get(job_uuid)
        if not job:
            logger.error("aggregator.job_not_found", scan_job_id=scan_job_id)
            _cleanup(repo_dir, None)
            return

        if job.status == ScanJobStatus.CANCELLED:
            logger.info("aggregator.job_was_cancelled — skipping finalization", scan_job_id=scan_job_id)
            _cleanup(repo_dir, Path(job.artifact_path) if job.artifact_path else None)
            scan_status.clear(scan_job_id)
            return

        successful = [r for r in results if r.get("success")]
        failed = [r for r in results if not r.get("success")]

        if not successful:
            error_summary = "; ".join(f"{r['scanner']}: {r.get('error', 'unknown error')}" for r in failed)
            logger.error("aggregator.all_scanners_failed", scan_job_id=scan_job_id, errors=error_summary)

            if scan_jobs.should_retry(job):
                await scan_jobs.prepare_retry(job)
                await db.commit()
                logger.warning("aggregator.retrying_whole_job", scan_job_id=scan_job_id, retry_count=job.retry_count)
                from app.tasks.scan_tasks import dispatch_scan_job

                dispatch_scan_job(job, countdown=2**job.retry_count * 30)
            else:
                await scan_jobs.mark_failed(job, error_message=f"All scanners failed: {error_summary}")
                await db.commit()
                repository = await repositories_repo.get(job.repository_id)
                await get_notification_service().notify_scan_failed(
                    scan_job_id=scan_job_id,
                    repository_name=repository.name if repository else "unknown",
                    error_message=error_summary,
                )

            _cleanup(repo_dir, Path(job.artifact_path) if job.artifact_path else None)
            scan_status.clear(scan_job_id)
            return

        repository = await repositories_repo.get(job.repository_id)
        repo_name = repository.name if repository else "unknown"

        # ── Reconstruct findings per scanner, keyed by scanner name ──
        findings_by_source: dict[str, list[RawFinding]] = {}
        sbom: Optional[dict] = None
        for result in successful:
            findings_by_source[result["scanner"]] = [RawFinding(**f) for f in result.get("findings", [])]
            if result["scanner"] == "pip-audit" and result.get("sbom"):
                sbom = result["sbom"]
        if sbom is None:
            sbom = FALLBACK_SBOM

        # ── Cross-tool correlate, dedupe, and enrich (the aggregation layer) ──
        aggregation_result = aggregate(findings_by_source)
        all_findings: list[UnifiedFinding] = aggregation_result.findings

        # ── Score / map / enrich (identical calls to what always ran here —
        # UnifiedFinding is a strict superset of RawFinding). Compliance
        # mapping now has to run before BRS scoring, not after: the
        # business-aware engine's "compliance impact" factor needs each
        # finding's mapped framework count as an input. ──
        compliance_data_list = map_all_findings(all_findings)
        brs_result = await calculate_brs(
            all_findings,
            db=db,
            repository_id=job.repository_id,
            compliance_data_list=compliance_data_list,
            scanner_coverage_ratio=len(successful) / len(results) if results else 1.0,
        )
        attack_surface_result = calculate_attack_surface_exposure(all_findings, sbom)
        ai_insights = await asyncio.to_thread(generate_batch_insights, all_findings, compliance_data_list)

        # ── Build Finding rows + report_generator's plain-dict shape ──
        finding_rows: list[Finding] = []
        finding_dicts_for_reports: list[dict] = []

        for i, unified_finding in enumerate(all_findings):
            brs_score = brs_result.finding_scores[i]["brs"]
            brs_risk_level = _calculate_risk_level(brs_score)
            brs_module = brs_result.finding_scores[i]["module"]
            insight = ai_insights[i]
            comp_data = compliance_data_list[i]

            finding_rows.append(
                Finding(
                    scan_job_id=job.id,
                    title=unified_finding.title,
                    severity=unified_finding.severity,
                    category=unified_finding.category,
                    source=unified_finding.source,
                    cvss=unified_finding.cvss,
                    brs=brs_score,
                    brs_risk_level=brs_risk_level,
                    module=brs_module,
                    file_path=unified_finding.file_path,
                    line_number=unified_finding.line_number,
                    description=unified_finding.description,
                    package=unified_finding.package,
                    package_version=unified_finding.package_version,
                    cve=unified_finding.cve,
                    ai_explanation=insight.explanation if insight else None,
                    ai_business_impact=insight.business_impact if insight else None,
                    ai_remediation=insight.remediation if insight else None,
                    rbi_clause=comp_data.rbi_clause if comp_data else None,
                    pci_clause=comp_data.pci_clause if comp_data else None,
                    swift_clause=comp_data.swift_clause if comp_data else None,
                    sources=unified_finding.sources,
                    occurrence_count=unified_finding.occurrence_count,
                    cwe_id=unified_finding.cwe_id,
                    cwe_name=unified_finding.cwe_name,
                    owasp_category=unified_finding.owasp_category,
                    owasp_name=unified_finding.owasp_name,
                    mitre_technique_ids=unified_finding.mitre_technique_ids,
                )
            )

            finding_dicts_for_reports.append(
                {
                    "severity": unified_finding.severity,
                    "title": unified_finding.title,
                    "category": unified_finding.category,
                    "cvss": unified_finding.cvss,
                    "brs": brs_score,
                    "module": brs_module,
                    "file_path": unified_finding.file_path,
                    "line_number": unified_finding.line_number,
                    "description": unified_finding.description,
                    "source": unified_finding.source,
                    "sources": unified_finding.sources,
                    "cwe_id": unified_finding.cwe_id,
                    "owasp_category": unified_finding.owasp_category,
                    "ai_explanation": insight.explanation if insight else None,
                    "ai_business_impact": insight.business_impact if insight else None,
                    "ai_remediation": insight.remediation if insight else None,
                    "compliance": (
                        {
                            "rbi_clause": comp_data.rbi_clause,
                            "pci_clause": comp_data.pci_clause,
                            "swift_clause": comp_data.swift_clause,
                        }
                        if comp_data and (comp_data.rbi_clause or comp_data.pci_clause or comp_data.swift_clause)
                        else None
                    ),
                }
            )

        await findings_repo.bulk_create(finding_rows)

        # ── Reports ──
        summary = summarize_findings(all_findings)
        summary["scanner_status"] = {r["scanner"]: "completed" for r in successful} | {
            r["scanner"]: f"failed: {r.get('error', 'unknown')}" for r in failed
        }
        summary["aggregation"] = {
            "total_raw_findings": aggregation_result.total_raw_findings,
            "total_unified_findings": aggregation_result.total_unified_findings,
            "duplicates_merged": aggregation_result.duplicates_merged,
            "by_owasp_category": aggregation_result.by_owasp_category,
        }
        compliance_summary = get_compliance_summary(all_findings)

        # ── Unified JSON — the aggregation layer's own artifact ──
        unified_json = to_unified_json(aggregation_result, scan_job_id=scan_job_id, repo_name=repo_name)

        # ── Compliance Engine — deterministic PCI/RBI/SWIFT control evaluation.
        # A frozen point-in-time snapshot for this scan; GET /scan/{id}/compliance
        # (app/api/v1/endpoints/scan.py) recomputes live from the persisted
        # Findings instead, which matters specifically because the rules are
        # YAML — an updated rule file changes future evaluations of *this*
        # scan's already-stored findings without needing to re-scan. ──
        compliance_result = evaluate_compliance(all_findings)
        compliance_json = {
            "scan_job_id": scan_job_id,
            "repository": repo_name,
            "overall_compliance_percentage": compliance_result.overall_compliance_percentage,
            "frameworks": [
                {
                    "framework_name": r.framework_name,
                    "short_code": r.short_code,
                    "version": r.version,
                    "total_controls": r.total_controls,
                    "passed_controls": r.passed_controls,
                    "failed_controls": r.failed_controls,
                    "compliance_percentage": r.compliance_percentage,
                    "controls": [
                        {
                            "requirement_id": c.requirement_id,
                            "title": c.title,
                            "description": c.description,
                            "status": c.status,
                            "recommendation": c.recommendation,
                            "evidence": [
                                {
                                    "finding_title": e.finding_title,
                                    "severity": e.severity,
                                    "file_path": e.file_path,
                                    "line_number": e.line_number,
                                    "source": e.source,
                                }
                                for e in c.evidence
                            ],
                        }
                        for c in r.controls
                    ],
                }
                for r in compliance_result.frameworks
            ],
        }

        # ── Reports are generated asynchronously — this only creates the
        # "pending" rows (so GET /reports/{scan_job_id} can see them exist
        # immediately) and dispatches the actual rendering/S3-upload work to
        # its own Celery task. ScanJob.mark_completed() below does NOT wait
        # on report generation, which is what makes it genuinely async: a
        # slow PDF chart or an S3 hiccup delays report availability, not the
        # scan's own completion. ──
        for report_type in report_generator.REPORT_BUILDERS:
            await reports_repo.create_pending(scan_job_id=job.id, report_type=report_type)

        generate_reports_task.apply_async(
            kwargs={
                "scan_job_id": scan_job_id,
                "repo_name": repo_name,
                "findings": finding_dicts_for_reports,
                "brs_score": brs_result.total_brs,
                "brs_risk_level": brs_result.risk_level,
                "attack_surface_exposure_score": attack_surface_result.risk_score,
                "attack_surface_exposure_level": attack_surface_result.risk_level,
                "compliance_summary": compliance_summary,
                "summary": summary,
                "sbom": sbom,
                "unified_json": unified_json,
                "compliance_json": compliance_json,
            },
            queue=queue_for_priority(job.priority),
            time_limit=300,
            soft_time_limit=270,
        )

        # ── Finalize ──
        await results_repo.create(
            scan_job_id=job.id,
            total_findings=len(all_findings),
            brs_score=brs_result.total_brs,
            brs_risk_level=brs_result.risk_level,
            attack_surface_exposure_score=attack_surface_result.risk_score,
            attack_surface_exposure_level=attack_surface_result.risk_level,
            summary=summary,
            compliance_summary=compliance_summary,
        )
        await scan_jobs.mark_completed(job)
        await db.commit()

        await get_notification_service().notify_scan_completed(
            scan_job_id=scan_job_id,
            repository_name=repo_name,
            brs_score=brs_result.total_brs,
            risk_level=brs_result.risk_level,
            severity_counts={sev: summary.get(sev, 0) for sev in ("CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO")},
        )

        logger.info(
            "aggregator.complete",
            scan_job_id=scan_job_id,
            total_findings=len(all_findings),
            duplicates_merged=aggregation_result.duplicates_merged,
            scanners_succeeded=len(successful),
            scanners_failed=len(failed),
        )

        _cleanup(repo_dir, Path(job.artifact_path) if job.artifact_path else None)
        scan_status.clear(scan_job_id)


def _cleanup(repo_dir: Path, artifact_path: Optional[Path]) -> None:
    if repo_dir.exists():
        shutil.rmtree(repo_dir, ignore_errors=True)
    if artifact_path and artifact_path.exists():
        artifact_path.unlink(missing_ok=True)
