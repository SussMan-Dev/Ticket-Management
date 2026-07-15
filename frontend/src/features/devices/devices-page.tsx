import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useSearchParams } from "react-router-dom";
import { z } from "zod";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { ConfirmDialog } from "../../components/ui/confirm-dialog";
import { EmptyState, ErrorState, LoadingState, MutationError } from "../../components/ui/data-state";
import { FormField } from "../../components/ui/form-field";
import { PageHeader } from "../../components/ui/page-header";
import { Pagination } from "../../components/ui/pagination";
import { useAuth } from "../../lib/auth/use-auth";
import { useCustomers } from "../customers/customers.api";
import { useCreateDevice, useDeleteDevice, useDeviceCatalogs, useDevices } from "./devices.api";

const schema = z.object({
  customerId: z.number().int().positive().optional(),
  categoryId: z.number().int().positive("Vui lòng chọn loại thiết bị"),
  brandId: z.union([z.number().int().positive(), z.literal("")]).optional(),
  model: z.string().trim().max(150).optional(), serialNumber: z.string().trim().max(191).optional(),
  imei: z.union([z.string().regex(/^[0-9]{14,16}$/, "IMEI gồm 14–16 chữ số"), z.literal("")]).optional(),
  color: z.string().trim().max(50).optional(), description: z.string().trim().max(5000).optional(),
});
type Values = z.infer<typeof schema>;

export function DevicesPage() {
  const { user } = useAuth();
  const [params] = useSearchParams();
  const initialCustomerId = Number(params.get("customerId")) || undefined;
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const devices = useDevices({ page, limit: 20, customerId: user?.role === "CUSTOMER" ? undefined : initialCustomerId, sortBy: "createdAt", sortOrder: "desc" });
  const remove = useDeleteDevice();
  return <><PageHeader eyebrow="Thiết bị" title={user?.role === "CUSTOMER" ? "Thiết bị của tôi" : "Danh mục thiết bị khách hàng"} description="Serial/IMEI chỉ là thông tin nhận dạng; quyền truy cập luôn do backend kiểm tra." actions={<Button onClick={() => setShowCreate((value) => !value)}>{showCreate ? "Đóng biểu mẫu" : "+ Thêm thiết bị"}</Button>} />{showCreate ? <CreateDeviceForm initialCustomerId={initialCustomerId} onDone={() => setShowCreate(false)} /> : null}<Card>{devices.isLoading ? <LoadingState /> : devices.isError ? <ErrorState error={devices.error} retry={() => void devices.refetch()} /> : (devices.data?.data ?? []).length === 0 ? <EmptyState title="Chưa có thiết bị" description="Thêm thiết bị để bắt đầu tạo phiếu sửa chữa." /> : <div className="device-grid">{(devices.data?.data ?? []).map((device) => <article className="device-card" key={device.id}><div className="device-card__icon" aria-hidden="true">▣</div><div><span className="eyebrow">{device.category.name}</span><h2>{device.brand?.name ? `${device.brand.name} ` : ""}{device.model ?? "Chưa rõ model"}</h2><dl><div><dt>Serial</dt><dd>{device.serialNumber ?? "—"}</dd></div><div><dt>IMEI</dt><dd>{device.imei ?? "—"}</dd></div><div><dt>Chủ sở hữu</dt><dd>{device.customer.fullName}</dd></div></dl></div><Button variant="ghost" size="sm" onClick={() => setDeleteId(device.id)}>Xóa mềm</Button></article>)}</div>}<Pagination page={page} totalPages={devices.data?.meta.totalPages ?? 1} onChange={setPage} /><MutationError error={remove.error} /></Card><ConfirmDialog open={deleteId !== null} title="Xóa thiết bị?" description="Thiết bị sẽ được xóa mềm. Lịch sử phiếu sửa chữa liên quan vẫn được giữ nguyên." confirmLabel="Xóa thiết bị" danger loading={remove.isPending} onClose={() => setDeleteId(null)} onConfirm={() => { if (deleteId) remove.mutate(deleteId, { onSuccess: () => setDeleteId(null) }); }} /></>;
}

function CreateDeviceForm({ initialCustomerId, onDone }: { initialCustomerId?: number; onDone(): void }) {
  const { user } = useAuth();
  const isCustomer = user?.role === "CUSTOMER";
  const catalogs = useDeviceCatalogs();
  const customers = useCustomers({ page: 1, limit: 100, sortBy: "fullName", sortOrder: "asc" }, !isCustomer);
  const create = useCreateDevice();
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { customerId: initialCustomerId, categoryId: 0, brandId: "", model: "", serialNumber: "", imei: "", color: "", description: "" } });
  useEffect(() => { if (initialCustomerId) form.setValue("customerId", initialCustomerId); }, [form, initialCustomerId]);
  const submit = form.handleSubmit(async (values) => { await create.mutateAsync({ customerId: isCustomer ? undefined : values.customerId, categoryId: values.categoryId, brandId: values.brandId === "" ? null : values.brandId, model: values.model || null, serialNumber: values.serialNumber || null, imei: values.imei || null, color: values.color || null, description: values.description || null }); onDone(); });
  return <Card className="form-card"><h2>Thêm thiết bị</h2><MutationError error={create.error} />{catalogs.isLoading ? <LoadingState rows={2} /> : <form onSubmit={(event) => void submit(event)}>{!isCustomer ? <FormField label="Khách hàng" htmlFor="device-customer" required error={form.formState.errors.customerId?.message}><select id="device-customer" {...form.register("customerId", { valueAsNumber: true })}><option value="">Chọn khách hàng</option>{customers.data?.data.map((customer) => <option key={customer.id} value={customer.id}>{customer.fullName} · {customer.email}</option>)}</select></FormField> : null}<div className="form-grid"><FormField label="Loại thiết bị" htmlFor="device-category" required error={form.formState.errors.categoryId?.message}><select id="device-category" {...form.register("categoryId", { valueAsNumber: true })}><option value={0}>Chọn loại</option>{catalogs.data?.categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></FormField><FormField label="Thương hiệu" htmlFor="device-brand" error={form.formState.errors.brandId?.message}><select id="device-brand" {...form.register("brandId", { setValueAs: (value: string) => value === "" ? "" : Number(value) })}><option value="">Không xác định</option>{catalogs.data?.brands.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></FormField><FormField label="Model" htmlFor="device-model" error={form.formState.errors.model?.message}><input id="device-model" {...form.register("model")} /></FormField><FormField label="Màu sắc" htmlFor="device-color" error={form.formState.errors.color?.message}><input id="device-color" {...form.register("color")} /></FormField><FormField label="Serial" htmlFor="device-serial" error={form.formState.errors.serialNumber?.message}><input id="device-serial" {...form.register("serialNumber")} /></FormField><FormField label="IMEI" htmlFor="device-imei" error={form.formState.errors.imei?.message}><input id="device-imei" inputMode="numeric" {...form.register("imei")} /></FormField></div><FormField label="Mô tả" htmlFor="device-description" error={form.formState.errors.description?.message}><textarea id="device-description" rows={2} {...form.register("description")} /></FormField><Button type="submit" loading={create.isPending}>Lưu thiết bị</Button></form>}</Card>;
}
