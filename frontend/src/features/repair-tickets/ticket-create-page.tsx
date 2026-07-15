import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { LoadingState, MutationError } from "../../components/ui/data-state";
import { FormField } from "../../components/ui/form-field";
import { PageHeader } from "../../components/ui/page-header";
import { useAuth } from "../../lib/auth/use-auth";
import { useCustomers } from "../customers/customers.api";
import { useDevices } from "../devices/devices.api";
import { ticketSchema, type TicketValues } from "./ticket.schemas";
import { useCreateTicket } from "./tickets.api";

export function TicketCreatePage() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const isCustomer = user?.role === "CUSTOMER";
  const isReceptionist = user?.role === "RECEPTIONIST";
  const initialCustomerId = Number(searchParams.get("customerId")) || undefined;
  const form = useForm<TicketValues>({ resolver: zodResolver(ticketSchema), defaultValues: { customerId: initialCustomerId, deviceId: 0, title: "", customerIssue: "", repairAddress: "", initialCondition: "", accessoriesReceived: "", priority: "NORMAL", expectedDiagnosisAt: "", expectedCompletionAt: "", receiveNow: false } });
  const selectedCustomerId = form.watch("customerId");
  const customers = useCustomers({ page: 1, limit: 100, sortBy: "fullName", sortOrder: "asc" }, !isCustomer);
  const devices = useDevices({ page: 1, limit: 100, customerId: isCustomer ? undefined : selectedCustomerId, sortBy: "createdAt", sortOrder: "desc" }, isCustomer || !!selectedCustomerId);
  const create = useCreateTicket();
  useEffect(() => { form.setValue("deviceId", 0); }, [form, selectedCustomerId]);
  const submit = form.handleSubmit(async (values) => {
    const ticket = await create.mutateAsync({
      customerId: isCustomer ? undefined : values.customerId,
      deviceId: values.deviceId,
      title: values.title,
      customerIssue: values.customerIssue,
      repairAddress: values.repairAddress,
      initialCondition: values.initialCondition || null,
      accessoriesReceived: values.accessoriesReceived || null,
      priority: isCustomer ? "NORMAL" : values.priority,
      expectedDiagnosisAt: !isCustomer && values.expectedDiagnosisAt ? new Date(values.expectedDiagnosisAt).toISOString() : undefined,
      expectedCompletionAt: !isCustomer && values.expectedCompletionAt ? new Date(values.expectedCompletionAt).toISOString() : undefined,
      receiveNow: isReceptionist ? values.receiveNow : false,
    });
    void navigate(`/tickets/${ticket.id}`, { replace: true });
  });
  return <><PageHeader eyebrow="Phiếu sửa chữa mới" title="Ghi nhận yêu cầu sửa chữa" description="Thông tin khách hàng và thiết bị được backend xác minh trước khi tạo phiếu." /><Card className="form-card form-card--large"><MutationError error={create.error} /><form onSubmit={(event) => void submit(event)}>{!isCustomer ? <FormField label="Khách hàng" htmlFor="ticket-customer" required error={form.formState.errors.customerId?.message}><select id="ticket-customer" autoFocus {...form.register("customerId", { valueAsNumber: true })}><option value="">Chọn khách hàng</option>{customers.data?.data.map((customer) => <option value={customer.id} key={customer.id}>{customer.fullName} · {customer.phone ?? customer.email}</option>)}</select></FormField> : null}{devices.isLoading ? <LoadingState rows={1} /> : <FormField label="Thiết bị" htmlFor="ticket-device" required error={form.formState.errors.deviceId?.message} hint={!isCustomer && !selectedCustomerId ? "Chọn khách hàng trước." : undefined}><select id="ticket-device" disabled={!isCustomer && !selectedCustomerId} {...form.register("deviceId", { valueAsNumber: true })}><option value={0}>Chọn thiết bị</option>{devices.data?.data.map((device) => <option value={device.id} key={device.id}>{device.category.name} · {device.brand?.name ?? ""} {device.model ?? ""} {device.serialNumber ? `· ${device.serialNumber}` : ""}</option>)}</select></FormField>}<FormField label="Tiêu đề" htmlFor="ticket-title" required error={form.formState.errors.title?.message}><input id="ticket-title" autoFocus={isCustomer} placeholder="Ví dụ: Laptop không khởi động" {...form.register("title")} /></FormField><FormField label="Vấn đề khách hàng mô tả" htmlFor="ticket-issue" required error={form.formState.errors.customerIssue?.message}><textarea id="ticket-issue" rows={4} {...form.register("customerIssue")} /></FormField><FormField label="Địa chỉ sửa chữa" htmlFor="ticket-repair-address" required error={form.formState.errors.repairAddress?.message} hint="Địa chỉ này được lưu riêng trên phiếu và có thể khác địa chỉ tài khoản."><textarea id="ticket-repair-address" rows={3} placeholder="Số nhà, đường, phường/xã, quận/huyện, tỉnh/thành" {...form.register("repairAddress")} /></FormField><div className="form-grid"><FormField label="Tình trạng ban đầu" htmlFor="ticket-condition" error={form.formState.errors.initialCondition?.message}><textarea id="ticket-condition" rows={3} {...form.register("initialCondition")} /></FormField><FormField label="Phụ kiện nhận kèm" htmlFor="ticket-accessories" error={form.formState.errors.accessoriesReceived?.message}><textarea id="ticket-accessories" rows={3} {...form.register("accessoriesReceived")} /></FormField></div>{!isCustomer ? <div className="form-grid"><FormField label="Mức ưu tiên" htmlFor="ticket-priority" error={form.formState.errors.priority?.message}><select id="ticket-priority" {...form.register("priority")}><option value="LOW">Thấp</option><option value="NORMAL">Bình thường</option><option value="HIGH">Cao</option><option value="URGENT">Khẩn cấp</option></select></FormField><div /></div> : null}{!isCustomer ? <div className="form-grid"><FormField label="Dự kiến chẩn đoán" htmlFor="expected-diagnosis" error={form.formState.errors.expectedDiagnosisAt?.message}><input id="expected-diagnosis" type="datetime-local" {...form.register("expectedDiagnosisAt")} /></FormField><FormField label="Dự kiến hoàn thành" htmlFor="expected-completion" error={form.formState.errors.expectedCompletionAt?.message}><input id="expected-completion" type="datetime-local" {...form.register("expectedCompletionAt")} /></FormField></div> : null}{isReceptionist ? <label className="check-field"><input type="checkbox" {...form.register("receiveNow")} /><span><strong>Tiếp nhận ngay tại quầy</strong><small>Tạo và chuyển NEW → RECEIVED trong cùng transaction.</small></span></label> : null}<div className="form-actions"><Button type="button" variant="secondary" onClick={() => navigate(-1)}>Hủy</Button><Button type="submit" loading={create.isPending}>Tạo phiếu sửa chữa</Button></div></form></Card></>;
}
