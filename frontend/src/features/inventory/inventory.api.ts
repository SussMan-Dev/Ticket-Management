import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../../lib/api/client";
import { queryKeys } from "../../lib/api/query-keys";
import { toQueryString } from "../../lib/api/query-string";
import type { PageQuery, PaginationMeta } from "../../types/api";
import type { PartRequest, PartRequestStatus } from "../../types/domain";

export interface PartRequestsQuery extends PageQuery {
  status?: PartRequestStatus;
  ticketId?: number;
}

export interface CreatePartRequestInput {
  note?: string | null;
  items: Array<{ partId: number; requestedQuantity: number }>;
}

export interface FulfillPartRequestInput {
  note?: string | null;
  items: Array<{ partId: number; quantity: number }>;
}

export function usePartRequests(params: PartRequestsQuery, enabled = true) {
  return useQuery({
    queryKey: queryKeys.partRequests(params),
    queryFn: async () => apiClient.get<PartRequest[], PaginationMeta>(
      `/part-requests${toQueryString(params)}`,
    ),
    enabled,
  });
}

export function usePartRequest(id: number) {
  return useQuery({
    queryKey: queryKeys.partRequest(id),
    queryFn: async () => (await apiClient.get<PartRequest>(`/part-requests/${id}`)).data,
    enabled: id > 0,
  });
}

function usePartRequestMutation<TInput>(
  ticketId: number | undefined,
  mutationFn: (input: TInput) => Promise<PartRequest>,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: async (partRequest) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["part-requests"] }),
        queryClient.invalidateQueries({ queryKey: queryKeys.partRequest(partRequest.id) }),
        queryClient.invalidateQueries({ queryKey: ["parts"] }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.ticket(ticketId ?? partRequest.ticket.id),
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.ticketHistory(ticketId ?? partRequest.ticket.id),
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.ticketTimeline(ticketId ?? partRequest.ticket.id),
        }),
      ]);
    },
  });
}

export function useCreatePartRequest(ticketId: number) {
  return usePartRequestMutation(ticketId, async (input: CreatePartRequestInput) =>
    (await apiClient.post<PartRequest>(
      `/repair-tickets/${ticketId}/part-requests`,
      input,
    )).data);
}

export function useApprovePartRequest(requestId: number) {
  return usePartRequestMutation(undefined, async (reason?: string) =>
    (await apiClient.post<PartRequest>(
      `/part-requests/${requestId}/approve`,
      reason ? { reason } : {},
    )).data);
}

export function useRejectPartRequest(requestId: number) {
  return usePartRequestMutation(undefined, async (reason: string) =>
    (await apiClient.post<PartRequest>(
      `/part-requests/${requestId}/reject`,
      { reason },
    )).data);
}

export function useFulfillPartRequest(requestId: number) {
  return usePartRequestMutation(undefined, async (input: FulfillPartRequestInput) =>
    (await apiClient.post<PartRequest>(
      `/part-requests/${requestId}/fulfill`,
      input,
    )).data);
}
