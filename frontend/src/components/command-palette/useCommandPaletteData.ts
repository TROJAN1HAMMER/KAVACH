import { useMemo } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import { Database, FileArchive, FileCode2, FileSpreadsheet, FileText, ScanLine, ShieldCheck } from "lucide-react";
import { repositoriesApi } from "../../lib/api/repositories";
import { scansApi } from "../../lib/api/scans";
import { findingsApi } from "../../lib/api/findings";
import { complianceApi } from "../../lib/api/compliance";
import { reportsApi } from "../../lib/api/reports";
import { queryKeys } from "../../lib/queryClient";
import { usePermissions } from "../../hooks/usePermissions";
import { useToast } from "../../hooks/useToast";
import { formatRelativeTime, formatScore, truncateMiddle } from "../../lib/utils";
import type { Finding, Repository, ReportType, ScanJobStatusResponse } from "../../types/api";
import type { CommandItem, CommandPerformContext } from "./types";

// How many of the most recently *completed* scans get their findings,
// compliance, and report-availability pulled for deep search. Bounded
// deliberately — KAVACH has no "search findings across every scan I've ever
// run" endpoint (see backend_gaps-style note in Findings/Reports section
// below), so this aggregates over existing per-scan endpoints for a
// realistic recent window instead of inventing a global one.
const DEEP_SCAN_WINDOW = 5;

const REPORT_LABELS: Record<ReportType, string> = {
  pdf: "Executive PDF",
  pdf_technical: "Technical PDF",
  sarif: "SARIF",
  sbom: "CycloneDX SBOM",
  unified_findings: "Unified Findings (JSON)",
  compliance_report: "Compliance Report",
  csv: "CSV",
};

const REPORT_ICONS: Record<ReportType, CommandItem["icon"]> = {
  pdf: FileText,
  pdf_technical: FileText,
  sarif: ShieldCheck,
  sbom: FileArchive,
  unified_findings: FileCode2,
  compliance_report: ShieldCheck,
  csv: FileSpreadsheet,
};

const REPORT_TYPES: ReportType[] = ["pdf", "pdf_technical", "sarif", "sbom", "unified_findings", "compliance_report", "csv"];

const PROVIDER_LABEL: Record<Repository["provider"], string> = {
  github: "GitHub",
  gitlab: "GitLab",
  bitbucket: "Bitbucket",
  upload: "Direct upload",
};

const SEVERITY_BADGE_TONE: Record<Finding["severity"], CommandItem["badgeTone"]> = {
  CRITICAL: "danger",
  HIGH: "danger",
  MEDIUM: "warning",
  LOW: "success",
  INFO: "neutral",
};

const STATUS_BADGE_TONE: Record<ScanJobStatusResponse["status"], CommandItem["badgeTone"]> = {
  queued: "neutral",
  running: "primary",
  completed: "success",
  failed: "danger",
  cancelled: "warning",
};

/**
 * Aggregates every *dynamic* (backend-data-driven) section of the command
 * palette on top of the app's existing hooks/query keys — repositories and
 * recent scans always; a bounded "deep window" of per-scan findings,
 * compliance, and report availability only once the palette has actually
 * been opened (`enabled`), so a page load never pays for data nobody asked
 * to search yet. Every query below reuses the exact `queryKeys.*` shape the
 * rest of the app uses for the same resource, so if the user already
 * visited (say) Finding Explorer for a scan, this is a cache hit, not a new
 * request.
 */
export function useCommandPaletteData(enabled: boolean) {
  const { hasPermission } = usePermissions();
  const toast = useToast();
  const canDownloadReports = hasPermission("report:download");

  const repositoriesQuery = useQuery({
    queryKey: queryKeys.repositories(),
    queryFn: () => repositoriesApi.list(),
    enabled,
  });

  const recentScansParams = { limit: 20 };
  const recentScansQuery = useQuery({
    queryKey: queryKeys.scanJobs(recentScansParams),
    queryFn: () => scansApi.list(recentScansParams),
    enabled,
  });

  // Same params FindingExplorerPage/ComplianceDashboardPage already fetch
  // with — reuses their cache entry when it exists.
  const completedScansParams = { status: "completed" as const, limit: 100 };
  const completedScansQuery = useQuery({
    queryKey: queryKeys.scanJobs(completedScansParams),
    queryFn: () => scansApi.list(completedScansParams),
    enabled,
  });

  const completedJobsSorted = useMemo(
    () =>
      [...(completedScansQuery.data?.scan_jobs ?? [])].sort((a, b) =>
        (b.finished_at ?? "").localeCompare(a.finished_at ?? ""),
      ),
    [completedScansQuery.data],
  );

  const deepWindowJobs = completedJobsSorted.slice(0, DEEP_SCAN_WINDOW);
  const deepWindowIds = deepWindowJobs.map((j) => j.scan_job_id);

  const findingsQueries = useQueries({
    queries: deepWindowIds.map((scanJobId) => ({
      queryKey: queryKeys.findings(scanJobId),
      queryFn: () => findingsApi.listForScan(scanJobId),
      enabled,
    })),
  });

  const complianceQueries = useQueries({
    queries: deepWindowIds.map((scanJobId) => ({
      queryKey: queryKeys.compliance(scanJobId),
      queryFn: () => complianceApi.getForScan(scanJobId),
      enabled,
    })),
  });

  const mostRecentCompletedJob = completedJobsSorted[0];
  const reportStatusQuery = useQuery({
    queryKey: queryKeys.reportStatus(mostRecentCompletedJob?.scan_job_id ?? ""),
    queryFn: () => reportsApi.getStatus(mostRecentCompletedJob!.scan_job_id),
    enabled: enabled && Boolean(mostRecentCompletedJob) && canDownloadReports,
  });

  const downloadReport = async (scanJobId: string, repoLabel: string, type: ReportType, perfCtx: CommandPerformContext) => {
    try {
      await reportsApi.download(scanJobId, type, `${repoLabel}-${type}`);
      toast.success(`${REPORT_LABELS[type]} downloaded`, repoLabel);
    } catch (error) {
      toast.error("Download failed", error instanceof Error ? error.message : "Please try again.");
    }
    perfCtx.close();
  };

  const repositoryItems = useMemo<CommandItem[]>(
    () =>
      (repositoriesQuery.data ?? []).map((repo) => ({
        id: `repo:${repo.id}`,
        section: "repositories" as const,
        title: repo.name,
        subtitle: [PROVIDER_LABEL[repo.provider], repo.default_branch ?? undefined].filter(Boolean).join(" · "),
        icon: Database,
        badge: PROVIDER_LABEL[repo.provider],
        badgeTone: "neutral" as const,
        keywords: [repo.provider, repo.url ?? "", repo.default_branch ?? ""],
        perform: ({ navigate, close }: CommandPerformContext) => {
          navigate("/repositories");
          close();
        },
      })),
    [repositoriesQuery.data],
  );

  const scanItems = useMemo<CommandItem[]>(
    () =>
      (recentScansQuery.data?.scan_jobs ?? []).map((job) => ({
        id: `scan:${job.scan_job_id}`,
        section: "scans" as const,
        title: job.repository_name,
        subtitle: `${formatRelativeTime(job.finished_at ?? job.queued_at)} · BRS ${formatScore(job.brs_score)}${job.brs_risk_level ? ` (${job.brs_risk_level})` : ""}`,
        icon: ScanLine,
        badge: job.status,
        badgeTone: STATUS_BADGE_TONE[job.status],
        // Branch/commit aren't in ScanJobStatusResponse today, so they
        // aren't searchable here — only what the API actually returns.
        keywords: [job.scan_job_id, job.status, job.priority, job.brs_risk_level ?? ""],
        perform: ({ navigate, close }: CommandPerformContext) => {
          navigate(`/scans/${job.scan_job_id}`);
          close();
        },
      })),
    [recentScansQuery.data],
  );

  const findingItems = useMemo<CommandItem[]>(() => {
    const items: CommandItem[] = [];
    findingsQueries.forEach((q, i) => {
      const job = deepWindowJobs[i];
      for (const finding of q.data?.findings ?? []) {
        items.push({
          id: `finding:${finding.id}`,
          section: "findings" as const,
          title: finding.title,
          subtitle: `${finding.category} · ${job.repository_name}`,
          icon: ScanLine,
          badge: finding.severity,
          badgeTone: SEVERITY_BADGE_TONE[finding.severity],
          keywords: [
            finding.cwe_id ?? "",
            finding.cve ?? "",
            finding.owasp_category ?? "",
            finding.source,
            finding.package ?? "",
            finding.compliance?.rbi_clause ?? "",
            finding.compliance?.pci_clause ?? "",
            finding.compliance?.swift_clause ?? "",
            finding.file_path ? truncateMiddle(finding.file_path, 40) : "",
          ],
          perform: ({ navigate, close }: CommandPerformContext) => {
            navigate(`/findings?scan=${finding.scan_job_id}`);
            close();
          },
        });
      }
    });
    return items;
  }, [findingsQueries, deepWindowJobs]);

  const complianceItems = useMemo<CommandItem[]>(() => {
    const items: CommandItem[] = [];
    complianceQueries.forEach((q, i) => {
      const job = deepWindowJobs[i];
      for (const framework of q.data?.frameworks ?? []) {
        items.push({
          id: `compliance:${job.scan_job_id}:${framework.short_code}`,
          section: "compliance" as const,
          title: `${framework.framework_name}`,
          subtitle: `${framework.compliance_percentage.toFixed(0)}% passing · ${job.repository_name}`,
          icon: ShieldCheck,
          badge: framework.short_code,
          badgeTone: framework.compliance_percentage >= 80 ? "success" : framework.compliance_percentage >= 50 ? "warning" : "danger",
          keywords: [framework.short_code, "rbi", "pci", "pci-dss", "swift", "csp", "compliance", "regulatory"],
          perform: ({ navigate, close }: CommandPerformContext) => {
            navigate(`/compliance?scan=${job.scan_job_id}`);
            close();
          },
        });
      }
    });
    return items;
  }, [complianceQueries, deepWindowJobs]);

  const reportItems = useMemo<CommandItem[]>(() => {
    if (!canDownloadReports || !mostRecentCompletedJob || !reportStatusQuery.data) return [];
    const job = mostRecentCompletedJob;
    const status = reportStatusQuery.data;
    return REPORT_TYPES.filter((type) => status[`${type}_available`]).map((type) => ({
      id: `report:${job.scan_job_id}:${type}`,
      section: "reports" as const,
      title: REPORT_LABELS[type],
      subtitle: `Download for ${job.repository_name} (most recent completed scan)`,
      icon: REPORT_ICONS[type],
      badge: "Download",
      badgeTone: "neutral" as const,
      keywords: [type, "report", "download", "export"],
      keepOpenByDefault: true,
      perform: (perfCtx: CommandPerformContext) => downloadReport(job.scan_job_id, job.repository_name, type, perfCtx),
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canDownloadReports, mostRecentCompletedJob, reportStatusQuery.data]);

  const isLoadingDeep =
    enabled &&
    (completedScansQuery.isLoading || findingsQueries.some((q) => q.isLoading) || complianceQueries.some((q) => q.isLoading));

  return {
    repositoryItems,
    scanItems,
    findingItems,
    complianceItems,
    reportItems,
    mostRecentCompletedScanId: mostRecentCompletedJob?.scan_job_id,
    mostRecentCompletedScanLabel: mostRecentCompletedJob?.repository_name,
    downloadReport: (scanJobId: string, label: string, perfCtx: CommandPerformContext) =>
      downloadReport(scanJobId, label, "pdf", perfCtx),
    isLoadingInitial: enabled && (repositoriesQuery.isLoading || recentScansQuery.isLoading),
    isLoadingDeep,
  };
}

export const DEEP_SCAN_WINDOW_SIZE = DEEP_SCAN_WINDOW;
