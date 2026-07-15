import { createContext } from "react";
import type { LoginInput } from "../../features/auth/auth.api";
import type { SafeUser } from "../../types/domain";

export type AuthStatus = "loading" | "authenticated" | "anonymous";

export interface AuthContextValue {
  status: AuthStatus;
  user: SafeUser | null;
  login(input: LoginInput): Promise<void>;
  logout(): Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);
