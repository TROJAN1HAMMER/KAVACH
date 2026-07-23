import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CheckCircle2, ClipboardCheck, Download, XCircle } from "lucide-react";
import { PageHeader } from "../components/ui/PageHeader";
import { Card, CardContent, CardHeader } from "../components/ui/Card";
import { Select } from "../components/ui/Input";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { FullPageSpinner } from "../components/ui/Spinner";
import { SkeletonChartCard, SkeletonTable } from "../components/ui/Skeleton";
import { ProgressBar } from "../components/ui/ProgressBar";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "../components/ui/Table";
import { SeverityBadge } from "../components/ui/Badge";
import { RevealSection, RevealItem } from "../components/landing/RevealSection";
import { ComplianceBarChart } from "../components/charts/ComplianceBarChart";
import { StatusTimeline, type TimelineStep } from "../components/charts/StatusTimeline";
import { useScanJobs } from "../hooks/useScanJobs";
import { useCompliance, useReportStatus } from "../hooks/useFindings";
import { usePermissions } from "../hooks/usePermissions";
import { reportsApi } from "../lib/api/reports";
import { formatDateTime } from "../lib/utils";

/** Reuses the exact per-scan report-download mechanism `ScanDetailPanel`
 *  already has, scoped to the currently-selected scan's compliance_report
 *  artifact — this page is single-scan-scoped already (via the picker
 *  above), so "downloadable reports" means this scan's compliance report. */
function ComplianceReportButton({ scanJobId, repositoryName }: { scanJobId: string; repositoryName: string }) {
  const { data: reportStatus } = useReportStatus(scanJobId);
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!reportStatus?.compliance_report_available) return null;

  const handleDownload = async () => {
    setError(null);
    setIsDownloading(true);
    try {
      await reportsApi.download(scanJobId, "compliance_report", `${repositoryName}-compliance-report`);
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
        Download report
      </Button>
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  );
}

export default function ComplianceDashboardPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { hasPermission } = usePermissions();
  const canDownloadReports = hasPermission("report:download");
  const { data: scanJobsData, isLoading: loadingScans } = useScanJobs({ status: "completed", limit: 100 });

  const completedJobs = useMemo(
    () => (scanJobsData?.scan_jobs ?? []).sort((a, b) => (b.finished_at ?? "").localeCompare(a.finished_at ?? "")),
    [scanJobsData],
  );

  const selectedScanId = searchParams.get("scan") ?? completedJobs[0]?.scan_job_id ?? "";

  useEffect(() => {
    if (!searchParams.get("scan") && completedJobs[0]) {
      setSearchParams({ scan: completedJobs[0].scan_job_id }, { replace: true });
    }
  }, [completedJobs, searchParams, setSearchParams]);

  const { data: compliance, isLoading: loadingCompliance } = useCompliance(selectedScanId || undefined);
  const { data: reportStatus } = useReportStatus(selectedScanId || undefined);
  const selectedJob = completedJobs.find((job) => job.scan_job_id === selectedScanId);

  // Reframed honestly as the *current* evaluation's real stages rather than
  // a fabricated multi-scan historical trend (which would need N sequential
  // `useCompliance` calls, one per past scan — the same inefficient pattern
  // deliberately avoided elsewhere in this dashboard).
  const evaluationSteps: TimelineStep[] = [
    { key: "scan", label: "Scan completed", status: selectedJob?.finished_at ? "complete" : "pending" },
    { key: "compliance", label: "Compliance evaluated", status: compliance ? "complete" : "current" },
    { key: "report", label: "Report available", status: reportStatus?.compliance_report_available ? "complete" : "current" },
  ];

  if (loadingScans) return <FullPageSpinner />;

  if (completedJobs.length === 0) {
    return (
      <div>
        <PageHeader title="Compliance Dashboard" description="RBI, PCI-DSS, and SWIFT CSP compliance per scan." />
        <EmptyState
          icon={<ClipboardCheck className="size-10" />}
          title="No completed scans yet"
          description="Compliance is evaluated once a scan finishes."
        />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Compliance Dashboard"
        description="RBI IT Framework, PCI-DSS v4, and SWIFT CSP compliance for a selected scan."
        action={
          <div className="flex flex-wrap items-center gap-3">
            <Select
              className="w-64"
              value={selectedScanId}
              onChange={(e) => setSearchParams({ scan: e.target.value })}
            >
              {completedJobs.map((job) => (
                <option key={job.scan_job_id} value={job.scan_job_id}>
                  {job.repository_name} — {new Date(job.finished_at ?? "").toLocaleDateString()}
                </option>
              ))}
            </Select>
            {canDownloadReports && selectedJob && (
              <ComplianceReportButton scanJobId={selectedJob.scan_job_id} repositoryName={selectedJob.repository_name} />
            )}
          </div>
        }
      />

      {loadingCompliance || !compliance ? (
        <div>
          <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
            <SkeletonChartCard className="lg:col-span-1" height={120} />
            <SkeletonChartCard className="lg:col-span-2" height={160} />
          </div>
          <SkeletonTable rows={5} columns={4} />
        </div>
      ) : (
        <>
          <RevealSection className="mb-6">
            <RevealItem>
              <Card>
                <CardHeader title="Compliance evaluation" description="Current status for this scan." />
                <CardContent>
                  <StatusTimeline steps={evaluationSteps} />
                </CardContent>
              </Card>
            </RevealItem>
          </RevealSection>

          <RevealSection className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
            <RevealItem className="lg:col-span-1">
              <Card className="h-full">
                <CardHeader title="Overall compliance" />
                <CardContent>
                  <p className="text-4xl font-semibold tabular-nums text-foreground">
                    {compliance.overall_compliance_percentage.toFixed(0)}%
                  </p>
                  <ProgressBar
                    value={compliance.overall_compliance_percentage}
                    tone={compliance.overall_compliance_percentage >= 80 ? "success" : compliance.overall_compliance_percentage >= 50 ? "warning" : "danger"}
                    className="mt-3"
                  />
                  <p className="mt-2 text-xs text-muted-foreground">Across {compliance.frameworks.length} framework(s)</p>
                  {selectedJob?.finished_at && (
                    <p className="mt-1 text-xs text-muted-foreground">Last evaluated {formatDateTime(selectedJob.finished_at)}</p>
                  )}
                </CardContent>
              </Card>
            </RevealItem>

            <RevealItem className="lg:col-span-2">
              <Card className="h-full">
                <CardHeader title="Compliance by framework" />
                <CardContent>
                  <ComplianceBarChart
                    points={compliance.frameworks.map((f) => ({
                      shortCode: f.short_code,
                      frameworkName: f.framework_name,
                      compliancePercentage: f.compliance_percentage,
                    }))}
                    height={Math.max(120, compliance.frameworks.length * 56)}
                  />
                </CardContent>
              </Card>
            </RevealItem>
          </RevealSection>

          <RevealSection className="space-y-6">
            {compliance.frameworks.map((framework) => (
              <RevealItem key={framework.short_code}>
                <Card>
                  <CardHeader
                    title={`${framework.framework_name} (${framework.version})`}
                    description={`${framework.passed_controls} of ${framework.total_controls} controls passing`}
                    action={
                      <Badge tone={framework.compliance_percentage >= 80 ? "success" : framework.compliance_percentage >= 50 ? "warning" : "danger"}>
                        {framework.compliance_percentage.toFixed(0)}%
                      </Badge>
                    }
                  />
                  <Table>
                    <TableHead>
                      <tr>
                        <TableHeaderCell>Control</TableHeaderCell>
                        <TableHeaderCell>Status</TableHeaderCell>
                        <TableHeaderCell>Recommendation</TableHeaderCell>
                        <TableHeaderCell>Evidence</TableHeaderCell>
                      </tr>
                    </TableHead>
                    <TableBody>
                      {framework.controls
                        .filter((c) => c.status === "FAIL")
                        .concat(framework.controls.filter((c) => c.status === "PASS"))
                        .map((control) => (
                          <TableRow key={control.requirement_id}>
                            <TableCell>
                              <p className="font-medium">{control.requirement_id}</p>
                              <p className="text-xs text-muted-foreground">{control.title}</p>
                            </TableCell>
                            <TableCell>
                              {control.status === "PASS" ? (
                                <span className="inline-flex items-center gap-1.5 text-success">
                                  <CheckCircle2 className="size-4" /> Pass
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 text-danger">
                                  <XCircle className="size-4" /> Fail
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="max-w-xs text-muted-foreground">
                              {control.status === "FAIL" ? control.recommendation : "—"}
                            </TableCell>
                            <TableCell>
                              {control.evidence.length > 0 ? (
                                <div className="flex flex-wrap gap-1">
                                  {control.evidence.slice(0, 3).map((e) => (
                                    <SeverityBadge key={e.finding_id} severity={e.severity} />
                                  ))}
                                  {control.evidence.length > 3 && (
                                    <span className="text-xs text-muted-foreground">+{control.evidence.length - 3} more</span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </Card>
              </RevealItem>
            ))}
          </RevealSection>
        </>
      )}
    </div>
  );
}
