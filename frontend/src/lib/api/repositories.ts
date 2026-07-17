import { apiClient } from "./client";
import type { Repository } from "../../types/api";

export const repositoriesApi = {
  list: async (limit = 100, offset = 0): Promise<Repository[]> => {
    const response = await apiClient.get<Repository[]>("/repositories", { params: { limit, offset } });
    return response.data;
  },

  setScheduledScan: async (repositoryId: string, enabled: boolean): Promise<Repository> => {
    const response = await apiClient.patch<Repository>(`/repositories/${repositoryId}/scheduled-scan`, { enabled });
    return response.data;
  },
};
