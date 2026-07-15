import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { ErrorState, LoadingState, MutationError } from "../../components/ui/data-state";
import { FormField } from "../../components/ui/form-field";
import { PageHeader } from "../../components/ui/page-header";
import { StatusBadge } from "../../components/ui/status-badge";
import { useAuth } from "../../lib/auth/use-auth";
import { useCustomer, useUpdateCustomer } from "../customers/customers.api";
import { useUpdateUser } from "../users/users.api";

const profileSchema = z.object({ fullName: z.string().trim().min(2).max(150), phone: z.union([z.string().regex(/^\+?[0-9]{8,15}$/, "Số điện thoại không hợp lệ"), z.literal("")]), address: z.string().max(500).optional() });
type ProfileValues = z.infer<typeof profileSchema>;

export function ProfilePage() {
  const { user } = useAuth();
  if (!user) return null;
  return user.role === "CUSTOMER" ? <CustomerProfile userId={user.id} /> : <StaffProfile />;
}

function CustomerProfile({ userId }: { userId: number }) {
  const profile = useCustomer(userId);
  const update = useUpdateCustomer(userId);
  const form = useForm<ProfileValues>({ resolver: zodResolver(profileSchema), defaultValues: { fullName: "", phone: "", address: "" } });
  useEffect(() => { if (profile.data) form.reset({ fullName: profile.data.fullName, phone: profile.data.phone ?? "", address: profile.data.address ?? "" }); }, [form, profile.data]);
  if (profile.isLoading) return <LoadingState />;
  if (profile.isError || !profile.data) return <ErrorState error={profile.error} retry={() => void profile.refetch()} />;
  const submit = form.handleSubmit(async (values) => { await update.mutateAsync({ fullName: values.fullName, phone: values.phone || null, address: values.address || null }); });
  return <><PageHeader eyebrow="Tài khoản" title="Hồ sơ cá nhân" description="Thông tin liên hệ được dùng trong quá trình tiếp nhận và bàn giao." /><div className="detail-grid"><Card><h2>Trạng thái tài khoản</h2><div className="profile-summary"><span className="avatar avatar--large">{profile.data.fullName.slice(0, 2).toUpperCase()}</span><div><strong>{profile.data.fullName}</strong><span>{profile.data.email}</span><StatusBadge value={profile.data.status} /></div></div></Card><Card><h2>Cập nhật thông tin</h2><MutationError error={update.error} /><form onSubmit={(event) => void submit(event)}><FormField label="Họ và tên" htmlFor="fullName" required error={form.formState.errors.fullName?.message}><input id="fullName" {...form.register("fullName")} /></FormField><FormField label="Số điện thoại" htmlFor="phone" error={form.formState.errors.phone?.message}><input id="phone" {...form.register("phone")} /></FormField><FormField label="Địa chỉ" htmlFor="address" error={form.formState.errors.address?.message}><textarea id="address" rows={3} {...form.register("address")} /></FormField><Button type="submit" loading={update.isPending}>Lưu thay đổi</Button></form></Card></div></>;
}

function StaffProfile() {
  const { user } = useAuth();
  const update = useUpdateUser(user?.id ?? 0);
  const form = useForm<ProfileValues>({ resolver: zodResolver(profileSchema), defaultValues: { fullName: user?.fullName ?? "", phone: user?.phone ?? "", address: "" } });
  if (!user) return null;
  const submit = form.handleSubmit(async (values) => { await update.mutateAsync({ fullName: values.fullName, phone: values.phone || null }); });
  return <><PageHeader eyebrow="Tài khoản" title="Hồ sơ cá nhân" description="Bạn chỉ có thể cập nhật các trường hồ sơ an toàn." /><Card className="form-card"><MutationError error={update.error} /><form onSubmit={(event) => void submit(event)}><FormField label="Email" htmlFor="email" hint="Email không thể thay đổi tại đây."><input id="email" value={user.email} disabled /></FormField><FormField label="Họ và tên" htmlFor="fullName" required error={form.formState.errors.fullName?.message}><input id="fullName" {...form.register("fullName")} /></FormField><FormField label="Số điện thoại" htmlFor="phone" error={form.formState.errors.phone?.message}><input id="phone" {...form.register("phone")} /></FormField><Button type="submit" loading={update.isPending}>Lưu hồ sơ</Button></form></Card></>;
}
