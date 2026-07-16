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
import { useAssignableTechnicians, useAssignTicket, useReassignTicket } from "../assignments/assignments.api";
import { DiagnosisPanel } from "../diagnoses/diagnosis-panel";
import { useDiagnoses } from "../diagnoses/diagnoses.api";
import { DeliveryPanel } from "../deliveries/delivery-panel";
import { PartRequestPanel } from "../inventory/part-request-panel";
import { QuotationPanel } from "../quotations/quotation-panel";
import { RepairActionPanel } from "../repair-actions/repair-action-panel";
import { useTicketTimeline } from "../repair-actions/repair-actions.api";
import { ReviewPanel } from "../reviews/review-panel";
import { TicketImagePicker } from "./ticket-image-picker";
import { useCancelTicket, useChangeTicketStatus, useReceiveTicket, useTicket, useTicketAttachments, useUpdateTicket, useUploadTicketAttachment } from "./tickets.api";
import { ticketActionFlags } from "./ticket-action.rules";

export function TicketDetailPage() {
  const id = Number(useParams().ticketId);
  const ticket = useTicket(id);
  const timeline = useTicketTimeline(id);
  const attachments = useTicketAttachments(id);
  const { user } = useAuth();
  if (ticket.isLoading) return <LoadingState />;
  if (ticket.isError || !ticket.data) return <ErrorState error={ticket.error} retry={() => void ticket.refetch()} />;
  const data = ticket.data;
  const isCustomer = user?.role === "CUSTOMER";
  const deviceDescription = [data.device.category, data.device.brand, data.device.model].filter(Boolean).join(" · ");
  return <><PageHeader eyebrow={data.ticketCode} title={data.title} description={deviceDescription} actions={<div className="button-row">{!isCustomer ? <StatusBadge value={data.priority} /> : null}<StatusBadge value={data.status} /></div>} /><div className="ticket-detail-layout"><div className="ticket-detail-main"><Card><div className="section-heading"><h2>Thông tin yêu cầu</h2><span>Cập nhật {formatDateTime(data.updatedAt)}</span></div><dl className="detail-list detail-list--two"><div><dt>Khách hàng</dt><dd>{data.customer.fullName}</dd></div><div><dt>Thiết bị</dt><dd>{data.device.brand ?? ""} {data.device.model ?? data.device.category}</dd></div><div><dt>Số sê-ri</dt><dd>{data.device.serialNumber ?? "—"}</dd></div><div><dt>Người ghi nhận</dt><dd>{data.createdBy.fullName}</dd></div><div className="span-two"><dt>Tình trạng cần hỗ trợ</dt><dd>{data.customerIssue}</dd></div><div className="span-two"><dt>Địa chỉ nhận hoặc bàn giao</dt><dd>{data.repairAddress ?? "Chưa có thông tin"}</dd></div><div><dt>Tình trạng ban đầu</dt><dd>{data.initialCondition ?? "—"}</dd></div><div><dt>Phụ kiện gửi kèm</dt><dd>{data.accessoriesReceived ?? "—"}</dd></div><div><dt>Dự kiến có kết quả kiểm tra</dt><dd>{formatDateTime(data.expectedDiagnosisAt)}</dd></div><div><dt>Dự kiến hoàn thành</dt><dd>{formatDateTime(data.expectedCompletionAt)}</dd></div></dl>{user ? <RepairAddressEditor ticket={data} role={user.role} /> : null}</Card>{user && ["CUSTOMER", "TECHNICIAN", "MANAGER"].includes(user.role) ? <TechnicalSections ticket={data} role={user.role} /> : null}{user && ["CUSTOMER", "RECEPTIONIST", "MANAGER"].includes(user.role) ? <Card><DeliveryPanel ticket={data} role={user.role} /></Card> : null}{user ? <Card><ReviewPanel ticket={data} role={user.role} /></Card> : null}<Card><AttachmentSection ticket={data} attachments={attachments.data ?? []} loading={attachments.isLoading} error={attachments.error} /></Card></div><aside className="ticket-detail-side"><TicketActions ticket={data} /><Card><h2>Quá trình xử lý</h2>{timeline.isLoading ? <LoadingState rows={3} /> : timeline.isError ? <ErrorState error={timeline.error} retry={() => void timeline.refetch()} /> : <ol className="timeline">{timeline.data?.map((item) => <li key={item.key}><i aria-hidden="true" /><div><strong>{item.title}</strong>{item.actor ? <span>{item.actor.fullName}</span> : null}<small>{formatDateTime(item.occurredAt)}</small>{item.description ? <p>{item.description}</p> : null}</div></li>)}</ol>}</Card></aside></div></>;
}

function RepairAddressEditor({ ticket, role }: { ticket: RepairTicket; role: UserRole }) {
  const update = useUpdateTicket(ticket.id);
  const [address, setAddress] = useState(ticket.repairAddress ?? "");
  const canEdit = role === "CUSTOMER"
    ? ticket.status === "NEW"
    : ["RECEPTIONIST", "MANAGER"].includes(role) &&
      !["CLOSED", "CANCELLED"].includes(ticket.status);

  if (!canEdit) return null;

  const normalizedAddress = address.trim();
  const unchanged = normalizedAddress === (ticket.repairAddress ?? "");
  return <form className="repair-address-editor" onSubmit={(event) => { event.preventDefault(); update.mutate({ repairAddress: normalizedAddress }); }}><FormField label="Cập nhật địa chỉ cho yêu cầu này" htmlFor="repair-address-update" required hint="Thay đổi này không ảnh hưởng đến địa chỉ trong hồ sơ cá nhân."><textarea id="repair-address-update" rows={2} minLength={5} maxLength={500} required value={address} onChange={(event) => setAddress(event.target.value)} /></FormField><Button type="submit" variant="secondary" disabled={normalizedAddress.length < 5 || unchanged} loading={update.isPending}>Lưu địa chỉ</Button><MutationError error={update.error} /></form>;
}

function TechnicalSections({ ticket, role }: { ticket: RepairTicket; role: UserRole }) {
  const diagnoses = useDiagnoses(ticket.id);
  const approved = diagnoses.data?.find((diagnosis) => diagnosis.status === "APPROVED");
  return <><Card><DiagnosisPanel ticket={ticket} /></Card>{["CUSTOMER", "TECHNICIAN", "MANAGER"].includes(role) ? <Card><QuotationPanel ticket={ticket} approvedDiagnosis={approved} /></Card> : null}{["TECHNICIAN", "MANAGER"].includes(role) ? <Card><PartRequestPanel ticket={ticket} /></Card> : null}<Card><RepairActionPanel ticket={ticket} /></Card></>;
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
  if (!canCancel && !holdStatus && !canReceive && !canAssign && !canReassign) return null;
  return <Card><h2>Thao tác</h2>{canReceive ? <Button className="button--full" loading={receive.isPending} onClick={() => receive.mutate(reason || undefined)}>Tiếp nhận thiết bị</Button> : null}{canAssign || canReassign ? <AssignmentAction ticket={ticket} /> : null}{(canCancel || holdStatus || canReceive) ? <FormField label="Lý do hoặc ghi chú" htmlFor="ticket-action-reason" hint={canCancel || holdStatus ? "Vui lòng nhập ít nhất 3 ký tự." : undefined}><textarea id="ticket-action-reason" rows={3} value={reason} onChange={(event) => setReason(event.target.value)} /></FormField> : null}{holdStatus ? <Button variant="secondary" className="button--full" disabled={reason.trim().length < 3} loading={changeStatus.isPending} onClick={() => changeStatus.mutate({ status: holdStatus, reason })}>{holdStatus === "ON_HOLD" ? "Tạm dừng xử lý" : "Tiếp tục xử lý"}</Button> : null}{canCancel ? <Button variant="danger" className="button--full" disabled={reason.trim().length < 3} onClick={() => setConfirmCancel(true)}>Hủy yêu cầu</Button> : null}<MutationError error={receive.error ?? cancel.error ?? changeStatus.error} /><ConfirmDialog open={confirmCancel} title="Hủy yêu cầu sửa chữa?" description="Yêu cầu sẽ được đánh dấu đã hủy và lý do vẫn được lưu trong quá trình xử lý." confirmLabel="Xác nhận hủy" danger loading={cancel.isPending} onClose={() => setConfirmCancel(false)} onConfirm={() => cancel.mutate(reason, { onSuccess: () => setConfirmCancel(false) })} /></Card>;
}

function AssignmentAction({ ticket }: { ticket: RepairTicket }) {
  const assign = useAssignTicket(ticket.id);
  const reassign = useReassignTicket(ticket.id);
  const technicians = useAssignableTechnicians();
  const isReassign = ticket.status === "ASSIGNED";
  const { register, handleSubmit, formState: { errors } } = useForm<{ technicianId: number; note: string }>({ defaultValues: { technicianId: 0, note: "" } });
  const submit = handleSubmit(async (values) => {
    if (isReassign) await reassign.mutateAsync({ technicianId: values.technicianId, note: values.note });
    else await assign.mutateAsync({ technicianId: values.technicianId, note: values.note || null });
  });
  return <div className="assignment-box"><form onSubmit={(event) => void submit(event)}><FormField label="Kỹ thuật viên khả dụng" htmlFor="technician-id" required error={errors.technicianId?.message ?? (technicians.isError ? "Không thể tải danh sách kỹ thuật viên" : undefined)}><select id="technician-id" defaultValue="" {...register("technicianId", { valueAsNumber: true, min: { value: 1, message: "Hãy chọn kỹ thuật viên" }, required: "Bắt buộc" })}><option value="" disabled>{technicians.isLoading ? "Đang tải…" : "Chọn kỹ thuật viên"}</option>{technicians.data?.map((technician) => <option key={technician.id} value={technician.id}>{technician.fullName} · {technician.email}</option>)}</select></FormField><FormField label="Ghi chú phân công" htmlFor="assignment-note" required={isReassign} error={errors.note?.message}><textarea id="assignment-note" rows={2} {...register("note", isReassign ? { required: "Bắt buộc khi phân công lại", minLength: { value: 3, message: "Tối thiểu 3 ký tự" } } : {})} /></FormField><Button className="button--full" type="submit" disabled={technicians.isLoading || !technicians.data?.length} loading={assign.isPending || reassign.isPending}>{isReassign ? "Phân công lại" : "Phân công kỹ thuật viên"}</Button><MutationError error={assign.error ?? reassign.error ?? technicians.error} /></form></div>;
}

const attachmentTypesByRole: Partial<Record<UserRole, TicketAttachmentType[]>> = {
  CUSTOMER: ["CUSTOMER_ATTACHMENT"],
  RECEPTIONIST: ["BEFORE_REPAIR", "CUSTOMER_ATTACHMENT"],
  TECHNICIAN: ["DURING_REPAIR", "AFTER_REPAIR"],
  MANAGER: ["BEFORE_REPAIR", "DURING_REPAIR", "AFTER_REPAIR", "CUSTOMER_ATTACHMENT"],
};

const attachmentTypeLabels: Record<TicketAttachmentType, string> = {
  CUSTOMER_ATTACHMENT: "Ảnh do khách hàng cung cấp",
  BEFORE_REPAIR: "Trước khi sửa chữa",
  DURING_REPAIR: "Trong khi sửa chữa",
  AFTER_REPAIR: "Sau khi sửa chữa",
  DELIVERY_PROOF: "Xác nhận bàn giao",
};

function AttachmentSection({ ticket, attachments, loading, error }: { ticket: RepairTicket; attachments: import("../../types/domain").TicketAttachment[]; loading: boolean; error: unknown }) {
  const { user } = useAuth();
  const upload = useUploadTicketAttachment(ticket.id);
  const types = user ? attachmentTypesByRole[user.role] ?? [] : [];
  const [attachmentType, setAttachmentType] = useState<TicketAttachmentType>(types[0] ?? "CUSTOMER_ATTACHMENT");
  const [file, setFile] = useState<File | null>(null);
  const terminal = ["CLOSED", "CANCELLED"].includes(ticket.status);
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!file) return;
    await upload.mutateAsync({ attachmentType, file });
    setFile(null);
  };
  return <section aria-labelledby="attachments-title"><div className="section-heading"><div><h2 id="attachments-title">Hình ảnh thiết bị</h2><p>Theo dõi tình trạng thiết bị qua hình ảnh trước, trong và sau khi sửa chữa.</p></div></div>{loading ? <LoadingState rows={2} /> : error ? <ErrorState error={error} /> : attachments.length === 0 ? <EmptyState title="Chưa có hình ảnh" description="Hình ảnh được bổ sung trong quá trình tiếp nhận và sửa chữa sẽ xuất hiện tại đây." /> : <div className="attachment-grid">{attachments.map((item) => <a className="attachment-card" href={item.fileUrl} target="_blank" rel="noreferrer" key={item.id}>{item.mimeType?.startsWith("image/") ? <img src={item.fileUrl} alt={item.fileName ?? attachmentTypeLabels[item.attachmentType]} loading="lazy" /> : <span className="attachment-card__fallback" aria-hidden="true">↗</span>}<span className="attachment-card__copy"><strong>{item.fileName ?? attachmentTypeLabels[item.attachmentType]}</strong><small>{attachmentTypeLabels[item.attachmentType]} · {formatDateTime(item.createdAt)}</small></span></a>)}</div>}{types.length > 0 && !terminal ? <form className="attachment-form" onSubmit={(event) => void submit(event)}><FormField label="Thời điểm chụp" htmlFor="attachment-type"><select id="attachment-type" value={attachmentType} onChange={(event) => setAttachmentType(event.target.value as TicketAttachmentType)}>{types.map((type) => <option key={type} value={type}>{attachmentTypeLabels[type]}</option>)}</select></FormField><TicketImagePicker file={file} disabled={upload.isPending} onChange={setFile} /><Button type="submit" disabled={!file} loading={upload.isPending}>Thêm hình ảnh</Button></form> : null}<MutationError error={upload.error} /></section>;
}
