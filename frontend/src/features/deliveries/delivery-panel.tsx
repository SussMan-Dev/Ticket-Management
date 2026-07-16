import { useForm } from "react-hook-form";
import { Button } from "../../components/ui/button";
import { EmptyState, ErrorState, LoadingState, MutationError } from "../../components/ui/data-state";
import { FormField } from "../../components/ui/form-field";
import { formatDateTime } from "../../lib/formatting/formatters";
import type { RepairTicket, UserRole } from "../../types/domain";
import { useCloseDeliveredTicket, useDeliverTicket, useDelivery, type DeliveryInput } from "./deliveries.api";

export function DeliveryPanel({ ticket, role }: { ticket: RepairTicket; role: UserRole }) {
  const delivered = ["DELIVERED", "CLOSED"].includes(ticket.status);
  const delivery = useDelivery(ticket.id, delivered);
  const deliver = useDeliverTicket(ticket.id);
  const close = useCloseDeliveredTicket(ticket.id);
  const canDeliver = role === "RECEPTIONIST"
    ? ["READY_FOR_DELIVERY", "CUSTOMER_REJECTED"].includes(ticket.status)
    : role === "MANAGER" && ["COMPLETED", "READY_FOR_DELIVERY"].includes(ticket.status);
  const { register, handleSubmit, formState: { errors } } = useForm<DeliveryInput>({
    defaultValues: { recipientName: ticket.customer.fullName, recipientPhone: "", proofUrl: "", note: "", paymentExceptionReason: "" },
  });
  const submit = handleSubmit(async (values) => deliver.mutateAsync({
    ...values,
    recipientPhone: values.recipientPhone || null,
    proofUrl: values.proofUrl || null,
    note: values.note || null,
    paymentExceptionReason: values.paymentExceptionReason || null,
  }));

  return <section aria-labelledby="delivery-title"><div className="section-heading"><div><h2 id="delivery-title">Bàn giao thiết bị</h2><p>Ghi nhận người nhận và bằng chứng bàn giao; trạng thái phiếu được cập nhật tự động.</p></div></div>{delivered ? delivery.isLoading ? <LoadingState rows={2} /> : delivery.isError ? <ErrorState error={delivery.error} retry={() => void delivery.refetch()} /> : delivery.data ? <><dl className="detail-list detail-list--two"><div><dt>Người nhận</dt><dd>{delivery.data.recipientName}</dd></div><div><dt>Thời gian</dt><dd>{formatDateTime(delivery.data.deliveredAt)}</dd></div><div><dt>Số điện thoại</dt><dd>{delivery.data.recipientPhone ?? "—"}</dd></div><div><dt>Nhân viên bàn giao</dt><dd>{delivery.data.deliveredBy.fullName}</dd></div><div className="span-two"><dt>Ghi chú</dt><dd>{delivery.data.note ?? "—"}</dd></div>{delivery.data.proofUrl ? <div className="span-two"><dt>Bằng chứng</dt><dd><a className="text-link" href={delivery.data.proofUrl} target="_blank" rel="noreferrer">Mở bằng chứng ↗</a></dd></div> : null}</dl>{ticket.status === "DELIVERED" && ["RECEPTIONIST", "MANAGER"].includes(role) ? <div className="form-actions"><Button variant="secondary" loading={close.isPending} onClick={() => close.mutate(undefined)}>Đóng phiếu sau bàn giao</Button></div> : null}</> : null : canDeliver ? <form className="form-grid form-grid--two" onSubmit={(event) => void submit(event)}><FormField label="Người nhận" htmlFor="recipient-name" required error={errors.recipientName?.message}><input id="recipient-name" {...register("recipientName", { required: "Bắt buộc", minLength: { value: 2, message: "Tối thiểu 2 ký tự" } })} /></FormField><FormField label="Số điện thoại" htmlFor="recipient-phone" error={errors.recipientPhone?.message}><input id="recipient-phone" {...register("recipientPhone")} /></FormField><FormField label="Đường dẫn ảnh bàn giao" htmlFor="proof-url" error={errors.proofUrl?.message}><input id="proof-url" type="url" placeholder="https://…" {...register("proofUrl", { pattern: { value: /^https?:\/\//i, message: "Đường dẫn phải bắt đầu bằng http:// hoặc https://" } })} /></FormField>{role === "MANAGER" ? <FormField label="Lý do ngoại lệ thanh toán" htmlFor="payment-exception" required error={errors.paymentExceptionReason?.message}><textarea id="payment-exception" rows={2} {...register("paymentExceptionReason", { required: "Bắt buộc khi quản lý thực hiện bàn giao ngoại lệ", minLength: { value: 5, message: "Tối thiểu 5 ký tự" } })} /></FormField> : null}<div className="span-two"><FormField label="Ghi chú bàn giao" htmlFor="delivery-note"><textarea id="delivery-note" rows={3} {...register("note")} /></FormField></div><div className="span-two"><Button type="submit" loading={deliver.isPending}>{role === "MANAGER" ? "Bàn giao theo ngoại lệ" : ticket.status === "CUSTOMER_REJECTED" ? "Trả thiết bị cho khách" : "Xác nhận bàn giao"}</Button></div></form> : <EmptyState title="Chưa đến bước bàn giao" description="Sau khi sửa xong và thanh toán đủ, lễ tân sẽ xác nhận bàn giao. Quản lý chỉ thực hiện bàn giao ngoại lệ khi có lý do rõ ràng." />}<MutationError error={deliver.error ?? close.error} /></section>;
}
