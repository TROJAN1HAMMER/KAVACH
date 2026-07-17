import { useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { CheckCircle2, ClipboardCheck, XCircle } from "lucide-react";
import { PageHeader } from "../components/ui/PageHeader";
import { Card, CardContent, CardHeader } from "../components/ui/Card";
import { Select } from "../components/ui/Input";
import { Badge } from "../components/ui/Badge";
import { EmptyState } from "../components/ui/EmptyState";
import { FullPageSpinner } from "../components/ui/Spinner";
import { ProgressBar } from "../components/ui/ProgressBar";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "../components/ui/Table";
import { SeverityBadge } from "../components/ui/Badge";
import { ComplianceBarChart } from "../components/charts/ComplianceBarChart";
import { useScanJobs } from "../hooks/useScanJobs";
import { useCompliance } from "../hooks/useFindings";

export default function ComplianceDashboardPage() {
  const [searchParams, setSearchParams] = useSearchParams();
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
        }
      />

      {loadingCompliance || !compliance ? (
        <FullPageSpinner />
      ) : (
        <>
          <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-1">
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
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
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
          </div>

          <div className="space-y-6">
            {compliance.frameworks.map((framework) => (
              <Card key={framework.short_code}>
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
            ))}
          </div>
        </>
      )}
    </div>
  );
}
