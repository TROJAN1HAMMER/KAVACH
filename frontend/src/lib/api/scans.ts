import { apiClient } from "./client";
import type { ScanJobCreateResponse, ScanJobListResponse, ScanJobPriority, ScanJobStatus, ScanJobStatusResponse } from "../../types/api";

export interface ScanJobListParams {
  status?: ScanJobStatus;
  limit?: number;
  offset?: number;
}

export const scansApi = {
  list: async (params: ScanJobListParams = {}): Promise<ScanJobListResponse> => {
    const response = await apiClient.get<ScanJobListResponse>("/scan", { params });
    return response.data;
  },

  get: async (scanJobId: string): Promise<ScanJobStatusResponse> => {
    const response = await apiClient.get<ScanJobStatusResponse>(`/scan/${scanJobId}`);
    return response.data;
  },

  submitRepository: async (payload: {
    repo_url: string;
    ref?: string;
    priority?: ScanJobPriority;
    max_retries?: number;
    timeout_seconds?: number;
  }): Promise<ScanJobCreateResponse> => {
    const response = await apiClient.post<ScanJobCreateResponse>("/scan/repository", payload);
    return response.data;
  },

  uploadZip: async (file: File, priority?: ScanJobPriority): Promise<ScanJobCreateResponse> => {
    const formData = new FormData();
    formData.append("file", file);
    if (priority) formData.append("priority", priority);
    const response = await apiClient.post<ScanJobCreateResponse>("/scan", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return response.data;
  },

  startPremade: async (riskLevel: "very_low" | "low" | "medium" | "high" | "critical"): Promise<ScanJobCreateResponse> => {
    const response = await apiClient.post<ScanJobCreateResponse>(`/scan/premade/${riskLevel}`);
    return response.data;
  },

  cancel: async (scanJobId: string): Promise<ScanJobStatusResponse> => {
    const response = await apiClient.post<ScanJobStatusResponse>(`/scan/${scanJobId}/cancel`);
    return response.data;
  },
};
