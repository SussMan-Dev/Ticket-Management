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
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      fullName: "",
      email: "",
      phone: "",
      password: "",
      confirmPassword: "",
      address: "",
    },
  });

  const submit = handleSubmit(async (values) => {
    setServerError(null);
    const registration = {
      fullName: values.fullName,
      email: values.email,
      phone: values.phone,
      password: values.password,
      address: values.address,
    };
    try {
      await authApi.register({
        ...registration,
        email: registration.email.toLowerCase(),
        phone: registration.phone || undefined,
        address: registration.address || undefined,
      });
      void navigate("/login", { replace: true, state: { registered: true } });
    } catch (error) {
      setServerError(error);
    }
  });

  return (
    <div className="auth-card auth-card--wide register-card">
      <div className="auth-card__heading">
        <span className="eyebrow">Tạo hồ sơ dịch vụ</span>
        <h2>Đăng ký khách hàng</h2>
        <p className="muted">Tạo tài khoản để quản lý thiết bị và theo dõi tiến độ sửa chữa ở một nơi.</p>
      </div>
      <MutationError error={serverError} />
      <form onSubmit={(event) => void submit(event)} noValidate>
        <div className="auth-form-section">
          <div className="auth-form-section__title"><span>1</span><strong>Thông tin liên hệ</strong></div>
          <div className="form-grid">
            <FormField label="Họ và tên" htmlFor="fullName" required error={errors.fullName?.message}>
              <input id="fullName" autoComplete="name" autoFocus aria-invalid={!!errors.fullName} {...register("fullName")} />
            </FormField>
            <FormField label="Số điện thoại" htmlFor="phone" error={errors.phone?.message}>
              <input id="phone" inputMode="tel" autoComplete="tel" placeholder="Ví dụ: 0912345678" aria-invalid={!!errors.phone} {...register("phone")} />
            </FormField>
          </div>
          <FormField label="Email" htmlFor="email" required error={errors.email?.message}>
            <input id="email" type="email" autoComplete="email" placeholder="ban@example.com" aria-invalid={!!errors.email} {...register("email")} />
          </FormField>
          <FormField label="Địa chỉ" htmlFor="address" error={errors.address?.message}>
            <textarea id="address" rows={2} placeholder="Địa chỉ nhận và bàn giao thiết bị" aria-invalid={!!errors.address} {...register("address")} />
          </FormField>
        </div>

        <div className="auth-form-section">
          <div className="auth-form-section__title"><span>2</span><strong>Bảo mật tài khoản</strong></div>
          <div className="password-requirements">Mật khẩu cần ít nhất 8 ký tự, gồm chữ hoa, chữ thường và chữ số.</div>
          <div className="form-grid">
            <FormField label="Mật khẩu" htmlFor="password" required error={errors.password?.message}>
              <input id="password" type="password" autoComplete="new-password" aria-invalid={!!errors.password} {...register("password")} />
            </FormField>
            <FormField label="Xác nhận mật khẩu" htmlFor="confirmPassword" required error={errors.confirmPassword?.message}>
              <input id="confirmPassword" type="password" autoComplete="new-password" aria-invalid={!!errors.confirmPassword} {...register("confirmPassword")} />
            </FormField>
          </div>
        </div>
        <Button type="submit" loading={isSubmitting} className="button--full">Tạo tài khoản</Button>
      </form>
      <p className="auth-switch">Đã có tài khoản? <Link to="/login">Đăng nhập</Link></p>
    </div>
  );
}
