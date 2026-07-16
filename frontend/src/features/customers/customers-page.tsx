import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link } from "react-router-dom";
import { z } from "zod";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { EmptyState, ErrorState, LoadingState, MutationError } from "../../components/ui/data-state";
import { FormField } from "../../components/ui/form-field";
import { PageHeader } from "../../components/ui/page-header";
import { Pagination } from "../../components/ui/pagination";
import { StatusBadge } from "../../components/ui/status-badge";
import { formatDateTime } from "../../lib/formatting/formatters";
import { passwordSchema } from "../auth/auth.schemas";
import { useCreateCustomer, useCustomers } from "./customers.api";

const schema = z.object({
  fullName: z.string().trim().min(2).max(150),
  email: z.string().trim().email("Email không hợp lệ").max(191),
  phone: z.union([z.string().regex(/^\+?[0-9]{8,15}$/, "Số điện thoại không hợp lệ"), z.literal("")]),
  password: passwordSchema,
  address: z.string().trim().max(500).optional(),
  notes: z.string().trim().max(5000).optional(),
});
type Values = z.infer<typeof schema>;

export function CustomersPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const customers = useCustomers({ page, limit: 20, search: search || undefined, sortBy: "createdAt", sortOrder: "desc" });
  return <><PageHeader eyebrow="Tiếp nhận" title="Khách hàng" description="Tra cứu thông tin liên hệ, thiết bị và tạo yêu cầu sửa chữa cho khách hàng." actions={<Button onClick={() => setShowCreate((value) => !value)}>{showCreate ? "Đóng biểu mẫu" : "+ Tạo khách hàng"}</Button>} />{showCreate ? <CreateCustomerForm onDone={() => setShowCreate(false)} /> : null}<Card><div className="toolbar"><label className="search-field"><span className="sr-only">Tìm khách hàng</span><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Tên, email hoặc số điện thoại…" /></label></div>{customers.isLoading ? <LoadingState /> : customers.isError ? <ErrorState error={customers.error} retry={() => void customers.refetch()} /> : (customers.data?.data ?? []).length === 0 ? <EmptyState title="Chưa tìm thấy khách hàng" description="Kiểm tra từ khóa hoặc tạo hồ sơ mới." /> : <div className="table-wrap"><table><thead><tr><th>Khách hàng</th><th>Liên hệ</th><th>Trạng thái</th><th>Ngày tạo</th><th><span className="sr-only">Tác vụ</span></th></tr></thead><tbody>{(customers.data?.data ?? []).map((customer) => <tr key={customer.id}><td><strong>{customer.fullName}</strong><small>Hồ sơ khách hàng</small></td><td>{customer.email}<small>{customer.phone ?? "Chưa có số điện thoại"}</small></td><td><StatusBadge value={customer.status} /></td><td>{formatDateTime(customer.createdAt)}</td><td><Link to={`/customers/${customer.id}`}>Xem hồ sơ →</Link></td></tr>)}</tbody></table></div>}<Pagination page={page} totalPages={customers.data?.meta.totalPages ?? 1} onChange={setPage} /></Card></>;
}

function CreateCustomerForm({ onDone }: { onDone(): void }) {
  const create = useCreateCustomer();
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { fullName: "", email: "", phone: "", password: "", address: "", notes: "" } });
  const submit = form.handleSubmit(async (values) => { await create.mutateAsync({ ...values, email: values.email.toLowerCase(), phone: values.phone || undefined, address: values.address || undefined, notes: values.notes || undefined }); onDone(); });
  return <Card className="form-card"><h2>Tạo hồ sơ khách hàng</h2><p className="muted">Hệ thống sẽ tạo tài khoản để khách hàng có thể đăng nhập và theo dõi quá trình sửa chữa.</p><MutationError error={create.error} /><form onSubmit={(event) => void submit(event)}><div className="form-grid"><FormField label="Họ và tên" htmlFor="customer-name" required error={form.formState.errors.fullName?.message}><input id="customer-name" autoFocus {...form.register("fullName")} /></FormField><FormField label="Số điện thoại" htmlFor="customer-phone" error={form.formState.errors.phone?.message}><input id="customer-phone" {...form.register("phone")} /></FormField><FormField label="Email" htmlFor="customer-email" required error={form.formState.errors.email?.message}><input id="customer-email" type="email" {...form.register("email")} /></FormField><FormField label="Mật khẩu ban đầu" htmlFor="customer-password" required error={form.formState.errors.password?.message}><input id="customer-password" type="password" {...form.register("password")} /></FormField></div><FormField label="Địa chỉ" htmlFor="customer-address" error={form.formState.errors.address?.message}><textarea id="customer-address" rows={2} {...form.register("address")} /></FormField><FormField label="Ghi chú nội bộ" htmlFor="customer-notes" error={form.formState.errors.notes?.message} hint="Chỉ lễ tân và quản lý được xem."><textarea id="customer-notes" rows={2} {...form.register("notes")} /></FormField><Button type="submit" loading={create.isPending}>Tạo khách hàng</Button></form></Card>;
}
