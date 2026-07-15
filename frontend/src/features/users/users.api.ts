import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../../lib/api/client";
import { queryKeys } from "../../lib/api/query-keys";
import { toQueryString } from "../../lib/api/query-string";
import type { PageQuery, PaginationMeta } from "../../types/api";
import type { SafeUser, StaffRole, UserAccountStatus, UserRole } from "../../types/domain";

export interface UsersQuery extends PageQuery { role?: UserRole; status?: UserAccountStatus }
export interface CreateStaffInput {
  fullName: string; email: string; phone?: string; password: string; role: StaffRole;
}

export function useUsers(params: UsersQuery) {
  return useQuery({
    queryKey: queryKeys.users(params),
    queryFn: async () => apiClient.get<SafeUser[], PaginationMeta>(`/users${toQueryString(params)}`),
  });
}

export function useCreateStaff() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateStaffInput) => (await apiClient.post<SafeUser>("/users", input)).data,
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: ["users"] }),
  });
}

export function useUpdateUserStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: number; status: UserAccountStatus }) =>
      (await apiClient.patch<SafeUser>(`/users/${id}/status`, { status })).data,
    onSuccess: async (user) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["users"] }),
        queryClient.invalidateQueries({ queryKey: queryKeys.user(user.id) }),
      ]);
    },
  });
}

export function useUpdateUserRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, role }: { id: number; role: UserRole }) =>
      (await apiClient.patch<SafeUser>(`/users/${id}/role`, { role })).data,
    onSuccess: async (user) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["users"] }),
        queryClient.invalidateQueries({ queryKey: queryKeys.user(user.id) }),
      ]);
    },
  });
}

export function useUpdateUser(id: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { fullName?: string; phone?: string | null; avatarUrl?: string | null }) =>
      (await apiClient.patch<SafeUser>(`/users/${id}`, input)).data,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.session }),
        queryClient.invalidateQueries({ queryKey: queryKeys.user(id) }),
      ]);
    },
  });
}

export function useUploadAvatar(id: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) =>
      (await apiClient.upload<SafeUser>(`/users/${id}/avatar`, file)).data,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.session }),
        queryClient.invalidateQueries({ queryKey: queryKeys.user(id) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.customer(id) }),
        queryClient.invalidateQueries({ queryKey: ["users"] }),
        queryClient.invalidateQueries({ queryKey: ["customers"] }),
      ]);
    },
  });
}
