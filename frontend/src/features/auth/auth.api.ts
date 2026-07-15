import { apiClient } from "../../lib/api/client";
import { tokenStore } from "../../lib/api/token-store";
import type { AuthPayload } from "../../types/api";
import type { SafeUser } from "../../types/domain";

export interface LoginInput { email: string; password: string }
export interface RegisterInput {
  fullName: string;
  email: string;
  phone?: string;
  password: string;
  address?: string;
}

export const authApi = {
  async login(input: LoginInput): Promise<AuthPayload> {
    const response = await apiClient.post<AuthPayload>("/auth/login", input);
    tokenStore.set(response.data.accessToken);
    return response.data;
  },
  async register(input: RegisterInput): Promise<SafeUser> {
    return (await apiClient.post<SafeUser>("/auth/register", input)).data;
  },
  async me(): Promise<SafeUser> {
    return (await apiClient.get<SafeUser>("/auth/me")).data;
  },
  async restore(): Promise<SafeUser> {
    await apiClient.refreshAccessToken();
    return authApi.me();
  },
  async logout(): Promise<void> {
    try {
      await apiClient.post<null>("/auth/logout");
    } finally {
      tokenStore.clear();
    }
  },
};
