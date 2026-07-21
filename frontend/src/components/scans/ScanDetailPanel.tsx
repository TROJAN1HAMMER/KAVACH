import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertCircle, CheckCircle2, CircleDashed, Download, Loader2, ShieldAlert, XCircle } from "lucide-react";
import { useScanJob, useCancelScanJob } from "../../hooks/useScanJobs";
import { useReportStatus } from "../../hooks/useFindings";
import { useScanProgressSocket, TERMINAL_SCAN_STATUSES } from "../../hooks/useScanProgressSocket";
import { usePermissions } from "../../hooks/usePermissions";
import { useToast } from "../../hooks/useToast";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { ProgressBar } from "../ui/ProgressBar";
import { Spinner } from "../ui/Spinner";
import { SeverityDistributionChart } from "../charts/SeverityDistributionChart";
import { extractSeverityCounts } from "../../lib/severity";
import { cn, formatDateTime, formatScore } from "../../lib/utils";
import { reportsApi } from "../../lib/api/reports";
import type { ReportType } from "../../types/api";

const STATUS_TONE: Record<string, "neutral" | "primary" | "success" | "warning" | "danger"> = {
  queued: "neutral",
  running: "primary",
  completed: "success",
  failed: "danger",
  cancelled: "warning",
};

const REPORT_LABELS: Record<ReportType, string> = {
  pdf: "Executive PDF",
  pdf_technical: "Technical PDF",
  sarif: "SARIF",
  sbom: "SBOM",
  unified_findings: "Findings (JSON)",
  compliance_report: "Compliance report",
  csv: "CSV",
};

const AVAILABLE_REPORT_TYPES: ReportType[] = [
  "pdf",
  "pdf_technical",
  "sarif",
  "sbom",
  "unified_findings",
  "compliance_report",
  "csv",
];

export function ScanDetailPanel({ scanJobId }: { scanJobId: string }) {
  const navigate = useNavigate();
  const { data: job, isLoading } = useScanJob(scanJobId);
  const cancelScan = useCancelScanJob();
  const { data: reportStatus } = useReportStatus(job?.status === "completed" ? scanJobId : undefined);
  const [downloadingType, setDownloadingType] = useState<ReportType | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const { hasPermission } = usePermissions();
  const canCancelScan = hasPermission("scan:cancel");
  const canDownloadReports = hasPermission("report:download");
  const toast = useToast();

  useScanProgressSocket(scanJobId, Boolean(job && !TERMINAL_SCAN_STATUSES.has(job.status)));

  const handleDownload = async (type: ReportType, fileName: string) => {
    setDownloadError(null);
    setDownloadingType(type);
    try {
      await reportsApi.download(scanJobId, type, fileName);
    } catch (error) {
      setDownloadError(error instanceof Error ? error.message : "Download failed. Please try again.");
    } finally {
      setDownloadingType(null);
    }
  };

  if (isLoading || !job) {
    return (
      <div className="flex h-40 items-center justify-center">
        <Spinner />
      </div>
    );
  }

  const scannerEntries = Object.entries(job.worker_status);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-foreground">{job.repository_name}</h3>
          <p className="text-xs text-muted-foreground">Scan ID: {job.scan_job_id}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge
            tone={STATUS_TONE[job.status]}
            className={cn("capitalize", job.status === "running" && "animate-pulse-slow")}
          >
            {job.status}
          </Badge>
          <Badge tone="neutral" className="capitalize">
            {job.priority} priority
          </Badge>
          {canCancelScan && (job.status === "queued" || job.status === "running") && (
            <Button
              variant="danger"
              size="sm"
              onClick={() =>
                cancelScan.mutate(job.scan_job_id, {
                  onSuccess: () => toast.success("Scan cancelled", `${job.repository_name} scan was cancelled.`),
                  onError: () => toast.error("Failed to cancel scan", "Please try again."),
                })
              }
              isLoading={cancelScan.isPending}
            >
              Cancel
            </Button>
          )}
        </div>
      </div>

      {(job.status === "queued" || job.status === "running") && (
        <div>
          <div className="mb-1.5 flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{job.current_stage ?? "Waiting to start…"}</span>
            <span className="font-medium tabular-nums">{job.progress_percent}%</span>
          </div>
          <ProgressBar value={job.progress_percent} />
        </div>
      )}

      {job.status === "failed" && job.error_message && (
        <div className="rounded-lg bg-danger/10 p-3 text-sm text-danger">{job.error_message}</div>
      )}

      {scannerEntries.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Scanner progress</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {scannerEntries.map(([scanner, status]) => (
              <div
                key={scanner}
                className={cn(
                  "flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm",
                  status.status === "running" && "border-primary/30 bg-primary/5 animate-pulse-slow",
                )}
              >
                {status.status === "completed" && <CheckCircle2 className="size-4 shrink-0 text-success" />}
                {status.status === "running" && <Loader2 className="size-4 shrink-0 animate-spin text-primary" />}
                {status.status === "failed" && <XCircle className="size-4 shrink-0 text-danger" />}
                {(status.status === "queued" || status.status === "cancelled") && (
                  <CircleDashed className="size-4 shrink-0 text-muted-foreground" />
                )}
                <span className="truncate font-mono text-xs">{scanner}</span>
                {typeof status.findings_count === "number" && (
                  <span className="ml-auto text-xs text-muted-foreground">{status.findings_count}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {job.status === "completed" && (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="rounded-lg border border-border p-3">
              <p className="text-xs text-muted-foreground">Banking Risk Score</p>
              <p className="mt-1 text-2xl font-semibold">{formatScore(job.brs_score)}</p>
              <p className="text-xs text-muted-foreground">{job.brs_risk_level ?? "—"}</p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="text-xs text-muted-foreground">Attack Surface Exposure</p>
              <p className="mt-1 text-2xl font-semibold">{formatScore(job.attack_surface_exposure_score)}</p>
              <p className="text-xs text-muted-foreground">{job.attack_surface_exposure_level ?? "—"}</p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="text-xs text-muted-foreground">Total findings</p>
              <p className="mt-1 text-2xl font-semibold">{job.total_findings ?? 0}</p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="text-xs text-muted-foreground">Finished</p>
              <p className="mt-1 text-sm font-medium">{formatDateTime(job.finished_at)}</p>
            </div>
          </div>

          {job.summary && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Findings by severity
              </p>
              <SeverityDistributionChart counts={extractSeverityCounts(job.summary)} height={200} />
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate(`/findings?scan=${job.scan_job_id}`)}>
              <ShieldAlert className="size-4" />
              View findings
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate(`/compliance?scan=${job.scan_job_id}`)}>
              View compliance
            </Button>
          </div>

          {reportStatus && canDownloadReports && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Reports</p>
              <div className="flex flex-wrap gap-2">
                {AVAILABLE_REPORT_TYPES.filter((type) => reportStatus[`${type}_available`]).map((type) => (
                  <Button
                    key={type}
                    variant="secondary"
                    size="sm"
                    isLoading={downloadingType === type}
                    onClick={() => handleDownload(type, `${job.repository_name}-${type}`)}
                  >
                    <Download className="size-3.5" />
                    {REPORT_LABELS[type]}
                  </Button>
                ))}
                {AVAILABLE_REPORT_TYPES.every((type) => !reportStatus[`${type}_available`]) && (
                  <p className="text-sm text-muted-foreground">Reports are still generating…</p>
                )}
              </div>
              {downloadError && (
                <div className="mt-2 flex items-start gap-2 rounded-lg bg-danger/10 p-2.5 text-sm text-danger">
                  <AlertCircle className="mt-0.5 size-4 shrink-0" />
                  <span>{downloadError}</span>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
