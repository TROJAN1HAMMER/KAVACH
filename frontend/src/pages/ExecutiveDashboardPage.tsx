import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, BarChart3, Database, Download, ShieldCheck, Siren } from "lucide-react";
import { PageHeader } from "../components/ui/PageHeader";
import { StatTile } from "../components/ui/StatTile";
import { Card, CardContent, CardHeader } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { SkeletonStatTiles, SkeletonChartCard, SkeletonTable } from "../components/ui/Skeleton";
import { EmptyState } from "../components/ui/EmptyState";
import { Badge } from "../components/ui/Badge";
import { RevealSection, RevealItem } from "../components/landing/RevealSection";
import { ExecutiveIntelligencePanel } from "../components/executive/ExecutiveIntelligencePanel";
import { useRepositories } from "../hooks/useRepositories";
import { useScanJobs } from "../hooks/useScanJobs";
import { useReportStatus } from "../hooks/useFindings";
import { usePermissions } from "../hooks/usePermissions";
import { reportsApi } from "../lib/api/reports";
import { extractSeverityCounts } from "../lib/severity";
import { formatScore } from "../lib/utils";
import type { ScanJobStatusResponse, Severity } from "../types/api";

// Same BRS tier thresholds already used in the PDF report generator's own
// "Risk Score Model Explanation" copy (backend/.../report_generator.py) —
// kept in sync deliberately rather than re-deriving a second cutoff table.
function brsTier(avgBrs: number | null): { label: string; tone: "danger" | "warning" | "success" | "neutral" } {
  if (avgBrs === null) return { label: "No data", tone: "neutral" };
  if (avgBrs >= 82) return { label: "Critical posture", tone: "danger" };
  if (avgBrs >= 58) return { label: "High posture", tone: "danger" };
  if (avgBrs >= 35) return { label: "Medium posture", tone: "warning" };
  return { label: "Low posture", tone: "success" };
}

/** Reuses the exact per-scan report-download mechanism `ScanDetailPanel`
 *  already has — pointed at the most recently completed scan, since reports
 *  are generated per-scan and there's no separate "portfolio PDF" artifact
 *  to invent. */
function ExecutivePdfButton({ scanJobId, repositoryName }: { scanJobId: string; repositoryName: string }) {
  const { data: reportStatus } = useReportStatus(scanJobId);
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!reportStatus?.pdf_available) return null;

  const handleDownload = async () => {
    setError(null);
    setIsDownloading(true);
    try {
      await reportsApi.download(scanJobId, "pdf", `${repositoryName}-executive-summary`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Download failed. Please try again.");
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div>
      <Button variant="secondary" size="sm" isLoading={isDownloading} onClick={handleDownload}>
        <Download className="size-3.5" />
        Executive report (PDF)
      </Button>
      {error && <p className="mt-2 text-xs text-danger">{error}</p>}
    </div>
  );
}

export default function ExecutiveDashboardPage() {
  const navigate = useNavigate();
  const { hasPermission } = usePermissions();
  const { data: repositories, isLoading: loadingRepos } = useRepositories();
  const { data: scanJobsData, isLoading: loadingScans } = useScanJobs({ status: "completed", limit: 100 });

  const completedJobs = useMemo(
    () => [...(scanJobsData?.scan_jobs ?? [])].sort((a, b) => (b.finished_at ?? "").localeCompare(a.finished_at ?? "")),
    [scanJobsData],
  );

  const portfolioSummary = useMemo(() => {
    const severityTotals: Partial<Record<Severity, number>> = {};
    let totalFindings = 0;
    let brsSum = 0;
    let brsCount = 0;

    for (const job of completedJobs) {
      if (job.brs_score !== null) {
        brsSum += job.brs_score;
        brsCount += 1;
      }
      totalFindings += job.total_findings ?? 0;
      for (const [severity, count] of Object.entries(extractSeverityCounts(job.summary))) {
        severityTotals[severity as Severity] = (severityTotals[severity as Severity] ?? 0) + count;
      }
    }

    return {
      avgBrs: brsCount > 0 ? brsSum / brsCount : null,
      totalFindings,
      severityTotals,
      criticalCount: severityTotals.CRITICAL ?? 0,
      highCount: severityTotals.HIGH ?? 0,
    };
  }, [completedJobs]);

  // Top-risk repositories, keeping the whole job (not just score/name) so
  // the "top business risks" narrative below can cite each repo's actual
  // finding severity mix, not just its score.
  const topRiskJobs = useMemo(() => {
    const byRepo = new Map<string, ScanJobStatusResponse>();
    for (const job of completedJobs) {
      const existing = byRepo.get(job.repository_id);
      if (!existing || (job.brs_score ?? 0) > (existing.brs_score ?? 0)) {
        byRepo.set(job.repository_id, job);
      }
    }
    return [...byRepo.values()].sort((a, b) => (b.brs_score ?? 0) - (a.brs_score ?? 0)).slice(0, 5);
  }, [completedJobs]);

  const { criticalCount, highCount } = portfolioSummary;
  const tier = brsTier(portfolioSummary.avgBrs);

  const financialImpactText =
    criticalCount > 0
      ? `${criticalCount} critical-severity finding${criticalCount === 1 ? "" : "s"} across the portfolio carry potential regulatory exposure under RBI, PCI-DSS, and SWIFT CSP — unresolved critical findings are the most common driver of audit findings and financial penalties in banking security reviews.`
      : highCount > 0
        ? `No critical findings are currently open, but ${highCount} high-severity finding${highCount === 1 ? "" : "s"} remain outstanding — left unresolved, these represent moderate but real compliance and financial risk.`
        : "No critical or high-severity findings are currently open across the portfolio — regulatory and financial exposure from known vulnerabilities is currently low.";

  const recommendations = useMemo(() => {
    const list: string[] = [];
    if (criticalCount > 0) {
      list.push(`Remediate the ${criticalCount} critical finding${criticalCount === 1 ? "" : "s"} immediately — these represent the portfolio's most urgent exposure.`);
    }
    if (highCount > 0) {
      list.push(`Schedule remediation for ${highCount} high-severity finding${highCount === 1 ? "" : "s"} within the current sprint cycle.`);
    }
    if (criticalCount === 0 && highCount === 0) {
      list.push("Maintain the current scanning cadence — no urgent remediation is outstanding.");
    }
    list.push("Review repositories with elevated Banking Risk Scores for architectural or dependency-level root causes rather than one-off patches.");
    return list;
  }, [criticalCount, highCount]);

  const latestJob = completedJobs[0];
  const canDownloadReports = hasPermission("report:download");

  if (loadingRepos || loadingScans) {
    return (
      <div>
        <PageHeader title="Executive Summary" description="A non-technical, portfolio-level view of security posture for leadership." />
        <SkeletonStatTiles className="mb-6" count={3} />
        <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <SkeletonChartCard />
          <SkeletonChartCard />
        </div>
        <SkeletonTable rows={5} columns={3} />
      </div>
    );
  }

  if (completedJobs.length === 0) {
    return (
      <div>
        <PageHeader title="Executive Summary" description="A non-technical, portfolio-level view of security posture for leadership." />
        <EmptyState icon={<BarChart3 className="size-10" />} title="No completed scans yet" />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Executive Summary"
        description="A non-technical, portfolio-level view of security posture, business risk, and strategic priorities."
        action={canDownloadReports && latestJob ? <ExecutivePdfButton scanJobId={latestJob.scan_job_id} repositoryName={latestJob.repository_name} /> : undefined}
      />

      <RevealSection className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <RevealItem>
          <StatTile label="Repositories" value={repositories?.length ?? 0} icon={<Database className="size-5" />} />
        </RevealItem>
        <RevealItem>
          <StatTile label="Completed scans" value={completedJobs.length} icon={<BarChart3 className="size-5" />} />
        </RevealItem>
        <RevealItem>
          <StatTile label="Critical findings" value={portfolioSummary.criticalCount} icon={<Siren className="size-5" />} />
        </RevealItem>
      </RevealSection>

      <RevealSection className="mb-6">
        <RevealItem>
          <Card>
            <CardContent className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <ShieldCheck className="size-8 text-primary" />
                <div>
                  <div className="flex items-center gap-2">
                    <Badge tone={tier.tone}>{tier.label}</Badge>
                    <span className="text-sm text-muted-foreground">Average BRS {formatScore(portfolioSummary.avgBrs)}</span>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">Overall security posture across every scanned repository.</p>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={() => navigate("/risk")}>
                View full risk analysis
                <ArrowRight className="size-3.5" />
              </Button>
            </CardContent>
          </Card>
        </RevealItem>
      </RevealSection>

      <RevealSection className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <RevealItem>
          <Card className="h-full">
            <CardHeader title="Top business risks" description="Repositories carrying the most business exposure right now." />
            <CardContent>
              <ul className="space-y-3">
                {topRiskJobs.map((job) => {
                  const counts = extractSeverityCounts(job.summary);
                  const critical = counts.CRITICAL ?? 0;
                  const high = counts.HIGH ?? 0;
                  const headline = critical > 0 ? `${critical} critical finding${critical === 1 ? "" : "s"}` : high > 0 ? `${high} high-severity finding${high === 1 ? "" : "s"}` : "no critical or high findings";
                  return (
                    <li key={job.repository_id} className="text-sm text-foreground">
                      <span className="font-medium">{job.repository_name}</span>
                      <span className="text-muted-foreground"> — {headline}, BRS {formatScore(job.brs_score)} ({job.brs_risk_level ?? "—"} risk).</span>
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>
        </RevealItem>

        <RevealItem>
          <Card className="h-full">
            <CardHeader title="Financial & regulatory impact" description="Exposure framed in business, not technical, terms." />
            <CardContent>
              <p className="text-sm text-foreground">{financialImpactText}</p>
            </CardContent>
          </Card>
        </RevealItem>
      </RevealSection>

      <RevealSection className="mb-6">
        <RevealItem>
          <Card>
            <CardHeader title="Strategic recommendations" />
            <CardContent>
              <ul className="list-disc space-y-2 pl-5">
                {recommendations.map((item) => (
                  <li key={item} className="text-sm text-foreground">
                    {item}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </RevealItem>
      </RevealSection>

      <RevealSection>
        <RevealItem>
          <ExecutiveIntelligencePanel />
        </RevealItem>
      </RevealSection>
    </div>
  );
}
