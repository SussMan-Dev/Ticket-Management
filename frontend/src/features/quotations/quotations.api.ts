import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../../lib/api/query-keys";
import type { QuotationStatus } from "../../types/domain";
import { quotationGateway, type MockDraftInput } from "./quotation.gateway";

export function useQuotations(ticketId: number) {
  return useQuery({
    queryKey: queryKeys.quotations(ticketId),
    queryFn: () => quotationGateway.list(ticketId),
    enabled: import.meta.env.VITE_ENABLE_QUOTATION_MOCK !== "false" && ticketId > 0,
  });
}

export function useQuotation(id: number) {
  return useQuery({
    queryKey: queryKeys.quotation(id),
    queryFn: () => quotationGateway.get(id),
    enabled: import.meta.env.VITE_ENABLE_QUOTATION_MOCK !== "false" && id > 0,
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

export function useCreateMockQuotation(ticketId: number) {
  const invalidate = useQuotationMutation(ticketId);
  return useMutation({
    mutationFn: (input: Omit<MockDraftInput, "ticketId">) => quotationGateway.createDraft({ ...input, ticketId }),
    onSuccess: async (quotation) => invalidate(quotation.id),
  });
}

export function useUpdateMockQuotation(ticketId: number, quotationId: number) {
  const invalidate = useQuotationMutation(ticketId);
  return useMutation({
    mutationFn: (input: Omit<MockDraftInput, "ticketId">) => quotationGateway.updateDraft(quotationId, { ...input, ticketId }),
    onSuccess: async () => invalidate(quotationId),
  });
}

export function useTransitionMockQuotation(ticketId: number, quotationId: number) {
  const invalidate = useQuotationMutation(ticketId);
  return useMutation({
    mutationFn: (status: QuotationStatus) => quotationGateway.transition(quotationId, status),
    onSuccess: async () => invalidate(quotationId),
  });
}
