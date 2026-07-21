import { useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { scansApi, type ScanJobListParams } from "../lib/api/scans";
import { queryKeys } from "../lib/queryClient";
import type { ScanJobPriority } from "../types/api";

const ACTIVE_STATUSES = new Set(["queued", "running"]);

// Recent-jobs window the app-wide watcher (below) polls. Wide enough to
// catch essentially every scan a single user has in flight without pulling
// full history.
const WATCHER_LIST_PARAMS: ScanJobListParams = { limit: 50 };

// The WebSocket feed is scoped to one scan job at a time (see
// useScanProgressSocket) — there's no server-side fan-out for "all active
// jobs" today, so the queue list falls back to polling. Only poll while
// something in the current page is actually queued/running; once
// everything's terminal there's nothing left to change until the user
// starts a new scan.
export function useScanJobs(params: ScanJobListParams = {}) {
  return useQuery({
    queryKey: queryKeys.scanJobs(params),
    queryFn: () => scansApi.list(params),
    refetchInterval: (query) => {
      const jobs = query.state.data?.scan_jobs ?? [];
      return jobs.some((job) => ACTIVE_STATUSES.has(job.status)) ? 5_000 : false;
    },
  });
}

export function useScanJob(scanJobId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.scanJob(scanJobId ?? ""),
    queryFn: () => scansApi.get(scanJobId as string),
    enabled: Boolean(scanJobId),
  });
}

export function useSubmitRepositoryScan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { repo_url: string; ref?: string; priority?: ScanJobPriority }) =>
      scansApi.submitRepository(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scan-jobs"] });
      queryClient.invalidateQueries({ queryKey: queryKeys.repositories() });
    },
  });
}

export function useUploadZipScan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ file, priority }: { file: File; priority?: ScanJobPriority }) => scansApi.uploadZip(file, priority),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scan-jobs"] });
      queryClient.invalidateQueries({ queryKey: queryKeys.repositories() });
    },
  });
}

export function useCancelScanJob() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (scanJobId: string) => scansApi.cancel(scanJobId),
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.scanJob(data.scan_job_id), data);
      queryClient.invalidateQueries({ queryKey: ["scan-jobs"] });
    },
  });
}

/**
 * App-wide "did any scan just finish?" watcher — mounted once in AppShell
 * so it runs regardless of which page is open.
 *
 * Why this exists: RiskDashboardPage/ExecutiveDashboardPage/
 * ComplianceDashboardPage/FindingExplorerPage all call
 * `useScanJobs({ status: "completed", ... })`. Because that result set is
 * pre-filtered to already-completed jobs, `useScanJobs`'s own
 * `refetchInterval` predicate ("is anything in this result queued/running?")
 * can never be true for them, so those pages fetch once on mount and then
 * never refresh — a scan completing elsewhere (Scan Queue, a webhook-
 * triggered run, another tab) never reaches them until a manual reload.
 *
 * This hook polls the *unfiltered* recent-jobs list — which does contain
 * active jobs and so does keep polling while any exist — purely to detect
 * status transitions. When a job leaves queued/running for a terminal
 * status, or a new job appears, it invalidates every cache that could be
 * showing stale data for it. React Query only refetches queries that are
 * actually mounted, so this doesn't create requests for pages nobody has
 * open — it just makes sure whichever page IS open reflects reality.
 */
export function useGlobalScanJobsWatcher() {
  const queryClient = useQueryClient();
  const previousStatuses = useRef<Map<string, string>>(new Map());

  const { data } = useQuery({
    queryKey: queryKeys.scanJobs(WATCHER_LIST_PARAMS),
    queryFn: () => scansApi.list(WATCHER_LIST_PARAMS),
    refetchInterval: (query) => {
      const jobs = query.state.data?.scan_jobs ?? [];
      return jobs.some((job) => ACTIVE_STATUSES.has(job.status)) ? 5_000 : false;
    },
  });

  useEffect(() => {
    const jobs = data?.scan_jobs ?? [];
    const previous = previousStatuses.current;

    let anyChange = jobs.length !== previous.size;
    const justFinished: string[] = [];

    for (const job of jobs) {
      const prevStatus = previous.get(job.scan_job_id);
      if (prevStatus === job.status) continue;
      anyChange = true;
      if (prevStatus && ACTIVE_STATUSES.has(prevStatus) && !ACTIVE_STATUSES.has(job.status)) {
        justFinished.push(job.scan_job_id);
      }
    }

    if (anyChange) {
      // Broad match: refreshes every "scan-jobs" list variant currently
      // mounted (any-status queue, completed-only dashboards, etc.) since
      // the set of jobs matching any given filter may have changed.
      queryClient.invalidateQueries({ queryKey: ["scan-jobs"] });
      for (const scanJobId of justFinished) {
        queryClient.invalidateQueries({ queryKey: queryKeys.scanJob(scanJobId) });
        queryClient.invalidateQueries({ queryKey: queryKeys.findings(scanJobId) });
        queryClient.invalidateQueries({ queryKey: queryKeys.compliance(scanJobId) });
        queryClient.invalidateQueries({ queryKey: queryKeys.reportStatus(scanJobId) });
      }
    }

    previousStatuses.current = new Map(jobs.map((job) => [job.scan_job_id, job.status]));
  }, [data, queryClient]);
}
