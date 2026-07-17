import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { scansApi, type ScanJobListParams } from "../lib/api/scans";
import { queryKeys } from "../lib/queryClient";
import type { ScanJobPriority } from "../types/api";

const ACTIVE_STATUSES = new Set(["queued", "running"]);

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
