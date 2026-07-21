import { useQuery } from "@tanstack/react-query";
import { findingsApi } from "../lib/api/findings";
import { complianceApi } from "../lib/api/compliance";
import { reportsApi } from "../lib/api/reports";
import { queryKeys } from "../lib/queryClient";

export function useFindings(scanJobId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.findings(scanJobId ?? ""),
    queryFn: () => findingsApi.listForScan(scanJobId as string),
    enabled: Boolean(scanJobId),
  });
}

// Fetched lazily — only once a finding is actually opened (the caller
// passes `enabled` tied to the detail modal being open) — never for a
// whole findings list, since each call does real retrieval+rerank(+LLM).
export function useFindingIntelligence(findingId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.findingIntelligence(findingId ?? ""),
    queryFn: () => findingsApi.getIntelligence(findingId as string),
    enabled: Boolean(findingId) && enabled,
    staleTime: Infinity, // a finding's own facts never change once scanned; no reason to refetch
  });
}

export function useCompliance(scanJobId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.compliance(scanJobId ?? ""),
    queryFn: () => complianceApi.getForScan(scanJobId as string),
    enabled: Boolean(scanJobId),
  });
}

// Report files (PDF/SARIF/SBOM/CSV/...) are rendered by a Celery task
// dispatched *after* the scan job itself flips to "completed" — so the
// first fetch (triggered the moment a caller enables this once the job is
// done) almost always catches every report row still "pending"/
// "generating". Keep polling until every known report has reached a
// terminal state (completed or failed), then stop — no reason to keep
// hitting the endpoint once there's nothing left to change.
const IN_PROGRESS_REPORT_STATUSES = new Set(["pending", "generating"]);

export function useReportStatus(scanJobId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.reportStatus(scanJobId ?? ""),
    queryFn: () => reportsApi.getStatus(scanJobId as string),
    enabled: Boolean(scanJobId),
    refetchInterval: (query) => {
      const reports = query.state.data?.reports;
      if (!reports || reports.length === 0) return 2_000; // nothing seen yet — keep checking
      const stillGenerating = reports.some((report) => IN_PROGRESS_REPORT_STATUSES.has(report.status));
      return stillGenerating ? 2_000 : false;
    },
  });
}
