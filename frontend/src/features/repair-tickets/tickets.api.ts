import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../../lib/api/client";
import { queryKeys } from "../../lib/api/query-keys";
import { toQueryString } from "../../lib/api/query-string";
import type { PageQuery, PaginationMeta } from "../../types/api";
import type {
  RepairTicket,
  TicketAttachment,
  TicketAttachmentType,
  TicketPriority,
  TicketStatus,
  TicketStatusHistory,
} from "../../types/domain";

export interface TicketsQuery extends PageQuery {
  status?: TicketStatus;
  priority?: TicketPriority;
  customerId?: number;
  deviceId?: number;
}

export interface TicketInput {
  customerId?: number;
  deviceId: number;
  title: string;
  customerIssue: string;
  initialCondition?: string | null;
  accessoriesReceived?: string | null;
  priority: TicketPriority;
  expectedDiagnosisAt?: string | null;
  expectedCompletionAt?: string | null;
  receiveNow: boolean;
}

export interface AttachmentInput {
  attachmentType: TicketAttachmentType;
  fileUrl: string;
  fileName?: string | null;
  mimeType?: string | null;
}

export function useTickets(params: TicketsQuery) {
  return useQuery({
    queryKey: queryKeys.tickets(params),
    queryFn: async () =>
      apiClient.get<RepairTicket[], PaginationMeta>(`/repair-tickets${toQueryString(params)}`),
  });
}

export function useTicket(id: number) {
  return useQuery({
    queryKey: queryKeys.ticket(id),
    queryFn: async () => (await apiClient.get<RepairTicket>(`/repair-tickets/${id}`)).data,
    enabled: Number.isInteger(id) && id > 0,
  });
}

export function useTicketHistory(id: number) {
  return useQuery({
    queryKey: queryKeys.ticketHistory(id),
    queryFn: async () =>
      (await apiClient.get<TicketStatusHistory[]>(`/repair-tickets/${id}/status-history`)).data,
    enabled: Number.isInteger(id) && id > 0,
  });
}

export function useTicketAttachments(id: number) {
  return useQuery({
    queryKey: queryKeys.ticketAttachments(id),
    queryFn: async () =>
      (await apiClient.get<TicketAttachment[]>(`/repair-tickets/${id}/attachments`)).data,
    enabled: Number.isInteger(id) && id > 0,
  });
}

function useTicketMutation<TInput>(
  mutationFn: (input: TInput) => Promise<RepairTicket>,
  ticketId?: number,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: async (ticket) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["repair-tickets"] }),
        queryClient.invalidateQueries({ queryKey: queryKeys.ticket(ticket.id) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.ticketHistory(ticket.id) }),
        ticketId && ticketId !== ticket.id
          ? queryClient.invalidateQueries({ queryKey: queryKeys.ticket(ticketId) })
          : Promise.resolve(),
      ]);
    },
  });
}

export function useCreateTicket() {
  return useTicketMutation(async (input: TicketInput) =>
    (await apiClient.post<RepairTicket>("/repair-tickets", input)).data,
  );
}

export function useReceiveTicket(ticketId: number) {
  return useTicketMutation(async (reason?: string) =>
    (await apiClient.post<RepairTicket>(`/repair-tickets/${ticketId}/receive`, reason ? { reason } : {})).data,
  ticketId);
}

export function useCancelTicket(ticketId: number) {
  return useTicketMutation(async (reason: string) =>
    (await apiClient.post<RepairTicket>(`/repair-tickets/${ticketId}/cancel`, { reason })).data,
  ticketId);
}

export function useChangeTicketStatus(ticketId: number) {
  return useTicketMutation(async (input: { status: TicketStatus; reason?: string }) =>
    (await apiClient.post<RepairTicket>(`/repair-tickets/${ticketId}/change-status`, input)).data,
  ticketId);
}

export function useCreateAttachment(ticketId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: AttachmentInput) =>
      (await apiClient.post<TicketAttachment>(`/repair-tickets/${ticketId}/attachments`, input)).data,
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: queryKeys.ticketAttachments(ticketId) }),
  });
}
