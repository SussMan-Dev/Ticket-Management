import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../../lib/api/client";
import { queryKeys } from "../../lib/api/query-keys";
import { toQueryString } from "../../lib/api/query-string";
import type { PageQuery, PaginationMeta } from "../../types/api";
import type { CustomerProfile, CustomerSummary, UserAccountStatus } from "../../types/domain";

export interface CustomersQuery extends PageQuery { status?: UserAccountStatus }
export interface CustomerInput {
  fullName: string; email: string; phone?: string; password: string; address?: string; notes?: string;
}
export interface CustomerUpdateInput {
  fullName?: string; phone?: string | null; address?: string | null; notes?: string | null;
}

export function useCustomers(params: CustomersQuery, enabled = true) {
  return useQuery({
    queryKey: queryKeys.customers(params),
    queryFn: async () => apiClient.get<CustomerSummary[], PaginationMeta>(`/customers${toQueryString(params)}`),
    enabled,
  });
}

export function useCustomer(id: number) {
  return useQuery({
    queryKey: queryKeys.customer(id),
    queryFn: async () => (await apiClient.get<CustomerProfile>(`/customers/${id}`)).data,
    enabled: Number.isInteger(id) && id > 0,
  });
}

export function useCreateCustomer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CustomerInput) => (await apiClient.post<CustomerProfile>("/customers", input)).data,
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: ["customers"] }),
  });
}

export function useUpdateCustomer(id: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CustomerUpdateInput) =>
      (await apiClient.patch<CustomerProfile>(`/customers/${id}`, input)).data,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.customer(id) }),
        queryClient.invalidateQueries({ queryKey: ["customers"] }),
      ]);
    },
  });
}
