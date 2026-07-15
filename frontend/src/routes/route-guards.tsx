import type { PropsWithChildren } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../lib/auth/use-auth";
import type { UserRole } from "../types/domain";

function SessionLoading() {
  return <main className="session-loading" role="status"><div className="brand"><span className="brand__mark">EF</span><strong>ElectronicFixer</strong></div><span className="spinner spinner--large" /><p>Đang khôi phục phiên làm việc…</p></main>;
}

export function ProtectedRoute({ children }: PropsWithChildren) {
  const { status } = useAuth();
  const location = useLocation();
  if (status === "loading") return <SessionLoading />;
  if (status !== "authenticated") return <Navigate to="/login" replace state={{ from: location }} />;
  return children;
}

export function GuestRoute({ children }: PropsWithChildren) {
  const { status } = useAuth();
  if (status === "loading") return <SessionLoading />;
  if (status === "authenticated") return <Navigate to="/" replace />;
  return children;
}

export function RoleRoute({ roles, children }: PropsWithChildren<{ roles: UserRole[] }>) {
  const { user } = useAuth();
  if (!user || !roles.includes(user.role)) return <Navigate to="/forbidden" replace />;
  return children;
}
