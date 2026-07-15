import type { ApiSuccess, AuthPayload } from "../../types/api";
import { ApiError, toApiError } from "./api-error";
import { tokenStore } from "./token-store";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "/api/v1";
let refreshPromise: Promise<AuthPayload> | null = null;
let authenticationFailureHandler: (() => void) | null = null;

interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  retryUnauthorized?: boolean;
}

async function readBody(response: Response): Promise<unknown> {
  if (response.status === 204) return null;
  const contentType = response.headers.get("content-type") ?? "";
  return contentType.includes("application/json") ? response.json() : null;
}

async function rawRequest<T, TMeta = null>(path: string, options: RequestOptions = {}): Promise<ApiSuccess<T, TMeta>> {
  const headers = new Headers(options.headers);
  const token = tokenStore.get();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (options.body !== undefined) headers.set("Content-Type", "application/json");

  const requestUrl = API_BASE_URL.startsWith("http")
    ? `${API_BASE_URL}${path}`
    : new URL(`${API_BASE_URL}${path}`, window.location.origin).toString();
  const response = await fetch(requestUrl, {
    ...options,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    credentials: "include",
    headers,
  });
  const body = await readBody(response);

  if (!response.ok) throw toApiError(response.status, body);
  return body as ApiSuccess<T, TMeta>;
}

async function refreshAccessToken(): Promise<AuthPayload> {
  refreshPromise ??= (async () => {
    try {
      const response = await rawRequest<AuthPayload>("/auth/refresh-token", {
        method: "POST",
        retryUnauthorized: false,
      });
      tokenStore.set(response.data.accessToken);
      return response.data;
    } catch (error) {
      tokenStore.clear();
      authenticationFailureHandler?.();
      throw error;
    } finally {
      refreshPromise = null;
    }
  })();
  return refreshPromise;
}

async function request<T, TMeta = null>(path: string, options: RequestOptions = {}): Promise<ApiSuccess<T, TMeta>> {
  try {
    return await rawRequest<T, TMeta>(path, options);
  } catch (error) {
    const canRefresh =
      error instanceof ApiError &&
      error.status === 401 &&
      options.retryUnauthorized !== false &&
      !path.startsWith("/auth/refresh-token") &&
      !path.startsWith("/auth/login") &&
      !path.startsWith("/auth/register");

    if (!canRefresh) throw error;
    await refreshAccessToken();
    return rawRequest<T, TMeta>(path, { ...options, retryUnauthorized: false });
  }
}

export const apiClient = {
  get<T, TMeta = null>(path: string) {
    return request<T, TMeta>(path, { method: "GET" });
  },
  post<T, TMeta = null>(path: string, body?: unknown) {
    return request<T, TMeta>(path, { method: "POST", body });
  },
  patch<T, TMeta = null>(path: string, body: unknown) {
    return request<T, TMeta>(path, { method: "PATCH", body });
  },
  delete<T, TMeta = null>(path: string) {
    return request<T, TMeta>(path, { method: "DELETE" });
  },
  refreshAccessToken,
  setAuthenticationFailureHandler(handler: (() => void) | null) {
    authenticationFailureHandler = handler;
  },
};
