import { apiClient } from "./client";
import type { ReportPathsResponse, ReportType } from "../../types/api";

export const reportsApi = {
  getStatus: async (scanJobId: string): Promise<ReportPathsResponse> => {
    const response = await apiClient.get<ReportPathsResponse>(`/reports/${scanJobId}`);
    return response.data;
  },

  // Report downloads stream a file (or 307-redirect to a presigned S3 URL),
  // so this can't go through a plain <a href> — the bearer token has to
  // ride an Authorization header, not a query param, to reach the file.
  download: async (scanJobId: string, reportType: ReportType, fileName: string): Promise<void> => {
    const response = await apiClient.get(`/reports/${scanJobId}/download/${reportType}`, {
      responseType: "blob",
    });
    const url = window.URL.createObjectURL(response.data);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },
};
