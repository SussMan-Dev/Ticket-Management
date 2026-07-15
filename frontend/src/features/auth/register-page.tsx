import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "../../components/ui/button";
import { MutationError } from "../../components/ui/data-state";
import { FormField } from "../../components/ui/form-field";
import { authApi } from "./auth.api";
import { registerSchema, type RegisterValues } from "./auth.schemas";

export function RegisterPage() {
  const navigate = useNavigate();
  const [serverError, setServerError] = useState<unknown>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<RegisterValues>({ resolver: zodResolver(registerSchema), defaultValues: { fullName: "", email: "", phone: "", password: "", address: "" } });
  const submit = handleSubmit(async (values) => {
    setServerError(null);
    try {
      await authApi.register({ ...values, email: values.email.toLowerCase(), phone: values.phone || undefined, address: values.address || undefined });
      void navigate("/login", { replace: true, state: { registered: true } });
    } catch (error) { setServerError(error); }
  });
  return <div className="auth-card auth-card--wide"><span className="eyebrow">Tạo hồ sơ dịch vụ</span><h2>Đăng ký khách hàng</h2><p className="muted">Thông tin này giúp cửa hàng xác nhận và cập nhật tiến độ sửa chữa.</p><MutationError error={serverError} /><form onSubmit={(event) => void submit(event)} noValidate><div className="form-grid"><FormField label="Họ và tên" htmlFor="fullName" required error={errors.fullName?.message}><input id="fullName" autoComplete="name" autoFocus {...register("fullName")} /></FormField><FormField label="Số điện thoại" htmlFor="phone" error={errors.phone?.message}><input id="phone" inputMode="tel" autoComplete="tel" {...register("phone")} /></FormField></div><FormField label="Email" htmlFor="email" required error={errors.email?.message}><input id="email" type="email" autoComplete="email" {...register("email")} /></FormField><FormField label="Địa chỉ" htmlFor="address" error={errors.address?.message}><textarea id="address" rows={2} {...register("address")} /></FormField><FormField label="Mật khẩu" htmlFor="password" required error={errors.password?.message} hint="Ít nhất 8 ký tự, có chữ hoa, chữ thường và số."><input id="password" type="password" autoComplete="new-password" {...register("password")} /></FormField><Button type="submit" loading={isSubmitting} className="button--full">Tạo tài khoản</Button></form><p className="auth-switch">Đã có tài khoản? <Link to="/login">Đăng nhập</Link></p></div>;
}
