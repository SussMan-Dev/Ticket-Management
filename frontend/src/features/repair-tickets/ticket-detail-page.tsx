import { useState } from "react";
import { useForm } from "react-hook-form";
import { useParams } from "react-router-dom";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { ConfirmDialog } from "../../components/ui/confirm-dialog";
import { EmptyState, ErrorState, LoadingState, MutationError } from "../../components/ui/data-state";
import { FormField } from "../../components/ui/form-field";
import { PageHeader } from "../../components/ui/page-header";
import { StatusBadge } from "../../components/ui/status-badge";
import { useAuth } from "../../lib/auth/use-auth";
import { formatDateTime } from "../../lib/formatting/formatters";
import type { RepairTicket, TicketAttachmentType, UserRole } from "../../types/domain";
import { useAssignTicket, useReassignTicket } from "../assignments/assignments.api";
import { DiagnosisPanel } from "../diagnoses/diagnosis-panel";
import { useDiagnoses } from "../diagnoses/diagnoses.api";
import { QuotationPanel } from "../quotations/quotation-panel";
import { useCancelTicket, useChangeTicketStatus, useCreateAttachment, useReceiveTicket, useTicket, useTicketAttachments, useTicketHistory } from "./tickets.api";
import { ticketActionFlags } from "./ticket-action.rules";

export function TicketDetailPage() {
  const id = Number(useParams().ticketId);
  const ticket = useTicket(id);
  const history = useTicketHistory(id);
  const attachments = useTicketAttachments(id);
  const { user } = useAuth();
  if (ticket.isLoading) return <LoadingState />;
  if (ticket.isError || !ticket.data) return <ErrorState error={ticket.error} retry={() => void ticket.refetch()} />;
  const data = ticket.data;
  return <><PageHeader eyebrow={data.ticketCode} title={data.title} description={`${data.device.category} · ${data.device.brand ?? "Không rõ hãng"} ${data.device.model ?? ""}`} actions={<div className="button-row"><StatusBadge value={data.priority} /><StatusBadge value={data.status} /></div>} /><div className="ticket-detail-layout"><div className="ticket-detail-main"><Card><div className="section-heading"><h2>Thông tin tiếp nhận</h2><span>Cập nhật {formatDateTime(data.updatedAt)}</span></div><dl className="detail-list detail-list--two"><div><dt>Khách hàng</dt><dd>{data.customer.fullName}</dd></div><div><dt>Thiết bị</dt><dd>{data.device.brand ?? ""} {data.device.model ?? data.device.category}</dd></div><div><dt>Serial</dt><dd>{data.device.serialNumber ?? "—"}</dd></div><div><dt>Người tạo</dt><dd>{data.createdBy.fullName}</dd></div><div className="span-two"><dt>Vấn đề mô tả</dt><dd>{data.customerIssue}</dd></div><div><dt>Tình trạng ban đầu</dt><dd>{data.initialCondition ?? "—"}</dd></div><div><dt>Phụ kiện nhận kèm</dt><dd>{data.accessoriesReceived ?? "—"}</dd></div><div><dt>Dự kiến chẩn đoán</dt><dd>{formatDateTime(data.expectedDiagnosisAt)}</dd></div><div><dt>Dự kiến hoàn thành</dt><dd>{formatDateTime(data.expectedCompletionAt)}</dd></div></dl></Card>{user && ["CUSTOMER", "TECHNICIAN", "MANAGER"].includes(user.role) ? <TechnicalSections ticket={data} role={user.role} /> : null}<Card><AttachmentSection ticket={data} attachments={attachments.data ?? []} loading={attachments.isLoading} error={attachments.error} /></Card></div><aside className="ticket-detail-side"><TicketActions ticket={data} /><Card><h2>Lịch sử trạng thái</h2>{history.isLoading ? <LoadingState rows={3} /> : history.isError ? <ErrorState error={history.error} retry={() => void history.refetch()} /> : <ol className="timeline">{history.data?.map((item) => <li key={item.id}><i aria-hidden="true" /><div><StatusBadge value={item.toStatus} /><strong>{item.changedBy.fullName}</strong><small>{formatDateTime(item.createdAt)}</small>{item.reason ? <p>{item.reason}</p> : null}</div></li>)}</ol>}</Card></aside></div></>;
}

function TechnicalSections({ ticket, role }: { ticket: RepairTicket; role: UserRole }) {
  const diagnoses = useDiagnoses(ticket.id);
  const approved = diagnoses.data?.find((diagnosis) => diagnosis.status === "APPROVED");
  return <><Card><DiagnosisPanel ticket={ticket} /></Card>{["CUSTOMER", "TECHNICIAN", "MANAGER"].includes(role) ? <Card><QuotationPanel ticket={ticket} approvedDiagnosis={approved} /></Card> : null}</>;
}

function TicketActions({ ticket }: { ticket: RepairTicket }) {
  const { user } = useAuth();
  const receive = useReceiveTicket(ticket.id);
  const cancel = useCancelTicket(ticket.id);
  const changeStatus = useChangeTicketStatus(ticket.id);
  const [reason, setReason] = useState("");
  const [confirmCancel, setConfirmCancel] = useState(false);
  if (!user) return null;
  const { canCancel, canReceive, canAssign, canReassign, holdStatus } = ticketActionFlags(user.role, ticket.status);
  return <Card><h2>Tác vụ theo trạng thái</h2>{canReceive ? <Button className="button--full" loading={receive.isPending} onClick={() => receive.mutate(reason || undefined)}>Tiếp nhận thiết bị</Button> : null}{canAssign || canReassign ? <AssignmentAction ticket={ticket} /> : null}{(canCancel || holdStatus || canReceive) ? <FormField label="Lý do / ghi chú" htmlFor="ticket-action-reason" hint={canCancel || holdStatus ? "Tối thiểu 3 ký tự cho thao tác thay đổi trạng thái." : undefined}><textarea id="ticket-action-reason" rows={3} value={reason} onChange={(event) => setReason(event.target.value)} /></FormField> : null}{holdStatus ? <Button variant="secondary" className="button--full" disabled={reason.trim().length < 3} loading={changeStatus.isPending} onClick={() => changeStatus.mutate({ status: holdStatus, reason })}>{holdStatus === "ON_HOLD" ? "Tạm giữ phiếu" : "Tiếp tục xử lý"}</Button> : null}{canCancel ? <Button variant="danger" className="button--full" disabled={reason.trim().length < 3} onClick={() => setConfirmCancel(true)}>Hủy phiếu</Button> : null}{!canCancel && !holdStatus && !canReceive && !canAssign && !canReassign ? <p className="read-only-note">Không có tác vụ hợp lệ cho role và trạng thái hiện tại.</p> : null}<MutationError error={receive.error ?? cancel.error ?? changeStatus.error} /><ConfirmDialog open={confirmCancel} title="Hủy phiếu sửa chữa?" description="Trạng thái và lý do hủy sẽ được ghi vào lịch sử; thao tác này không xóa dữ liệu." confirmLabel="Xác nhận hủy" danger loading={cancel.isPending} onClose={() => setConfirmCancel(false)} onConfirm={() => cancel.mutate(reason, { onSuccess: () => setConfirmCancel(false) })} /></Card>;
}

function AssignmentAction({ ticket }: { ticket: RepairTicket }) {
  const assign = useAssignTicket(ticket.id);
  const reassign = useReassignTicket(ticket.id);
  const isReassign = ticket.status === "ASSIGNED";
  const { register, handleSubmit, formState: { errors } } = useForm<{ technicianId: number; note: string }>({ defaultValues: { technicianId: 0, note: "" } });
  const submit = handleSubmit(async (values) => {
    if (isReassign) await reassign.mutateAsync({ technicianId: values.technicianId, note: values.note });
    else await assign.mutateAsync({ technicianId: values.technicianId, note: values.note || null });
  });
  return <div className="assignment-box"><div className="alert alert--info">Backend chưa có endpoint tra cứu kỹ thuật viên dành cho Manager. Nhập ID kỹ thuật viên đã xác minh.</div><form onSubmit={(event) => void submit(event)}><FormField label="Technician ID" htmlFor="technician-id" required error={errors.technicianId?.message}><input id="technician-id" type="number" min={1} {...register("technicianId", { valueAsNumber: true, min: { value: 1, message: "ID phải lớn hơn 0" }, required: "Bắt buộc" })} /></FormField><FormField label="Ghi chú phân công" htmlFor="assignment-note" required={isReassign} error={errors.note?.message}><textarea id="assignment-note" rows={2} {...register("note", isReassign ? { required: "Bắt buộc khi phân công lại", minLength: { value: 3, message: "Tối thiểu 3 ký tự" } } : {})} /></FormField><Button className="button--full" type="submit" loading={assign.isPending || reassign.isPending}>{isReassign ? "Phân công lại" : "Phân công kỹ thuật viên"}</Button><MutationError error={assign.error ?? reassign.error} /></form></div>;
}

const attachmentTypesByRole: Partial<Record<UserRole, TicketAttachmentType[]>> = {
  CUSTOMER: ["CUSTOMER_ATTACHMENT"],
  RECEPTIONIST: ["BEFORE_REPAIR", "CUSTOMER_ATTACHMENT"],
  TECHNICIAN: ["DURING_REPAIR", "AFTER_REPAIR"],
  MANAGER: ["BEFORE_REPAIR", "DURING_REPAIR", "AFTER_REPAIR", "CUSTOMER_ATTACHMENT"],
};

function AttachmentSection({ ticket, attachments, loading, error }: { ticket: RepairTicket; attachments: import("../../types/domain").TicketAttachment[]; loading: boolean; error: unknown }) {
  const { user } = useAuth();
  const create = useCreateAttachment(ticket.id);
  const { register, handleSubmit, reset, formState: { errors } } = useForm<{ attachmentType: TicketAttachmentType; fileUrl: string; fileName: string; mimeType: string }>({ defaultValues: { attachmentType: attachmentTypesByRole[user?.role ?? "ADMIN"]?.[0] ?? "CUSTOMER_ATTACHMENT", fileUrl: "", fileName: "", mimeType: "" } });
  const terminal = ["CLOSED", "CANCELLED"].includes(ticket.status);
  const types = user ? attachmentTypesByRole[user.role] ?? [] : [];
  const submit = handleSubmit(async (values) => { await create.mutateAsync({ attachmentType: values.attachmentType, fileUrl: values.fileUrl, fileName: values.fileName || null, mimeType: values.mimeType || null }); reset(); });
  return <section aria-labelledby="attachments-title"><div className="section-heading"><div><h2 id="attachments-title">Tệp đính kèm</h2><p>Backend hiện lưu metadata URL HTTP(S), không upload binary.</p></div></div>{loading ? <LoadingState rows={2} /> : error ? <ErrorState error={error} /> : attachments.length === 0 ? <EmptyState title="Chưa có tệp đính kèm" description="Ảnh và bằng chứng sẽ xuất hiện tại đây." /> : <div className="attachment-grid">{attachments.map((item) => <a href={item.fileUrl} target="_blank" rel="noreferrer" key={item.id}><span aria-hidden="true">↗</span><strong>{item.fileName ?? item.attachmentType}</strong><small>{item.mimeType ?? "Liên kết ngoài"} · {formatDateTime(item.createdAt)}</small></a>)}</div>}{types.length > 0 && !terminal ? <form className="attachment-form" onSubmit={(event) => void submit(event)}><FormField label="Loại" htmlFor="attachment-type" error={errors.attachmentType?.message}><select id="attachment-type" {...register("attachmentType")}>{types.map((type) => <option key={type} value={type}>{type}</option>)}</select></FormField><FormField label="URL tệp" htmlFor="attachment-url" required error={errors.fileUrl?.message}><input id="attachment-url" type="url" placeholder="https://…" {...register("fileUrl", { required: "Bắt buộc", pattern: { value: /^https?:\/\//i, message: "URL phải dùng HTTP(S)" } })} /></FormField><FormField label="Tên tệp" htmlFor="attachment-name" error={errors.fileName?.message}><input id="attachment-name" {...register("fileName")} /></FormField><FormField label="MIME type" htmlFor="attachment-mime" error={errors.mimeType?.message}><input id="attachment-mime" placeholder="image/jpeg" {...register("mimeType")} /></FormField><Button type="submit" loading={create.isPending}>Thêm metadata</Button></form> : null}<MutationError error={create.error} /></section>;
}
