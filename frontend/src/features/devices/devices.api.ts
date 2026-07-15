import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../../lib/api/client";
import { queryKeys } from "../../lib/api/query-keys";
import { toQueryString } from "../../lib/api/query-string";
import type { PageQuery, PaginationMeta } from "../../types/api";
import type { CatalogItem, Device } from "../../types/domain";

export interface DevicesQuery extends PageQuery { customerId?: number }
export interface DeviceInput {
  customerId?: number;
  categoryId: number;
  brandId?: number | null;
  model?: string | null;
  serialNumber?: string | null;
  imei?: string | null;
  color?: string | null;
  description?: string | null;
}

export function useDevices(params: DevicesQuery, enabled = true) {
  return useQuery({
    queryKey: queryKeys.devices(params),
    queryFn: async () => apiClient.get<Device[], PaginationMeta>(`/devices${toQueryString(params)}`),
    enabled,
  });
}

export function useDeviceCatalogs() {
  return useQuery({
    queryKey: queryKeys.deviceCatalogs,
    queryFn: async () => {
      const [categories, brands] = await Promise.all([
        apiClient.get<CatalogItem[]>("/devices/categories"),
        apiClient.get<CatalogItem[]>("/devices/brands"),
      ]);
      return { categories: categories.data, brands: brands.data };
    },
    staleTime: 10 * 60 * 1000,
  });
}

export function useCreateDevice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: DeviceInput) => (await apiClient.post<Device>("/devices", input)).data,
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: ["devices"] }),
  });
}

export function useDeleteDevice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => { await apiClient.delete<null>(`/devices/${id}`); return id; },
    onSuccess: async (id) => {
      queryClient.removeQueries({ queryKey: queryKeys.device(id) });
      await queryClient.invalidateQueries({ queryKey: ["devices"] });
    },
  });
}
