import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { EmptyState, ErrorState, LoadingState, MutationError } from "../../components/ui/data-state";
import { FormField } from "../../components/ui/form-field";
import { PageHeader } from "../../components/ui/page-header";
import { Pagination } from "../../components/ui/pagination";
import { StatusBadge } from "../../components/ui/status-badge";
import { useAuth } from "../../lib/auth/use-auth";
import { formatDateTime, formatMoney } from "../../lib/formatting/formatters";
import { INVOICE_PAYMENT_STATUSES, type InvoicePaymentStatus } from "../../types/domain";
import { useTickets } from "../repair-tickets/tickets.api";
import { useCreateInvoice, useInvoices } from "./payments.api";

const paymentStatusLabels: Record<InvoicePaymentStatus, string> = {
  UNPAID: "Chưa thanh toán",
  PARTIALLY_PAID: "Đã thanh toán một phần",
  PAID: "Đã thanh toán",
  REFUNDED: "Đã hoàn tiền",
  PARTIALLY_REFUNDED: "Đã hoàn một phần",
};

export function InvoicesPage() {
  const { user } = useAuth();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<InvoicePaymentStatus | "">("");
  const [creating, setCreating] = useState(false);
  const invoices = useInvoices({ page, limit: 20, search: search || undefined, paymentStatus: status || undefined, sortBy: "createdAt", sortOrder: "desc" });
  if (!user) return null;

  return <>
    <PageHeader eyebrow={user.role === "CUSTOMER" ? "Chi phí dịch vụ" : "Thanh toán"} title={user.role === "CUSTOMER" ? "Hóa đơn của tôi" : "Hóa đơn & thanh toán"} description={user.role === "CUSTOMER" ? "Xem tổng chi phí, số tiền đã thanh toán và số tiền còn lại của từng yêu cầu." : "Tra cứu hóa đơn, ghi nhận khoản thu và theo dõi số tiền còn lại."} actions={user.role === "CASHIER" ? <Button onClick={() => setCreating((value) => !value)}>{creating ? "Đóng" : "+ Lập hóa đơn"}</Button> : undefined} />
    {creating ? <CreateInvoiceCard onDone={() => setCreating(false)} /> : null}
    <Card>
      <div className="toolbar toolbar--filters">
        <label className="search-field"><span className="sr-only">Tìm hóa đơn</span><input value={search} placeholder="Mã hóa đơn, mã phiếu, khách hàng…" onChange={(event) => { setSearch(event.target.value); setPage(1); }} /></label>
        <select aria-label="Lọc trạng thái thanh toán" value={status} onChange={(event) => { setStatus(event.target.value as InvoicePaymentStatus | ""); setPage(1); }}><option value="">Mọi trạng thái</option>{INVOICE_PAYMENT_STATUSES.map((value) => <option value={value} key={value}>{paymentStatusLabels[value]}</option>)}</select>
      </div>
      {invoices.isLoading ? <LoadingState /> : invoices.isError ? <ErrorState error={invoices.error} retry={() => void invoices.refetch()} /> : (invoices.data?.data ?? []).length === 0 ? <EmptyState title="Chưa có hóa đơn phù hợp" description={user.role === "CASHIER" ? "Lập hóa đơn cho phiếu đã hoàn tất kỹ thuật." : "Hóa đơn sẽ xuất hiện tại đây sau khi thu ngân phát hành."} /> : <div className="table-wrap"><table><thead><tr><th>Hóa đơn</th><th>Khách hàng</th><th>Tổng tiền</th><th>Đã thanh toán</th><th>Còn lại</th><th>Trạng thái</th><th /></tr></thead><tbody>{(invoices.data?.data ?? []).map((invoice) => <tr key={invoice.id}><td><strong>{invoice.invoiceCode}</strong><small>{invoice.ticket.ticketCode} · {formatDateTime(invoice.createdAt)}</small></td><td><strong>{invoice.customer.fullName}</strong><small>{invoice.customer.email}</small></td><td>{formatMoney(invoice.totalAmount)}</td><td>{formatMoney(invoice.paidAmount)}</td><td><strong>{formatMoney(invoice.balanceAmount)}</strong></td><td><StatusBadge value={invoice.paymentStatus} /></td><td><Link className="button button--ghost button--sm" to={`/invoices/${invoice.id}`}>Chi tiết →</Link></td></tr>)}</tbody></table></div>}
      <Pagination page={page} totalPages={invoices.data?.meta.totalPages ?? 1} onChange={setPage} />
    </Card>
  </>;
}

function CreateInvoiceCard({ onDone }: { onDone(): void }) {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [ticketId, setTicketId] = useState(0);
  const tickets = useTickets({ page: 1, limit: 100, search: search || undefined, status: "COMPLETED", sortBy: "updatedAt", sortOrder: "desc" });
  const create = useCreateInvoice();
  const submit = async () => {
    if (ticketId <= 0) return;
    const invoice = await create.mutateAsync(ticketId);
    onDone();
    void navigate(`/invoices/${invoice.id}`);
  };
  return <Card className="form-card">
    <div className="section-heading"><div><h2>Lập hóa đơn từ phiếu hoàn tất</h2><p>Hóa đơn lấy tiền công/dịch vụ từ dự toán đã chấp nhận và cộng đúng số linh kiện kho thực tế cấp trong lúc sửa.</p></div><Button variant="ghost" onClick={onDone}>Đóng</Button></div>
    <MutationError error={create.error} />
    <div className="form-grid">
      <FormField label="Tìm phiếu" htmlFor="billable-ticket-search" hint="Tìm theo mã phiếu, tiêu đề hoặc mô tả lỗi."><input id="billable-ticket-search" value={search} onChange={(event) => setSearch(event.target.value)} /></FormField>
      <FormField label="Phiếu đã hoàn tất" htmlFor="billable-ticket" required><select id="billable-ticket" value={ticketId} onChange={(event) => setTicketId(Number(event.target.value))}><option value={0}>Chọn phiếu</option>{(tickets.data?.data ?? []).map((ticket) => <option value={ticket.id} key={ticket.id}>{ticket.ticketCode} · {ticket.customer.fullName} · {ticket.title}</option>)}</select></FormField>
    </div>
    {tickets.isLoading ? <LoadingState rows={1} /> : null}
    {tickets.isError ? <ErrorState error={tickets.error} retry={() => void tickets.refetch()} /> : null}
    {!tickets.isLoading && !tickets.isError && (tickets.data?.data ?? []).length === 0 ? <div className="alert alert--info">Không có phiếu hoàn tất đang chờ lập hóa đơn.</div> : null}
    <Button disabled={ticketId <= 0} loading={create.isPending} onClick={() => void submit()}>Phát hành hóa đơn</Button>
  </Card>;
}
