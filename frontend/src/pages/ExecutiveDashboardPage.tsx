import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { BarChart3, Database, ShieldAlert, Siren } from "lucide-react";
import { PageHeader } from "../components/ui/PageHeader";
import { StatTile } from "../components/ui/StatTile";
import { Card, CardContent, CardHeader } from "../components/ui/Card";
import { SkeletonStatTiles, SkeletonChartCard, SkeletonTable } from "../components/ui/Skeleton";
import { EmptyState } from "../components/ui/EmptyState";
import { Badge } from "../components/ui/Badge";
import { RevealSection, RevealItem } from "../components/landing/RevealSection";
import { BrsTrendChart } from "../components/charts/BrsTrendChart";
import { SeverityDistributionChart } from "../components/charts/SeverityDistributionChart";
import { ExecutiveIntelligencePanel } from "../components/executive/ExecutiveIntelligencePanel";
import { useRepositories } from "../hooks/useRepositories";
import { useScanJobs } from "../hooks/useScanJobs";
import { extractSeverityCounts } from "../lib/severity";
import { formatScore } from "../lib/utils";
import type { Severity } from "../types/api";

export default function ExecutiveDashboardPage() {
  const navigate = useNavigate();
  const { data: repositories, isLoading: loadingRepos } = useRepositories();
  const { data: scanJobsData, isLoading: loadingScans } = useScanJobs({ status: "completed", limit: 100 });

  const completedJobs = useMemo(() => scanJobsData?.scan_jobs ?? [], [scanJobsData]);

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
    };
  }, [completedJobs]);

  const trendPoints = useMemo(
    () =>
      [...completedJobs]
        .filter((j) => j.finished_at && j.brs_score !== null)
        .sort((a, b) => (a.finished_at ?? "").localeCompare(b.finished_at ?? ""))
        .slice(-30)
        .map((j) => ({
          finishedAt: j.finished_at as string,
          brsScore: j.brs_score as number,
          repositoryName: j.repository_name,
        })),
    [completedJobs],
  );

  const topRiskRepos = useMemo(() => {
    const byRepo = new Map<string, { id: string; name: string; score: number; riskLevel: string | null }>();
    for (const job of completedJobs) {
      const existing = byRepo.get(job.repository_id);
      if (!existing || (job.brs_score ?? 0) > existing.score) {
        byRepo.set(job.repository_id, {
          id: job.repository_id,
          name: job.repository_name,
          score: job.brs_score ?? 0,
          riskLevel: job.brs_risk_level,
        });
      }
    }
    return [...byRepo.values()].sort((a, b) => b.score - a.score).slice(0, 5);
  }, [completedJobs]);

  if (loadingRepos || loadingScans) {
    return (
      <div>
        <PageHeader title="Executive Summary" description="A portfolio-level view of security posture across every repository." />
        <SkeletonStatTiles className="mb-6" />
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
        <PageHeader title="Executive Summary" description="A portfolio-level view of security posture across every repository." />
        <EmptyState icon={<BarChart3 className="size-10" />} title="No completed scans yet" />
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Executive Summary" description="A portfolio-level view of security posture across every repository." />

      <RevealSection className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <RevealItem>
          <StatTile label="Repositories" value={repositories?.length ?? 0} icon={<Database className="size-5" />} />
        </RevealItem>
        <RevealItem>
          <StatTile label="Completed scans" value={completedJobs.length} icon={<BarChart3 className="size-5" />} />
        </RevealItem>
        <RevealItem>
          <StatTile
            label="Portfolio avg BRS"
            value={formatScore(portfolioSummary.avgBrs)}
            icon={<ShieldAlert className="size-5" />}
          />
        </RevealItem>
        <RevealItem>
          <StatTile
            label="Critical findings"
            value={portfolioSummary.criticalCount}
            icon={<Siren className="size-5" />}
          />
        </RevealItem>
      </RevealSection>

      <RevealSection className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <RevealItem>
          <Card className="h-full">
            <CardHeader title="Risk trend" description="Banking Risk Score across the most recent 30 scans." />
            <CardContent>
              <BrsTrendChart points={trendPoints} />
            </CardContent>
          </Card>
        </RevealItem>
        <RevealItem>
          <Card className="h-full">
            <CardHeader title="Findings by severity" description="Aggregated across every completed scan." />
            <CardContent>
              <SeverityDistributionChart counts={portfolioSummary.severityTotals} />
            </CardContent>
          </Card>
        </RevealItem>
      </RevealSection>

      <RevealSection>
        <RevealItem>
          <Card>
            <CardHeader title="Top risk repositories" description="Highest Banking Risk Score observed per repository." />
            <CardContent className="space-y-3">
              {topRiskRepos.map((repo) => (
                <div
                  key={repo.id}
                  onClick={() => navigate(`/risk`)}
                  className="flex cursor-pointer items-center justify-between rounded-lg border border-border p-3 transition-colors hover:bg-muted/60"
                >
                  <div>
                    <p className="font-medium text-foreground">{repo.name}</p>
                    <Badge tone={repo.score >= 70 ? "danger" : repo.score >= 40 ? "warning" : "success"} className="mt-1">
                      {repo.riskLevel ?? "—"}
                    </Badge>
                  </div>
                  <p className="text-2xl font-semibold tabular-nums text-foreground">{repo.score.toFixed(0)}</p>
                </div>
              ))}
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
