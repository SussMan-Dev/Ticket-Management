import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useParams } from "react-router-dom";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { EmptyState, ErrorState, LoadingState, MutationError } from "../../components/ui/data-state";
import { FormField } from "../../components/ui/form-field";
import { PageHeader } from "../../components/ui/page-header";
import { StatusBadge } from "../../components/ui/status-badge";
import { useAuth } from "../../lib/auth/use-auth";
import { formatDateTime, formatMoney } from "../../lib/formatting/formatters";
import type { Invoice, Payment, PaymentMethod } from "../../types/domain";
import { paymentFormSchema, refundFormSchema, type PaymentFormValues, type RefundFormValues } from "./payment.schemas";
import { useCreatePayment, useInvoice, useInvoicePayments, useRefundApprovers, useRefundPayment } from "./payments.api";

const methodLabels: Record<PaymentMethod, string> = { CASH: "Tiền mặt", BANK_TRANSFER: "Chuyển khoản", CARD: "Thẻ", E_WALLET: "Ví điện tử" };

export function InvoiceDetailPage() {
  const id = Number(useParams().invoiceId);
  const invoice = useInvoice(id);
  const payments = useInvoicePayments(id);
  const { user } = useAuth();
  if (invoice.isLoading) return <LoadingState />;
  if (invoice.isError || !invoice.data) return <ErrorState error={invoice.error} retry={() => void invoice.refetch()} />;
  const data = invoice.data;
  const canCollect = user?.role === "CASHIER" && data.balanceAmount > 0;
  return <>
    <PageHeader eyebrow={data.invoiceCode} title={`Hóa đơn ${data.ticket.ticketCode}`} description={`Khách hàng ${data.customer.fullName} · phát hành ${formatDateTime(data.createdAt)}`} actions={<div className="button-row"><StatusBadge value={data.paymentStatus} /><Link className="button button--ghost button--sm" to="/invoices">← Danh sách</Link></div>} />
    <InvoiceSummary invoice={data} />
    {canCollect ? <PaymentForm invoice={data} /> : null}
    <Card>
      <div className="section-heading"><div><h2>Lịch sử thanh toán</h2><p>Mỗi khoản thu hoặc hoàn tiền đều được lưu lại để dễ dàng đối chiếu.</p></div></div>
      {payments.isLoading ? <LoadingState /> : payments.isError ? <ErrorState error={payments.error} retry={() => void payments.refetch()} /> : (payments.data ?? []).length === 0 ? <EmptyState title="Chưa có thanh toán" description="Hóa đơn chưa ghi nhận khoản thu nào." /> : <PaymentHistory invoiceId={id} payments={payments.data ?? []} />}
    </Card>
  </>;
}

function InvoiceSummary({ invoice }: { invoice: Invoice }) {
  return <>
    <div className="metric-grid billing-metrics">
      <Card><span className="metric__label">Tổng hóa đơn</span><strong className="metric__value">{formatMoney(invoice.totalAmount)}</strong><small>Gồm tiền công và linh kiện kho đã cấp trong lúc sửa: {formatMoney(invoice.subtotal)}</small></Card>
      <Card><span className="metric__label">Đã thanh toán</span><strong className="metric__value">{formatMoney(invoice.paidAmount)}</strong><small>Cập nhật {formatDateTime(invoice.updatedAt)}</small></Card>
      <Card><span className="metric__label">Còn lại</span><strong className="metric__value">{formatMoney(invoice.balanceAmount)}</strong><small>{invoice.balanceAmount === 0 ? "Đã thanh toán đủ" : "Có thể thanh toán từng phần"}</small></Card>
    </div>
    <Card className="billing-detail-card"><dl className="detail-list detail-list--two"><div><dt>Khách hàng</dt><dd>{invoice.customer.fullName}<small>{invoice.customer.email}</small></dd></div><div><dt>Phiếu sửa chữa</dt><dd>{invoice.ticket.ticketCode}<small><StatusBadge value={invoice.ticket.status} /></small></dd></div><div><dt>Giảm giá</dt><dd>{formatMoney(invoice.discountAmount)}</dd></div><div><dt>Thuế</dt><dd>{formatMoney(invoice.taxAmount)}</dd></div><div><dt>Người lập</dt><dd>{invoice.createdBy.fullName}</dd></div><div><dt>Mã hóa đơn</dt><dd>{invoice.invoiceCode}</dd></div></dl></Card>
  </>;
}

function PaymentForm({ invoice }: { invoice: Invoice }) {
  const create = useCreatePayment(invoice.id);
  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<PaymentFormValues>({ resolver: zodResolver(paymentFormSchema), defaultValues: { amount: invoice.balanceAmount, method: "CASH", transactionReference: "", note: "" } });
  const method = watch("method");
  useEffect(() => setValue("amount", invoice.balanceAmount), [invoice.balanceAmount, setValue]);
  const submit = handleSubmit(async (values) => {
    await create.mutateAsync({ amount: values.amount, method: values.method, transactionReference: values.transactionReference?.trim() || null, note: values.note?.trim() || null });
    reset({ amount: invoice.balanceAmount, method: "CASH", transactionReference: "", note: "" });
  });
  return <Card className="form-card billing-form-card">
    <div className="section-heading"><div><h2>Ghi nhận thanh toán</h2><p>Số tiền tối đa có thể thu: {formatMoney(invoice.balanceAmount)}. Hệ thống sẽ kiểm tra lại trước khi lưu.</p></div></div>
    <MutationError error={create.error} />
    <form onSubmit={(event) => void submit(event)}><div className="form-grid">
      <FormField label="Số tiền (VNĐ)" htmlFor="payment-amount" required error={errors.amount?.message}><input id="payment-amount" type="number" min="0.01" max={invoice.balanceAmount} step="0.01" {...register("amount", { valueAsNumber: true })} /></FormField>
      <FormField label="Phương thức" htmlFor="payment-method" required error={errors.method?.message}><select id="payment-method" {...register("method")}>{Object.entries(methodLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></FormField>
      <FormField label="Mã đối soát" htmlFor="payment-reference" error={errors.transactionReference?.message} hint={method === "CASH" ? "Không bắt buộc với tiền mặt." : "Không nhập số thẻ hoặc dữ liệu thanh toán nhạy cảm."}><input id="payment-reference" maxLength={191} {...register("transactionReference")} /></FormField>
      <FormField label="Ghi chú" htmlFor="payment-note" error={errors.note?.message}><input id="payment-note" maxLength={5_000} {...register("note")} /></FormField>
    </div><Button type="submit" loading={create.isPending}>Xác nhận khoản thu</Button></form>
  </Card>;
}

function PaymentHistory({ invoiceId, payments }: { invoiceId: number; payments: Payment[] }) {
  const { user } = useAuth();
  const [refunding, setRefunding] = useState<Payment | null>(null);
  return <>
    <div className="table-wrap"><table><thead><tr><th>Giao dịch</th><th>Phương thức</th><th>Số tiền</th><th>Người thu</th><th>Trạng thái</th><th /></tr></thead><tbody>{payments.map((payment) => <tr key={payment.id}><td><strong>{payment.paymentCode}</strong><small>{formatDateTime(payment.paidAt)}{payment.transactionReference ? ` · ${payment.transactionReference}` : ""}</small></td><td>{methodLabels[payment.method]}</td><td><strong>{formatMoney(payment.amount)}</strong>{payment.note ? <small>{payment.note}</small> : null}</td><td>{payment.receivedBy.fullName}</td><td><StatusBadge value={payment.status} /></td><td>{user?.role === "CASHIER" && payment.status === "COMPLETED" ? <Button size="sm" variant="danger" onClick={() => setRefunding(payment)}>Hoàn tiền</Button> : null}</td></tr>)}</tbody></table></div>
    {refunding ? <RefundForm invoiceId={invoiceId} payment={refunding} onDone={() => setRefunding(null)} /> : null}
  </>;
}

function RefundForm({ invoiceId, payment, onDone }: { invoiceId: number; payment: Payment; onDone(): void }) {
  const refund = useRefundPayment(invoiceId);
  const approvers = useRefundApprovers(true);
  const { register, handleSubmit, formState: { errors } } = useForm<RefundFormValues>({ resolver: zodResolver(refundFormSchema), defaultValues: { managerApprovalId: 0, reason: "" } });
  const submit = handleSubmit(async (values) => { await refund.mutateAsync({ paymentId: payment.id, input: values }); onDone(); });
  return <div className="refund-box">
    <div className="section-heading"><div><h3>Hoàn {formatMoney(payment.amount)}</h3><p>Giao dịch {payment.paymentCode} sẽ được đánh dấu đã hoàn tiền và vẫn được giữ trong lịch sử.</p></div><Button variant="ghost" size="sm" onClick={onDone}>Đóng</Button></div>
    <MutationError error={refund.error ?? approvers.error} />
    <form onSubmit={(event) => void submit(event)}><div className="form-grid">
      <FormField label="Quản lý phê duyệt" htmlFor="refund-approver" required error={errors.managerApprovalId?.message}><select id="refund-approver" {...register("managerApprovalId", { valueAsNumber: true })}><option value={0}>Chọn quản lý đang hoạt động</option>{(approvers.data ?? []).map((manager) => <option value={manager.id} key={manager.id}>{manager.fullName} · #{manager.id}</option>)}</select></FormField>
      <FormField label="Lý do hoàn tiền" htmlFor="refund-reason" required error={errors.reason?.message}><textarea id="refund-reason" rows={3} maxLength={5_000} {...register("reason")} /></FormField>
    </div><Button type="submit" variant="danger" loading={refund.isPending || approvers.isLoading}>Xác nhận hoàn toàn bộ giao dịch</Button></form>
  </div>;
}
