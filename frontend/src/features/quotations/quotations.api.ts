import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../../lib/api/query-keys";
import type { QuotationStatus } from "../../types/domain";
import {
  quotationGateway,
  type CreateQuotationInput,
  type UpdateQuotationInput,
} from "./quotation.gateway";

export function useQuotations(ticketId: number) {
  return useQuery({
    queryKey: queryKeys.quotations(ticketId),
    queryFn: () => quotationGateway.list(ticketId),
    enabled: Number.isInteger(ticketId) && ticketId > 0,
  });
}

export function useQuotation(id: number) {
  return useQuery({
    queryKey: queryKeys.quotation(id),
    queryFn: () => quotationGateway.get(id),
    enabled: Number.isInteger(id) && id > 0,
  });
}

function useQuotationMutation(ticketId: number) {
  const queryClient = useQueryClient();
  return async (quotationId?: number) => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.quotations(ticketId) }),
      quotationId
        ? queryClient.invalidateQueries({ queryKey: queryKeys.quotation(quotationId) })
        : Promise.resolve(),
      queryClient.invalidateQueries({ queryKey: queryKeys.ticket(ticketId) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.ticketHistory(ticketId) }),
    ]);
  };
}

export function useCreateQuotation(ticketId: number) {
  const invalidate = useQuotationMutation(ticketId);
  return useMutation({
    mutationFn: (input: Omit<CreateQuotationInput, "ticketId">) =>
      quotationGateway.createDraft({ ...input, ticketId }),
    onSuccess: async (quotation) => invalidate(quotation.id),
  });
}

export function useUpdateQuotation(ticketId: number, quotationId: number) {
  const invalidate = useQuotationMutation(ticketId);
  return useMutation({
    mutationFn: (input: UpdateQuotationInput) =>
      quotationGateway.updateDraft(quotationId, input),
    onSuccess: async () => invalidate(quotationId),
  });
}

export function useTransitionQuotation(ticketId: number, quotationId: number) {
  const invalidate = useQuotationMutation(ticketId);
  return useMutation({
    mutationFn: (status: QuotationStatus) =>
      quotationGateway.transition(quotationId, status),
    onSuccess: async () => invalidate(quotationId),
  });
}
