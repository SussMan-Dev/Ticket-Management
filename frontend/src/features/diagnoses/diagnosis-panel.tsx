import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { ConfirmDialog } from "../../components/ui/confirm-dialog";
import { EmptyState, ErrorState, LoadingState, MutationError } from "../../components/ui/data-state";
import { FormField } from "../../components/ui/form-field";
import { StatusBadge } from "../../components/ui/status-badge";
import { formatDateTime, formatMoney } from "../../lib/formatting/formatters";
import { useAuth } from "../../lib/auth/use-auth";
import type { Diagnosis, Part, RepairTicket } from "../../types/domain";
import { diagnosisSchema, type DiagnosisValues } from "./diagnosis.schemas";
import { canEditDiagnosis, canReviewDiagnosis, canSubmitDiagnosis } from "./diagnosis.rules";
import { useApproveDiagnosis, useCreateDiagnosis, useDiagnoses, useRequestDiagnosisRevision, useSubmitDiagnosis, useUpdateDiagnosis, type DiagnosisInput } from "./diagnoses.api";
import { useParts } from "../parts/parts.api";

export function DiagnosisPanel({ ticket }: { ticket: RepairTicket }) {
  const { user } = useAuth();
  const diagnoses = useDiagnoses(ticket.id);
  if (!user) return null;
  if (diagnoses.isLoading) return <LoadingState rows={2} />;
  if (diagnoses.isError) return <ErrorState error={diagnoses.error} retry={() => void diagnoses.refetch()} />;
  const latest = diagnoses.data?.[0];
  const canCreate = user.role === "TECHNICIAN" && !latest && ["ASSIGNED", "DIAGNOSING"].includes(ticket.status);
  return <section className="detail-section" aria-labelledby="diagnosis-title"><div className="section-heading"><div><span className="eyebrow">Phase 5</span><h2 id="diagnosis-title">Chẩn đoán kỹ thuật</h2></div>{latest ? <StatusBadge value={latest.status} /> : null}</div>{!latest && !canCreate ? <EmptyState title="Chưa có chẩn đoán" description={user.role === "CUSTOMER" ? "Chẩn đoán đã duyệt sẽ xuất hiện tại đây." : "Kỹ thuật viên được phân công sẽ tạo bản chẩn đoán."} /> : null}{canCreate ? <DiagnosisForm ticketId={ticket.id} /> : null}{latest ? <DiagnosisRecord diagnosis={latest} role={user.role} /> : null}</section>;
}

function DiagnosisRecord({ diagnosis, role }: { diagnosis: Diagnosis; role: import("../../types/domain").UserRole }) {
  const editable = canEditDiagnosis(role, diagnosis.status);
  const submit = useSubmitDiagnosis(diagnosis.ticketId, diagnosis.id);
  const approve = useApproveDiagnosis(diagnosis.ticketId, diagnosis.id);
  const revision = useRequestDiagnosisRevision(diagnosis.ticketId, diagnosis.id);
  const [confirm, setConfirm] = useState<"submit" | "approve" | null>(null);
  const [revisionReason, setRevisionReason] = useState("");
  if (editable) return <DiagnosisForm ticketId={diagnosis.ticketId} diagnosis={diagnosis} />;
  return <><Card className="diagnosis-card"><dl className="detail-list detail-list--two"><div><dt>Vấn đề thực tế</dt><dd>{diagnosis.actualIssue}</dd></div>{diagnosis.rootCause !== undefined ? <div><dt>Nguyên nhân gốc</dt><dd>{diagnosis.rootCause ?? "—"}</dd></div> : null}<div><dt>Giải pháp đề xuất</dt><dd>{diagnosis.proposedSolution}</dd></div><div><dt>Chi phí công dự kiến</dt><dd>{formatMoney(diagnosis.laborCost)}</dd></div><div><dt>Thời gian dự kiến</dt><dd>{diagnosis.estimatedHours === null ? "—" : `${diagnosis.estimatedHours} giờ`}</dd></div><div><dt>Rủi ro mất dữ liệu</dt><dd>{diagnosis.dataLossRisk ? "Có" : "Không"}</dd></div>{diagnosis.riskNote !== undefined ? <div><dt>Ghi chú rủi ro nội bộ</dt><dd>{diagnosis.riskNote ?? "—"}</dd></div> : null}<div><dt>Phê duyệt</dt><dd>{formatDateTime(diagnosis.approvedAt)}</dd></div></dl><h3>Linh kiện đề nghị</h3>{diagnosis.parts.length === 0 ? <p className="muted">Không có linh kiện.</p> : <div className="parts-list">{diagnosis.parts.map((part) => <div key={part.id}><span><strong>{part.name}</strong><small>{part.sku} · ID #{part.partId}</small></span><span>x{part.quantity}</span></div>)}</div>}{canSubmitDiagnosis(role, diagnosis.status) ? <Button onClick={() => setConfirm("submit")}>Gửi duyệt chẩn đoán</Button> : null}{canReviewDiagnosis(role, diagnosis.status) ? <div className="review-actions"><div><FormField label="Lý do yêu cầu chỉnh sửa" htmlFor="revision-reason" hint="Bắt buộc khi trả lại kỹ thuật viên."><textarea id="revision-reason" rows={2} value={revisionReason} onChange={(event) => setRevisionReason(event.target.value)} /></FormField><Button variant="secondary" disabled={revisionReason.trim().length < 3} loading={revision.isPending} onClick={() => revision.mutate(revisionReason)}>Yêu cầu chỉnh sửa</Button></div><Button onClick={() => setConfirm("approve")}>Duyệt chẩn đoán</Button></div> : null}<MutationError error={submit.error ?? approve.error ?? revision.error} /></Card><ConfirmDialog open={confirm !== null} title={confirm === "approve" ? "Duyệt chẩn đoán?" : "Gửi chẩn đoán để duyệt?"} description={confirm === "approve" ? "Sau khi duyệt, phiếu chuyển sang chờ báo giá và nội dung khách hàng được phép xem sẽ được mở." : "Nội dung sẽ chuyển sang read-only cho đến khi quản lý yêu cầu chỉnh sửa."} loading={submit.isPending || approve.isPending} onClose={() => setConfirm(null)} onConfirm={() => { const mutation = confirm === "approve" ? approve : submit; mutation.mutate(undefined, { onSuccess: () => setConfirm(null) }); }} /></>;
}

function normalize(values: DiagnosisValues): DiagnosisInput {
  return {
    actualIssue: values.actualIssue,
    rootCause: values.rootCause || null,
    proposedSolution: values.proposedSolution,
    laborCost: values.laborCost,
    estimatedHours: values.estimatedHours === "" || values.estimatedHours === undefined ? null : values.estimatedHours,
    dataLossRisk: values.dataLossRisk,
    riskNote: values.riskNote || null,
    parts: values.parts.map((part) => ({ partId: part.partId, quantity: part.quantity, note: part.note || null })),
  };
}

function DiagnosisForm({ ticketId, diagnosis }: { ticketId: number; diagnosis?: Diagnosis }) {
  const [catalogSearch, setCatalogSearch] = useState("");
  const catalog = useParts({ page: 1, limit: 100, search: catalogSearch || undefined, isActive: true, sortBy: "name", sortOrder: "asc" });
  const create = useCreateDiagnosis(ticketId);
  const update = useUpdateDiagnosis(ticketId, diagnosis?.id ?? 0);
  const form = useForm<DiagnosisValues>({ resolver: zodResolver(diagnosisSchema), defaultValues: { actualIssue: diagnosis?.actualIssue ?? "", rootCause: diagnosis?.rootCause ?? "", proposedSolution: diagnosis?.proposedSolution ?? "", laborCost: diagnosis?.laborCost ?? 0, estimatedHours: diagnosis?.estimatedHours ?? "", dataLossRisk: diagnosis?.dataLossRisk ?? false, riskNote: diagnosis?.riskNote ?? "", parts: diagnosis?.parts.map((part) => ({ partId: part.partId, quantity: part.quantity, note: part.note ?? "" })) ?? [] } });
  const parts = useFieldArray({ control: form.control, name: "parts" });
  const mutation = diagnosis ? update : create;
  const submit = form.handleSubmit(async (values) => { await mutation.mutateAsync(normalize(values)); });
  return <Card className="form-card"><h3>{diagnosis ? "Chỉnh sửa bản chẩn đoán" : "Tạo bản chẩn đoán"}</h3><p className="muted">Chỉ DRAFT hoặc REVISION_REQUIRED mới có thể chỉnh sửa.</p><MutationError error={mutation.error} /><form onSubmit={(event) => void submit(event)}><FormField label="Vấn đề thực tế" htmlFor="actual-issue" required error={form.formState.errors.actualIssue?.message}><textarea id="actual-issue" rows={3} {...form.register("actualIssue")} /></FormField><FormField label="Nguyên nhân gốc" htmlFor="root-cause" error={form.formState.errors.rootCause?.message}><textarea id="root-cause" rows={3} {...form.register("rootCause")} /></FormField><FormField label="Giải pháp đề xuất" htmlFor="proposed-solution" required error={form.formState.errors.proposedSolution?.message}><textarea id="proposed-solution" rows={3} {...form.register("proposedSolution")} /></FormField><div className="form-grid"><FormField label="Chi phí công dự kiến" htmlFor="labor-cost" required error={form.formState.errors.laborCost?.message}><input id="labor-cost" type="number" min={0} step="0.01" {...form.register("laborCost", { valueAsNumber: true })} /></FormField><FormField label="Số giờ dự kiến" htmlFor="estimated-hours" error={form.formState.errors.estimatedHours?.message}><input id="estimated-hours" type="number" min={0} step="0.01" {...form.register("estimatedHours", { setValueAs: (value: string) => value === "" ? "" : Number(value) })} /></FormField></div><label className="check-field"><input type="checkbox" {...form.register("dataLossRisk")} /><span><strong>Có rủi ro mất dữ liệu</strong><small>Thông báo rõ cho quản lý và khách hàng.</small></span></label>{form.watch("dataLossRisk") ? <FormField label="Ghi chú rủi ro" htmlFor="risk-note" error={form.formState.errors.riskNote?.message}><textarea id="risk-note" rows={2} {...form.register("riskNote")} /></FormField> : null}<div className="section-heading"><div><h3>Linh kiện đề nghị</h3><p>Chọn part hoạt động từ catalog Phase 7.</p></div><Button type="button" variant="secondary" size="sm" onClick={() => parts.append({ partId: 0, quantity: 1, note: "" })}>+ Thêm linh kiện</Button></div>{parts.fields.length > 0 ? <FormField label="Tìm catalog" htmlFor="diagnosis-part-search"><input id="diagnosis-part-search" value={catalogSearch} onChange={(event) => setCatalogSearch(event.target.value)} placeholder="SKU hoặc tên…" /></FormField> : null}{parts.fields.map((field, index) => <div className="part-row" key={field.id}><FormField label="Linh kiện" htmlFor={`part-${index}-id`} error={form.formState.errors.parts?.[index]?.partId?.message}><CatalogPartSelect id={`part-${index}-id`} value={form.watch(`parts.${index}.partId`)} options={catalog.data?.data ?? []} fallback={diagnosis?.parts[index] ? `${diagnosis.parts[index].sku} · ${diagnosis.parts[index].name}` : undefined} onChange={(partId) => form.setValue(`parts.${index}.partId`, partId, { shouldValidate: true })} /></FormField><FormField label="Số lượng" htmlFor={`part-${index}-quantity`} error={form.formState.errors.parts?.[index]?.quantity?.message}><input id={`part-${index}-quantity`} type="number" min={1} {...form.register(`parts.${index}.quantity`, { valueAsNumber: true })} /></FormField><FormField label="Ghi chú" htmlFor={`part-${index}-note`} error={form.formState.errors.parts?.[index]?.note?.message}><input id={`part-${index}-note`} {...form.register(`parts.${index}.note`)} /></FormField><Button type="button" variant="ghost" size="sm" onClick={() => parts.remove(index)}>Xóa</Button></div>)}<Button type="submit" loading={mutation.isPending}>{diagnosis ? "Lưu chẩn đoán" : "Tạo bản nháp"}</Button></form></Card>;
}

function CatalogPartSelect({ id, value, options, fallback, onChange }: { id: string; value: number; options: Part[]; fallback?: string; onChange(value: number): void }) {
  const hasCurrent = options.some((part) => part.id === value);
  return <select id={id} value={value} onChange={(event) => onChange(Number(event.target.value))}><option value={0}>Chọn linh kiện</option>{value > 0 && !hasCurrent ? <option value={value}>{fallback ?? `Part #${value}`}</option> : null}{options.map((part) => <option key={part.id} value={part.id}>{part.sku} · {part.name} (tồn {part.quantityOnHand})</option>)}</select>;
}
