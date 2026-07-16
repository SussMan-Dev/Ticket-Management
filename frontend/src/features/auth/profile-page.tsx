import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { AvatarFilePicker } from "../../components/ui/avatar-file-picker";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { ErrorState, LoadingState, MutationError } from "../../components/ui/data-state";
import { FormField } from "../../components/ui/form-field";
import { PageHeader } from "../../components/ui/page-header";
import { StatusBadge } from "../../components/ui/status-badge";
import { UserAvatar } from "../../components/ui/user-avatar";
import { useAuth } from "../../lib/auth/use-auth";
import type { UserAccountStatus, UserRole } from "../../types/domain";
import { useCustomer, useUpdateCustomer } from "../customers/customers.api";
import { useUpdateUser, useUploadAvatar } from "../users/users.api";

const profileSchema = z.object({
  fullName: z.string().trim().min(2).max(150),
  phone: z.union([
    z.string().regex(/^\+?[0-9]{8,15}$/, "Số điện thoại không hợp lệ"),
    z.literal(""),
  ]),
  address: z.string().max(500).optional(),
});
type ProfileValues = z.infer<typeof profileSchema>;

const roleLabels: Record<UserRole, string> = {
  CUSTOMER: "Khách hàng",
  RECEPTIONIST: "Lễ tân",
  TECHNICIAN: "Kỹ thuật viên",
  MANAGER: "Quản lý",
  ADMIN: "Quản trị viên",
  INVENTORY_STAFF: "Nhân viên kho",
  CASHIER: "Thu ngân",
};

export function ProfilePage() {
  const { user } = useAuth();
  if (!user) return null;
  return user.role === "CUSTOMER" ? <CustomerProfile userId={user.id} /> : <StaffProfile />;
}

function ProfileIdentity({
  fullName,
  email,
  avatarUrl,
  status,
  role,
}: {
  fullName: string;
  email: string;
  avatarUrl: string | null;
  status: UserAccountStatus;
  role: UserRole;
}) {
  return (
    <Card className="profile-card">
      <span className="eyebrow">Thông tin tài khoản</span>
      <div className="profile-summary">
        <UserAvatar fullName={fullName} src={avatarUrl} size="large" />
        <div className="profile-summary__content">
          <strong>{fullName}</strong>
          <span>{email}</span>
          <div className="profile-summary__meta">
            <StatusBadge value={status} />
            <small>{roleLabels[role]}</small>
          </div>
        </div>
      </div>
      <p className="profile-card__note">Ảnh đại diện và thông tin được đồng bộ từ tài khoản hiện tại.</p>
    </Card>
  );
}

function CustomerProfile({ userId }: { userId: number }) {
  const { user, updateCurrentUser } = useAuth();
  const profile = useCustomer(userId);
  const update = useUpdateCustomer(userId);
  const uploadAvatar = useUploadAvatar(userId);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const form = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: { fullName: "", phone: "", address: "" },
  });
  useEffect(() => {
    if (profile.data) {
      form.reset({
        fullName: profile.data.fullName,
        phone: profile.data.phone ?? "",
        address: profile.data.address ?? "",
      });
    }
  }, [form, profile.data]);
  if (profile.isLoading) return <LoadingState />;
  if (profile.isError || !profile.data) {
    return <ErrorState error={profile.error} retry={() => void profile.refetch()} />;
  }
  const submit = form.handleSubmit(async (values) => {
    await update.mutateAsync({
      fullName: values.fullName,
      phone: values.phone || null,
      address: values.address || null,
    });
    let updatedUser = user
      ? { ...user, fullName: values.fullName, phone: values.phone || null }
      : null;
    if (updatedUser) updateCurrentUser(updatedUser);
    if (avatarFile) {
      updatedUser = await uploadAvatar.mutateAsync(avatarFile);
      setAvatarFile(null);
      updateCurrentUser(updatedUser);
    }
  });
  return (
    <>
      <PageHeader eyebrow="Tài khoản" title="Hồ sơ cá nhân" description="Thông tin liên hệ được dùng trong quá trình tiếp nhận và bàn giao." />
      <div className="profile-layout">
        <ProfileIdentity
          fullName={profile.data.fullName}
          email={profile.data.email}
          avatarUrl={profile.data.avatarUrl}
          status={profile.data.status}
          role="CUSTOMER"
        />
        <Card className="form-card profile-form-card">
          <div className="section-heading"><div><h2>Cập nhật thông tin</h2><p>Giữ thông tin chính xác để cửa hàng liên hệ khi cần.</p></div></div>
          <MutationError error={update.error ?? uploadAvatar.error} />
          <form onSubmit={(event) => void submit(event)}>
            <AvatarFilePicker id="customer-avatar" fullName={profile.data.fullName} currentUrl={profile.data.avatarUrl} file={avatarFile} disabled={update.isPending || uploadAvatar.isPending} onChange={setAvatarFile} />
            <FormField label="Họ và tên" htmlFor="fullName" required error={form.formState.errors.fullName?.message}><input id="fullName" autoComplete="name" {...form.register("fullName")} /></FormField>
            <FormField label="Số điện thoại" htmlFor="phone" error={form.formState.errors.phone?.message}><input id="phone" inputMode="tel" autoComplete="tel" {...form.register("phone")} /></FormField>
            <FormField label="Địa chỉ" htmlFor="address" error={form.formState.errors.address?.message}><textarea id="address" rows={3} {...form.register("address")} /></FormField>
            <Button type="submit" loading={update.isPending || uploadAvatar.isPending}>Lưu thay đổi</Button>
          </form>
        </Card>
      </div>
    </>
  );
}

function StaffProfile() {
  const { user, updateCurrentUser } = useAuth();
  const update = useUpdateUser(user?.id ?? 0);
  const uploadAvatar = useUploadAvatar(user?.id ?? 0);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const form = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      fullName: user?.fullName ?? "",
      phone: user?.phone ?? "",
      address: "",
    },
  });
  if (!user) return null;
  const submit = form.handleSubmit(async (values) => {
    let updatedUser = await update.mutateAsync({
      fullName: values.fullName,
      phone: values.phone || null,
    });
    updateCurrentUser(updatedUser);
    if (avatarFile) {
      updatedUser = await uploadAvatar.mutateAsync(avatarFile);
      setAvatarFile(null);
      updateCurrentUser(updatedUser);
    }
  });
  return (
    <>
      <PageHeader eyebrow="Tài khoản" title="Hồ sơ cá nhân" description="Bạn chỉ có thể cập nhật các trường hồ sơ an toàn." />
      <div className="profile-layout">
        <ProfileIdentity
          fullName={user.fullName}
          email={user.email}
          avatarUrl={user.avatarUrl}
          status={user.status}
          role={user.role}
        />
        <Card className="form-card profile-form-card">
          <div className="section-heading"><div><h2>Cập nhật thông tin</h2><p>Email và phân quyền được quản trị riêng.</p></div></div>
          <MutationError error={update.error ?? uploadAvatar.error} />
          <form onSubmit={(event) => void submit(event)}>
            <AvatarFilePicker id="staff-avatar" fullName={user.fullName} currentUrl={user.avatarUrl} file={avatarFile} disabled={update.isPending || uploadAvatar.isPending} onChange={setAvatarFile} />
            <FormField label="Email" htmlFor="email" hint="Email không thể thay đổi tại đây."><input id="email" value={user.email} disabled /></FormField>
            <FormField label="Họ và tên" htmlFor="fullName" required error={form.formState.errors.fullName?.message}><input id="fullName" autoComplete="name" {...form.register("fullName")} /></FormField>
            <FormField label="Số điện thoại" htmlFor="phone" error={form.formState.errors.phone?.message}><input id="phone" inputMode="tel" autoComplete="tel" {...form.register("phone")} /></FormField>
            <Button type="submit" loading={update.isPending || uploadAvatar.isPending}>Lưu hồ sơ</Button>
          </form>
        </Card>
      </div>
    </>
  );
}
