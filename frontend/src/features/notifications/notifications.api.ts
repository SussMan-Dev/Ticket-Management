import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../../lib/api/client";
import { queryKeys } from "../../lib/api/query-keys";
import { toQueryString } from "../../lib/api/query-string";
import type { PaginationMeta } from "../../types/api";
import type { Notification } from "../../types/domain";

export interface NotificationsQuery {
  page: number;
  limit: number;
  isRead?: boolean;
}

export function useNotifications(params: NotificationsQuery) {
  return useQuery({
    queryKey: queryKeys.notifications(params),
    queryFn: () => apiClient.get<Notification[], PaginationMeta>(
      `/notifications${toQueryString(params)}`,
    ),
  });
}

export function useUnreadNotificationCount() {
  return useQuery({
    queryKey: queryKeys.unreadNotifications,
    queryFn: async () => (await apiClient.get<{ count: number }>(
      "/notifications/unread-count",
    )).data.count,
    refetchInterval: 30_000,
  });
}

function useNotificationMutation<T>(mutationFn: (input: T) => Promise<unknown>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["notifications"] }),
        queryClient.invalidateQueries({ queryKey: queryKeys.unreadNotifications }),
      ]);
    },
  });
}

export function useMarkNotificationRead() {
  return useNotificationMutation(async (id: number) =>
    apiClient.patch<Notification>(`/notifications/${id}/read`, {}));
}

export function useMarkAllNotificationsRead() {
  return useNotificationMutation<void>(async () =>
    apiClient.post<{ updated: number }>("/notifications/read-all", {}));
}
