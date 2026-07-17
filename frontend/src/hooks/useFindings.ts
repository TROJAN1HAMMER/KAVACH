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

export function useCompliance(scanJobId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.compliance(scanJobId ?? ""),
    queryFn: () => complianceApi.getForScan(scanJobId as string),
    enabled: Boolean(scanJobId),
  });
}

export function useReportStatus(scanJobId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.reportStatus(scanJobId ?? ""),
    queryFn: () => reportsApi.getStatus(scanJobId as string),
    enabled: Boolean(scanJobId),
  });
}
