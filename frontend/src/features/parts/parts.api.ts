import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../../lib/api/client";
import { queryKeys } from "../../lib/api/query-keys";
import { toQueryString } from "../../lib/api/query-string";
import type { PageQuery, PaginationMeta } from "../../types/api";
import type {
  InventoryTransaction,
  InventoryTransactionType,
  Part,
} from "../../types/domain";

export interface PartsQuery extends PageQuery {
  isActive?: boolean;
  lowStock?: boolean;
}

export interface PartInput {
  sku: string;
  name: string;
  description?: string | null;
  unit: string;
  purchasePrice: number;
  sellingPrice: number;
  minimumStock: number;
  isActive: boolean;
}

export interface PartTransactionsQuery extends PageQuery {
  transactionType?: InventoryTransactionType;
}

export function useParts(params: PartsQuery) {
  return useQuery({
    queryKey: queryKeys.parts(params),
    queryFn: async () =>
      apiClient.get<Part[], PaginationMeta>(`/parts${toQueryString(params)}`),
  });
}

export function usePartTransactions(partId: number, params: PartTransactionsQuery) {
  return useQuery({
    queryKey: queryKeys.partTransactions(partId, params),
    queryFn: async () => apiClient.get<InventoryTransaction[], PaginationMeta>(
      `/parts/${partId}/transactions${toQueryString(params)}`,
    ),
    enabled: partId > 0,
  });
}

function usePartMutation<TInput>(
  mutationFn: (input: TInput) => Promise<Part>,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: async (part) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["parts"] }),
        queryClient.invalidateQueries({ queryKey: queryKeys.part(part.id) }),
      ]);
    },
  });
}

export function useCreatePart() {
  return usePartMutation(async (input: PartInput) =>
    (await apiClient.post<Part>("/parts", input)).data);
}

export function useUpdatePart(partId: number) {
  return usePartMutation(async (input: Partial<PartInput>) =>
    (await apiClient.patch<Part>(`/parts/${partId}`, input)).data);
}

export function useStockIn(partId: number) {
  return usePartMutation(async (input: { quantity: number; note: string }) =>
    (await apiClient.post<Part>(`/parts/${partId}/stock-in`, input)).data);
}

export function useAdjustStock(partId: number) {
  return usePartMutation(async (input: { quantityChange: number; note: string }) =>
    (await apiClient.post<Part>(`/parts/${partId}/adjust-stock`, input)).data);
}

