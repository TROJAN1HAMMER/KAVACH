import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

// Central place to name/shape query keys so hooks and the WebSocket cache
// writer (useScanProgressSocket) always agree on what a given resource's
// key looks like.
export const queryKeys = {
  repositories: () => ["repositories"] as const,
  scanJobs: (filters?: unknown) => ["scan-jobs", filters ?? {}] as const,
  scanJob: (scanJobId: string) => ["scan-job", scanJobId] as const,
  findings: (scanJobId: string) => ["findings", scanJobId] as const,
  compliance: (scanJobId: string) => ["compliance", scanJobId] as const,
  reportStatus: (scanJobId: string) => ["report-status", scanJobId] as const,
  currentUser: () => ["current-user"] as const,
};
