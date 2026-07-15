import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../../lib/api/client";
import { queryKeys } from "../../lib/api/query-keys";
import type { Delivery } from "../../types/domain";

export interface DeliveryInput {
  recipientName: string;
  recipientPhone?: string | null;
  proofUrl?: string | null;
  note?: string | null;
  paymentExceptionReason?: string | null;
}

export function useDelivery(ticketId: number, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.delivery(ticketId),
    queryFn: async () => (await apiClient.get<Delivery>(`/repair-tickets/${ticketId}/delivery`)).data,
    enabled: ticketId > 0 && enabled,
  });
}

export function useDeliverTicket(ticketId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: DeliveryInput) =>
      (await apiClient.post<Delivery>(`/repair-tickets/${ticketId}/deliver`, input)).data,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.delivery(ticketId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.ticket(ticketId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.ticketHistory(ticketId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.ticketTimeline(ticketId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.ticketAttachments(ticketId) }),
        queryClient.invalidateQueries({ queryKey: ["notifications"] }),
      ]);
    },
  });
}

export function useCloseDeliveredTicket(ticketId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (reason?: string) => (await apiClient.post<{ ticketId: number; status: "CLOSED" }>(
      `/repair-tickets/${ticketId}/close`, reason ? { reason } : {},
    )).data,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.ticket(ticketId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.ticketHistory(ticketId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.ticketTimeline(ticketId) }),
        queryClient.invalidateQueries({ queryKey: ["notifications"] }),
      ]);
    },
  });
}
