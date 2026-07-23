import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, ShieldAlert, Zap } from "lucide-react";
import { PageHeader } from "../components/ui/PageHeader";
import { StatTile } from "../components/ui/StatTile";
import { Card, CardContent, CardHeader } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { SkeletonStatTiles, SkeletonChartCard, SkeletonTable } from "../components/ui/Skeleton";
import { Badge } from "../components/ui/Badge";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "../components/ui/Table";
import { RevealSection, RevealItem } from "../components/landing/RevealSection";
import { BrsTrendChart } from "../components/charts/BrsTrendChart";
import { SeverityDistributionChart } from "../components/charts/SeverityDistributionChart";
import { RepositoryComparisonChart } from "../components/charts/RepositoryComparisonChart";
import { ScannerContributionChart } from "../components/charts/ScannerContributionChart";
import { FindingTrendsChart, type FindingTrendPoint } from "../components/charts/FindingTrendsChart";
import { RiskDistributionChart } from "../components/charts/RiskDistributionChart";
import { RadialGauge } from "../components/charts/RadialGauge";
import { RiskHeatmap, type RiskHeatmapRow } from "../components/risk/RiskHeatmap";
import { useScanJobs } from "../hooks/useScanJobs";
import { useChartTheme } from "../hooks/useChartTheme";
import { extractSeverityCounts, extractSourceCounts } from "../lib/severity";
import { formatDateTime, formatScore } from "../lib/utils";
import type { Severity } from "../types/api";

function riskTone(riskLevel: string | null): "neutral" | "success" | "warning" | "danger" {
  switch (riskLevel?.toUpperCase()) {
    case "CRITICAL":
    case "HIGH":
      return "danger";
    case "MEDIUM":
      return "warning";
    case "LOW":
      return "success";
    default:
      return "neutral";
  }
}

export default function RiskDashboardPage() {
  const navigate = useNavigate();
  const chartTheme = useChartTheme();
  const { data, isLoading } = useScanJobs({ status: "completed", limit: 100 });

  const completedJobs = useMemo(
    () => (data?.scan_jobs ?? []).filter((j) => j.brs_score !== null).sort((a, b) => (b.finished_at ?? "").localeCompare(a.finished_at ?? "")),
    [data],
  );

  const stats = useMemo(() => {
    if (completedJobs.length === 0) return null;
    const scores = completedJobs.map((j) => j.brs_score as number);
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    const highRiskCount = completedJobs.filter((j) => ["CRITICAL", "HIGH"].includes((j.brs_risk_level ?? "").toUpperCase())).length;
    const totalFindings = completedJobs.reduce((sum, j) => sum + (j.total_findings ?? 0), 0);
    const riskiest = [...completedJobs].sort((a, b) => (b.brs_score ?? 0) - (a.brs_score ?? 0))[0];
    return { avg, highRiskCount, totalFindings, riskiest };
  }, [completedJobs]);

  // Portfolio-wide severity/scanner-contribution/ASE — this is the "deep
  // analytical" breakdown the Executive Summary page deliberately no longer
  // shows (it stays business-framed there); this page owns it instead.
  const portfolioBreakdown = useMemo(() => {
    const severityTotals: Partial<Record<Severity, number>> = {};
    const sourceTotals: Record<string, number> = {};
    let aseSum = 0;
    let aseCount = 0;

    for (const job of completedJobs) {
      for (const [severity, count] of Object.entries(extractSeverityCounts(job.summary))) {
        severityTotals[severity as Severity] = (severityTotals[severity as Severity] ?? 0) + count;
      }
      for (const [source, count] of Object.entries(extractSourceCounts(job.summary))) {
        sourceTotals[source] = (sourceTotals[source] ?? 0) + count;
      }
      if (job.attack_surface_exposure_score !== null) {
        aseSum += job.attack_surface_exposure_score;
        aseCount += 1;
      }
    }

    return {
      severityTotals,
      avgAse: aseCount > 0 ? aseSum / aseCount : null,
      sourceContribution: Object.entries(sourceTotals)
        .map(([source, count]) => ({ source, count }))
        .sort((a, b) => b.count - a.count),
    };
  }, [completedJobs]);

  const trendPoints = useMemo(
    () =>
      [...completedJobs]
        .filter((j) => j.finished_at)
        .sort((a, b) => (a.finished_at ?? "").localeCompare(b.finished_at ?? ""))
        .slice(-30)
        .map((j) => ({
          finishedAt: j.finished_at as string,
          brsScore: j.brs_score as number,
          repositoryName: j.repository_name,
        })),
    [completedJobs],
  );

  const topRepos = useMemo(() => {
    const byRepo = new Map<string, { name: string; score: number }>();
    for (const job of completedJobs) {
      const existing = byRepo.get(job.repository_id);
      if (!existing || (job.brs_score ?? 0) > existing.score) {
        byRepo.set(job.repository_id, { name: job.repository_name, score: job.brs_score ?? 0 });
      }
    }
    return [...byRepo.values()].sort((a, b) => b.score - a.score).slice(0, 8);
  }, [completedJobs]);

  const findingTrendPoints = useMemo<FindingTrendPoint[]>(
    () =>
      [...completedJobs]
        .filter((j) => j.finished_at)
        .sort((a, b) => (a.finished_at ?? "").localeCompare(b.finished_at ?? ""))
        .slice(-30)
        .map((j) => ({
          finishedAt: j.finished_at as string,
          repositoryName: j.repository_name,
          counts: extractSeverityCounts(j.summary),
        })),
    [completedJobs],
  );

  // Latest BRS score per repository (first occurrence while walking
  // newest-first `completedJobs`) — a repo scanned several times contributes
  // one point to the distribution, not one per scan.
  const latestBrsPerRepo = useMemo(() => {
    const seen = new Set<string>();
    const scores: number[] = [];
    for (const job of completedJobs) {
      if (seen.has(job.repository_id) || job.brs_score === null) continue;
      seen.add(job.repository_id);
      scores.push(job.brs_score);
    }
    return scores;
  }, [completedJobs]);

  // Repository x severity grid — latest scan per repository (`completedJobs`
  // is already sorted newest-first, so the first occurrence of a
  // `repository_id` while walking it *is* that repo's latest scan), ranked
  // by critical-then-high finding count so the riskiest repos sit at top.
  const heatmapRows = useMemo<RiskHeatmapRow[]>(() => {
    const seen = new Set<string>();
    const rows: RiskHeatmapRow[] = [];
    for (const job of completedJobs) {
      if (seen.has(job.repository_id)) continue;
      seen.add(job.repository_id);
      rows.push({
        repositoryId: job.repository_id,
        repositoryName: job.repository_name,
        counts: extractSeverityCounts(job.summary),
      });
    }
    return rows
      .sort((a, b) => (b.counts.CRITICAL ?? 0) - (a.counts.CRITICAL ?? 0) || (b.counts.HIGH ?? 0) - (a.counts.HIGH ?? 0))
      .slice(0, 8);
  }, [completedJobs]);

  if (isLoading) {
    return (
      <div>
        <PageHeader title="Risk Dashboard" description="Banking Risk Score trends across every completed scan." />
        <SkeletonStatTiles className="mb-6" count={5} />
        <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <SkeletonChartCard height={280} />
          <SkeletonChartCard height={280} />
        </div>
        <SkeletonTable rows={6} columns={5} />
      </div>
    );
  }

  if (completedJobs.length === 0) {
    return (
      <div>
        <PageHeader title="Risk Dashboard" description="Banking Risk Score trends across every completed scan." />
        <EmptyState
          icon={<ShieldAlert className="size-10" />}
          title="No completed scans yet"
          description="Once a scan finishes, its Banking Risk Score will appear here."
        />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Risk Dashboard"
        description="Deep analytical view of the portfolio's risk posture — trends, severity, exposure, and scanner contribution."
      />

      <RevealSection className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <RevealItem>
          <Card className="h-full">
            <CardContent className="flex items-center justify-center py-2">
              <RadialGauge label="Average BRS" value={stats?.avg ?? null} mode={chartTheme.mode} />
            </CardContent>
          </Card>
        </RevealItem>
        <RevealItem>
          <Card className="h-full">
            <CardContent className="flex items-center justify-center py-2">
              <RadialGauge label="Avg. Attack Surface Exposure" value={portfolioBreakdown.avgAse} mode={chartTheme.mode} />
            </CardContent>
          </Card>
        </RevealItem>
      </RevealSection>

      <RevealSection className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <RevealItem>
          <StatTile
            label="High / critical repos"
            value={stats?.highRiskCount ?? 0}
            icon={<AlertTriangle className="size-5" />}
          />
        </RevealItem>
        <RevealItem>
          <StatTile label="Total findings" value={stats?.totalFindings ?? 0} icon={<Zap className="size-5" />} />
        </RevealItem>
        <RevealItem>
          <StatTile
            label="Riskiest repository"
            value={stats?.riskiest?.repository_name ?? "—"}
            icon={<ShieldAlert className="size-5" />}
          />
        </RevealItem>
      </RevealSection>

      <RevealSection className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <RevealItem>
          <Card className="h-full">
            <CardHeader title="BRS trend" description="Most recent 30 completed scans, in order finished." />
            <CardContent>
              <BrsTrendChart points={trendPoints} />
            </CardContent>
          </Card>
        </RevealItem>

        <RevealItem>
          <Card className="h-full">
            <CardHeader title="Repository comparison" description="Highest Banking Risk Score per repository." />
            <CardContent>
              <RepositoryComparisonChart repositories={topRepos} />
            </CardContent>
          </Card>
        </RevealItem>
      </RevealSection>

      <RevealSection className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <RevealItem>
          <Card className="h-full">
            <CardHeader title="Findings by severity" description="Aggregated across every completed scan." />
            <CardContent>
              <SeverityDistributionChart counts={portfolioBreakdown.severityTotals} />
            </CardContent>
          </Card>
        </RevealItem>

        <RevealItem>
          <Card className="h-full">
            <CardHeader title="Scanner contribution" description="Findings logged per scanner engine, portfolio-wide." />
            <CardContent>
              <ScannerContributionChart contributions={portfolioBreakdown.sourceContribution} />
            </CardContent>
          </Card>
        </RevealItem>
      </RevealSection>

      <RevealSection className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <RevealItem>
          <Card className="h-full">
            <CardHeader title="Finding trends" description="Severity mix across the most recent 30 completed scans." />
            <CardContent>
              <FindingTrendsChart points={findingTrendPoints} />
            </CardContent>
          </Card>
        </RevealItem>

        <RevealItem>
          <Card className="h-full">
            <CardHeader title="Risk distribution" description="Repositories grouped by their latest Banking Risk Score." />
            <CardContent>
              <RiskDistributionChart scores={latestBrsPerRepo} />
            </CardContent>
          </Card>
        </RevealItem>
      </RevealSection>

      <RevealSection className="mb-6">
        <RevealItem>
          <Card>
            <CardHeader title="Business risk heatmap" description="Finding severity concentration per repository, most critical first." />
            <CardContent>
              <RiskHeatmap rows={heatmapRows} />
            </CardContent>
          </Card>
        </RevealItem>
      </RevealSection>

      <RevealSection>
        <RevealItem>
          <Card>
            <CardHeader title="Recent completed scans" />
            <Table>
              <TableHead>
                <tr>
                  <TableHeaderCell>Repository</TableHeaderCell>
                  <TableHeaderCell>BRS score</TableHeaderCell>
                  <TableHeaderCell>Risk level</TableHeaderCell>
                  <TableHeaderCell>Findings</TableHeaderCell>
                  <TableHeaderCell>Finished</TableHeaderCell>
                </tr>
              </TableHead>
              <TableBody>
                {completedJobs.slice(0, 15).map((job) => (
                  <TableRow key={job.scan_job_id} clickable onClick={() => navigate(`/scans/${job.scan_job_id}`)}>
                    <TableCell className="font-medium">{job.repository_name}</TableCell>
                    <TableCell className="tabular-nums">{formatScore(job.brs_score)}</TableCell>
                    <TableCell>
                      <Badge tone={riskTone(job.brs_risk_level)}>{job.brs_risk_level ?? "—"}</Badge>
                    </TableCell>
                    <TableCell>{job.total_findings ?? 0}</TableCell>
                    <TableCell className="text-muted-foreground">{formatDateTime(job.finished_at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </RevealItem>
      </RevealSection>
    </div>
  );
}
