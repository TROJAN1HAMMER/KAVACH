import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Activity, Clock, ShieldAlert, Zap } from "lucide-react";
import { PageHeader } from "../components/ui/PageHeader";
import { StatTile } from "../components/ui/StatTile";
import { Card, CardContent, CardHeader } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { EmptyState } from "../components/ui/EmptyState";
import { SkeletonStatTiles, SkeletonChartCard, SkeletonTable } from "../components/ui/Skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "../components/ui/Table";
import { RevealSection, RevealItem } from "../components/landing/RevealSection";
import { SeverityDistributionChart } from "../components/charts/SeverityDistributionChart";
import { useMyActivity } from "../hooks/useAnalytics";
import { SEVERITY_ORDER } from "../lib/severity";
import { formatDateTime, formatDuration, formatScore } from "../lib/utils";
import type { Severity } from "../types/api";

const STATUS_TONE: Record<string, "neutral" | "primary" | "success" | "warning" | "danger"> = {
  queued: "neutral",
  running: "primary",
  completed: "success",
  failed: "danger",
  cancelled: "warning",
};

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

export default function MyActivityPage() {
  const navigate = useNavigate();
  const { data, isLoading } = useMyActivity();

  const severityCounts = useMemo(() => {
    const counts: Partial<Record<Severity, number>> = {};
    if (!data) return counts;
    for (const severity of SEVERITY_ORDER) {
      const value = data.findings_by_severity[severity];
      if (typeof value === "number") counts[severity] = value;
    }
    return counts;
  }, [data]);

  if (isLoading) {
    return (
      <div>
        <PageHeader title="My Activity" description="Your own scan activity and workload at a glance." />
        <SkeletonStatTiles className="mb-6" />
        <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <SkeletonChartCard height={220} />
          <SkeletonChartCard height={220} />
        </div>
        <SkeletonTable rows={5} columns={5} />
      </div>
    );
  }

  if (!data || data.total_scans === 0) {
    return (
      <div>
        <PageHeader title="My Activity" description="Your own scan activity and workload at a glance." />
        <EmptyState
          icon={<Activity className="size-10" />}
          title="No scans yet"
          description="Once you start a scan, your activity will appear here."
        />
      </div>
    );
  }

  const statusEntries = Object.entries(data.scans_by_status);

  return (
    <div>
      <PageHeader title="My Activity" description="Your own scan activity and workload at a glance." />

      <RevealSection className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <RevealItem>
          <StatTile label="Total scans" value={data.total_scans} icon={<Activity className="size-5" />} />
        </RevealItem>
        <RevealItem>
          <StatTile label="Total findings" value={data.total_findings} icon={<Zap className="size-5" />} />
        </RevealItem>
        <RevealItem>
          <StatTile label="Average BRS" value={formatScore(data.average_brs_score)} icon={<ShieldAlert className="size-5" />} />
        </RevealItem>
        <RevealItem>
          <StatTile
            label="Average scan duration"
            value={formatDuration(data.average_scan_duration_seconds)}
            icon={<Clock className="size-5" />}
          />
        </RevealItem>
      </RevealSection>

      <RevealSection className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <RevealItem>
          <Card className="h-full">
            <CardHeader title="Scans by status" />
            <CardContent className="flex flex-wrap gap-2">
              {statusEntries.map(([status, count]) => (
                <Badge key={status} tone={STATUS_TONE[status] ?? "neutral"} className="capitalize">
                  {status}: {count}
                </Badge>
              ))}
            </CardContent>
          </Card>
        </RevealItem>

        <RevealItem>
          <Card className="h-full">
            <CardHeader title="Findings by severity" />
            <CardContent>
              <SeverityDistributionChart counts={severityCounts} height={220} />
            </CardContent>
          </Card>
        </RevealItem>
      </RevealSection>

      <RevealSection>
        <RevealItem>
          <Card>
            <CardHeader title="Recent scans" />
            <Table>
              <TableHead>
                <tr>
                  <TableHeaderCell>Repository</TableHeaderCell>
                  <TableHeaderCell>Status</TableHeaderCell>
                  <TableHeaderCell>BRS score</TableHeaderCell>
                  <TableHeaderCell>Risk level</TableHeaderCell>
                  <TableHeaderCell>Finished</TableHeaderCell>
                </tr>
              </TableHead>
              <TableBody>
                {data.recent_scans.map((scan) => (
                  <TableRow key={scan.scan_job_id} clickable onClick={() => navigate(`/scans/${scan.scan_job_id}`)}>
                    <TableCell className="font-medium">{scan.repository_name}</TableCell>
                    <TableCell>
                      <Badge tone={STATUS_TONE[scan.status] ?? "neutral"} className="capitalize">
                        {scan.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="tabular-nums">{formatScore(scan.brs_score)}</TableCell>
                    <TableCell>
                      <Badge tone={riskTone(scan.brs_risk_level)}>{scan.brs_risk_level ?? "—"}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{formatDateTime(scan.finished_at)}</TableCell>
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
