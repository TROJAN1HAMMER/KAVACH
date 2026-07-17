import { apiClient } from "./client";
import type { ComplianceEngineResult } from "../../types/api";

export const complianceApi = {
  getForScan: async (scanJobId: string): Promise<ComplianceEngineResult> => {
    const response = await apiClient.get<ComplianceEngineResult>(`/scan/${scanJobId}/compliance`);
    return response.data;
  },
};
