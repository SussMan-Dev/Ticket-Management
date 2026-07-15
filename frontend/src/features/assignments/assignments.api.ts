import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../../lib/api/client";
import { queryKeys } from "../../lib/api/query-keys";
import type { TicketAssignment } from "../../types/domain";

export function useAssignTicket(ticketId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { technicianId: number; note?: string | null }) =>
      (await apiClient.post<TicketAssignment>(`/repair-tickets/${ticketId}/assign`, input)).data,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.ticket(ticketId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.ticketHistory(ticketId) }),
        queryClient.invalidateQueries({ queryKey: ["repair-tickets"] }),
      ]);
    },
  });
}

export function useReassignTicket(ticketId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { technicianId: number; note: string }) =>
      (await apiClient.post<TicketAssignment>(`/repair-tickets/${ticketId}/reassign`, input)).data,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.ticket(ticketId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.ticketHistory(ticketId) }),
        queryClient.invalidateQueries({ queryKey: ["repair-tickets"] }),
      ]);
    },
  });
}
