import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../../lib/api/client";
import { queryKeys } from "../../lib/api/query-keys";
import type { AssignableTechnician, TicketAssignment } from "../../types/domain";

export function useAssignableTechnicians() {
  return useQuery({
    queryKey: queryKeys.assignableTechnicians,
    queryFn: async () => (await apiClient.get<AssignableTechnician[]>(
      "/repair-tickets/assignable-technicians",
    )).data,
    staleTime: 60_000,
  });
}

export function useAssignTicket(ticketId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { technicianId: number; note?: string | null }) =>
      (await apiClient.post<TicketAssignment>(`/repair-tickets/${ticketId}/assign`, input)).data,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.ticket(ticketId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.ticketHistory(ticketId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.ticketTimeline(ticketId) }),
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
        queryClient.invalidateQueries({ queryKey: queryKeys.ticketTimeline(ticketId) }),
        queryClient.invalidateQueries({ queryKey: ["repair-tickets"] }),
      ]);
    },
  });
}
