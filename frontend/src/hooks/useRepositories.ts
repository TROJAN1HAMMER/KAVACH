import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { repositoriesApi } from "../lib/api/repositories";
import { queryKeys } from "../lib/queryClient";

export function useRepositories() {
  return useQuery({
    queryKey: queryKeys.repositories(),
    queryFn: () => repositoriesApi.list(),
  });
}

export function useSetScheduledScan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ repositoryId, enabled }: { repositoryId: string; enabled: boolean }) =>
      repositoriesApi.setScheduledScan(repositoryId, enabled),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.repositories() });
    },
  });
}
