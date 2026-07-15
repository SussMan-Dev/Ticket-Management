import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "../../components/ui/button";
import { MutationError } from "../../components/ui/data-state";
import { FormField } from "../../components/ui/form-field";
import { useAuth } from "../../lib/auth/use-auth";
import { loginSchema, type LoginValues } from "./auth.schemas";

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [serverError, setServerError] = useState<unknown>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginValues>({ resolver: zodResolver(loginSchema), defaultValues: { email: "", password: "" } });

  const submit = handleSubmit(async (values) => {
    setServerError(null);
    try {
      await login({ email: values.email.toLowerCase(), password: values.password });
      const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ?? "/";
      void navigate(from, { replace: true });
    } catch (error) { setServerError(error); }
  });

  return <div className="auth-card"><span className="eyebrow">Chào mừng trở lại</span><h2>Đăng nhập</h2><p className="muted">Dùng tài khoản ElectronicFixer của bạn để tiếp tục.</p>{(location.state as { registered?: boolean } | null)?.registered ? <div className="alert alert--success">Đăng ký thành công. Bạn có thể đăng nhập ngay.</div> : null}<MutationError error={serverError} /><form onSubmit={(event) => void submit(event)} noValidate><FormField label="Email" htmlFor="email" required error={errors.email?.message}><input id="email" type="email" autoComplete="email" autoFocus {...register("email")} aria-invalid={!!errors.email} /></FormField><FormField label="Mật khẩu" htmlFor="password" required error={errors.password?.message}><input id="password" type="password" autoComplete="current-password" {...register("password")} aria-invalid={!!errors.password} /></FormField><Button type="submit" loading={isSubmitting} className="button--full">Đăng nhập an toàn</Button></form><p className="auth-switch">Chưa có tài khoản? <Link to="/register">Đăng ký khách hàng</Link></p></div>;
}
