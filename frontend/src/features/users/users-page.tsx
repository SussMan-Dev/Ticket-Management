import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { EmptyState, ErrorState, LoadingState, MutationError } from "../../components/ui/data-state";
import { FormField } from "../../components/ui/form-field";
import { PageHeader } from "../../components/ui/page-header";
import { Pagination } from "../../components/ui/pagination";
import { StatusBadge } from "../../components/ui/status-badge";
import { formatDateTime } from "../../lib/formatting/formatters";
import type { StaffRole, UserAccountStatus, UserRole } from "../../types/domain";
import { passwordSchema } from "../auth/auth.schemas";
import { useCreateStaff, useUpdateUserRole, useUpdateUserStatus, useUsers } from "./users.api";

const staffRoles: StaffRole[] = ["RECEPTIONIST", "TECHNICIAN", "MANAGER", "ADMIN", "INVENTORY_STAFF", "CASHIER"];
const roleLabels: Record<string, string> = { CUSTOMER: "Khách hàng", RECEPTIONIST: "Lễ tân", TECHNICIAN: "Kỹ thuật viên", MANAGER: "Quản lý", ADMIN: "Quản trị viên", INVENTORY_STAFF: "Kho", CASHIER: "Thu ngân" };
const schema = z.object({ fullName: z.string().trim().min(2).max(150), email: z.string().email().max(191), phone: z.union([z.string().regex(/^\+?[0-9]{8,15}$/), z.literal("")]), password: passwordSchema, role: z.enum(staffRoles) });
type Values = z.infer<typeof schema>;

export function UsersPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const users = useUsers({ page, limit: 20, search: search || undefined, sortBy: "createdAt", sortOrder: "desc" });
  const statusMutation = useUpdateUserStatus();
  const roleMutation = useUpdateUserRole();
  return <><PageHeader eyebrow="Quản trị" title="Tài khoản người dùng" description="Tạo nhân viên và kiểm soát role/status. Thay đổi nhạy cảm sẽ do backend audit và thu hồi session." actions={<Button onClick={() => setShowCreate((value) => !value)}>{showCreate ? "Đóng biểu mẫu" : "+ Tạo nhân viên"}</Button>} />{showCreate ? <CreateStaffForm onDone={() => setShowCreate(false)} /> : null}<Card><div className="toolbar"><label className="search-field"><span className="sr-only">Tìm người dùng</span><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Tìm theo tên hoặc email…" /></label></div>{users.isLoading ? <LoadingState /> : users.isError ? <ErrorState error={users.error} retry={() => void users.refetch()} /> : (users.data?.data ?? []).length === 0 ? <EmptyState title="Không có tài khoản" description="Thử thay đổi từ khóa tìm kiếm." /> : <div className="table-wrap"><table><thead><tr><th>Người dùng</th><th>Vai trò</th><th>Trạng thái</th><th>Đăng nhập cuối</th></tr></thead><tbody>{(users.data?.data ?? []).map((user) => <tr key={user.id}><td><strong>{user.fullName}</strong><small>{user.email}</small></td><td><select aria-label={`Vai trò của ${user.fullName}`} value={user.role} disabled={roleMutation.isPending} onChange={(event) => roleMutation.mutate({ id: user.id, role: event.target.value as UserRole })}><option value="CUSTOMER">Khách hàng</option>{staffRoles.map((role) => <option value={role} key={role}>{roleLabels[role]}</option>)}</select></td><td><div className="inline-status"><StatusBadge value={user.status} /><select aria-label={`Trạng thái của ${user.fullName}`} value={user.status} disabled={statusMutation.isPending} onChange={(event) => statusMutation.mutate({ id: user.id, status: event.target.value as UserAccountStatus })}><option value="ACTIVE">Hoạt động</option><option value="INACTIVE">Tạm ngưng</option><option value="LOCKED">Khóa</option></select></div></td><td>{formatDateTime(user.lastLoginAt)}</td></tr>)}</tbody></table></div>}<Pagination page={page} totalPages={users.data?.meta.totalPages ?? 1} onChange={setPage} /><MutationError error={statusMutation.error ?? roleMutation.error} /></Card></>;
}

function CreateStaffForm({ onDone }: { onDone(): void }) {
  const create = useCreateStaff();
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { fullName: "", email: "", phone: "", password: "", role: "RECEPTIONIST" } });
  const submit = form.handleSubmit(async (values) => { await create.mutateAsync({ ...values, phone: values.phone || undefined }); form.reset(); onDone(); });
  return <Card className="form-card"><h2>Tạo tài khoản nhân viên</h2><MutationError error={create.error} /><form onSubmit={(event) => void submit(event)}><div className="form-grid"><FormField label="Họ và tên" htmlFor="staff-name" required error={form.formState.errors.fullName?.message}><input id="staff-name" {...form.register("fullName")} /></FormField><FormField label="Email" htmlFor="staff-email" required error={form.formState.errors.email?.message}><input id="staff-email" type="email" {...form.register("email")} /></FormField><FormField label="Số điện thoại" htmlFor="staff-phone" error={form.formState.errors.phone?.message}><input id="staff-phone" {...form.register("phone")} /></FormField><FormField label="Vai trò" htmlFor="staff-role" required error={form.formState.errors.role?.message}><select id="staff-role" {...form.register("role")}>{staffRoles.map((role) => <option key={role} value={role}>{roleLabels[role]}</option>)}</select></FormField></div><FormField label="Mật khẩu ban đầu" htmlFor="staff-password" required error={form.formState.errors.password?.message}><input id="staff-password" type="password" {...form.register("password")} /></FormField><Button type="submit" loading={create.isPending}>Tạo nhân viên</Button></form></Card>;
}
