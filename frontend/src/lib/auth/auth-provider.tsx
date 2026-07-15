import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState, type PropsWithChildren } from "react";
import { authApi, type LoginInput } from "../../features/auth/auth.api";
import { apiClient } from "../api/client";
import { tokenStore } from "../api/token-store";
import type { SafeUser } from "../../types/domain";
import { AuthContext, type AuthStatus } from "./auth-context";

export function AuthProvider({ children }: PropsWithChildren) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<SafeUser | null>(null);

  const clearSession = useCallback(() => {
    tokenStore.clear();
    setUser(null);
    setStatus("anonymous");
    queryClient.clear();
  }, [queryClient]);

  useEffect(() => {
    apiClient.setAuthenticationFailureHandler(clearSession);
    let active = true;
    void authApi.restore()
      .then((restoredUser) => {
        if (!active) return;
        setUser(restoredUser);
        setStatus("authenticated");
      })
      .catch(() => {
        if (active) clearSession();
      });
    return () => {
      active = false;
      apiClient.setAuthenticationFailureHandler(null);
    };
  }, [clearSession]);

  const login = useCallback(async (input: LoginInput) => {
    const authentication = await authApi.login(input);
    setUser(authentication.user);
    setStatus("authenticated");
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      clearSession();
    }
  }, [clearSession]);

  const updateCurrentUser = useCallback((updatedUser: SafeUser) => {
    setUser(updatedUser);
  }, []);

  const value = useMemo(
    () => ({ status, user, login, logout, updateCurrentUser }),
    [login, logout, status, updateCurrentUser, user],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
