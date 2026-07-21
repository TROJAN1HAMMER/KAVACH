import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, ShieldAlert, TrendingUp, Zap } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { PageHeader } from "../components/ui/PageHeader";
import { StatTile } from "../components/ui/StatTile";
import { Card, CardContent, CardHeader } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { SkeletonStatTiles, SkeletonChartCard, SkeletonTable } from "../components/ui/Skeleton";
import { Badge } from "../components/ui/Badge";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "../components/ui/Table";
import { RevealSection, RevealItem } from "../components/landing/RevealSection";
import { BrsTrendChart } from "../components/charts/BrsTrendChart";
import { useScanJobs } from "../hooks/useScanJobs";
import { useTheme } from "../hooks/useTheme";
import { useChartEntryAnimation } from "../hooks/useChartEntryAnimation";
import { formatDateTime, formatScore } from "../lib/utils";

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
  const { theme } = useTheme();
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

  const gridColor = theme === "dark" ? "#2c2c2a" : "#e1e0d9";
  const axisColor = theme === "dark" ? "#c3c2b7" : "#52514e";
  const blueHex = theme === "dark" ? "#3987e5" : "#2a78d6";
  const chartAnimationActive = useChartEntryAnimation(700);

  if (isLoading) {
    return (
      <div>
        <PageHeader title="Risk Dashboard" description="Banking Risk Score trends across every completed scan." />
        <SkeletonStatTiles className="mb-6" />
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
      <PageHeader title="Risk Dashboard" description="Banking Risk Score trends across every completed scan." />

      <RevealSection className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <RevealItem>
          <StatTile label="Average BRS" value={formatScore(stats?.avg)} icon={<TrendingUp className="size-5" />} />
        </RevealItem>
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
            <CardHeader title="Riskiest repositories" description="Highest Banking Risk Score per repository." />
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={topRepos} layout="vertical" margin={{ top: 8, right: 24, left: 8, bottom: 0 }}>
                  <CartesianGrid horizontal={false} stroke={gridColor} />
                  <XAxis type="number" domain={[0, 100]} tick={{ fill: axisColor, fontSize: 12 }} tickLine={false} axisLine={{ stroke: gridColor }} />
                  <YAxis type="category" dataKey="name" tick={{ fill: axisColor, fontSize: 12 }} tickLine={false} axisLine={false} width={110} />
                  <Tooltip
                    cursor={{ fill: theme === "dark" ? "rgba(255,255,255,0.04)" : "rgba(11,11,11,0.03)" }}
                    contentStyle={{
                      background: theme === "dark" ? "#1a1a19" : "#fcfcfb",
                      border: `1px solid ${gridColor}`,
                      borderRadius: 8,
                      fontSize: 12,
                      color: theme === "dark" ? "#ffffff" : "#0b0b0b",
                    }}
                    formatter={(value) => [Number(value).toFixed(1), "BRS score"]}
                  />
                  <Bar
                    dataKey="score"
                    radius={[0, 4, 4, 0]}
                    maxBarSize={20}
                    isAnimationActive={chartAnimationActive}
                    animationDuration={700}
                    animationEasing="ease-out"
                  >
                    {topRepos.map((repo) => (
                      <Cell key={repo.name} fill={blueHex} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
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
