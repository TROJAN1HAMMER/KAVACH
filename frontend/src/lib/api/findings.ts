import { apiClient } from "./client";
import type { FindingsListResponse } from "../../types/api";

export const findingsApi = {
  listForScan: async (scanJobId: string): Promise<FindingsListResponse> => {
    const response = await apiClient.get<FindingsListResponse>(`/scan/${scanJobId}/findings`);
    return response.data;
  },
};
