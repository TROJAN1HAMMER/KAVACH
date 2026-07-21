import { apiClient } from "./client";
import type { FindingIntelligence, FindingsListResponse } from "../../types/api";

export const findingsApi = {
  listForScan: async (scanJobId: string): Promise<FindingsListResponse> => {
    const response = await apiClient.get<FindingsListResponse>(`/scan/${scanJobId}/findings`);
    return response.data;
  },

  // RAG Milestone 3 — grounded, citation-backed explanation. Can take a
  // few seconds (embedding + rerank + an LLM call) so callers should only
  // fetch this once a finding is actually opened, not for a whole list.
  getIntelligence: async (findingId: string): Promise<FindingIntelligence> => {
    const response = await apiClient.get<FindingIntelligence>(`/findings/${findingId}/intelligence`);
    return response.data;
  },
};
