import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "../../components/ui/button";
import { EmptyState, ErrorState, LoadingState } from "../../components/ui/data-state";
import { StatusBadge } from "../../components/ui/status-badge";
import { formatDateTime, formatMoney } from "../../lib/formatting/formatters";
import { useAuth } from "../../lib/auth/use-auth";
import type { Diagnosis, RepairTicket } from "../../types/domain";
import { QuotationForm } from "./quotation-form";
import { useQuotations } from "./quotations.api";

export function QuotationPanel({ ticket, approvedDiagnosis }: { ticket: RepairTicket; approvedDiagnosis?: Diagnosis }) {
  const { user } = useAuth();
  const quotations = useQuotations(ticket.id);
  const [creating, setCreating] = useState(false);
  if (!user) return null;
  if (quotations.isLoading) return <LoadingState rows={2} />;
  if (quotations.isError) return <ErrorState error={quotations.error} retry={() => void quotations.refetch()} />;
  const canCreate = user.role === "MANAGER" && !!approvedDiagnosis;
  const data = quotations.data ?? [];
  return <section className="detail-section" aria-labelledby="quotation-title"><div className="section-heading"><div><span className="eyebrow">Phase 6 · Adapter mode</span><h2 id="quotation-title">Lịch sử báo giá</h2><p>Backend quotations chưa được triển khai; dữ liệu dưới đây chỉ tồn tại trong memory của frontend.</p></div>{canCreate ? <Button variant="secondary" onClick={() => setCreating((value) => !value)}>{creating ? "Đóng" : "+ Bản nháp mock"}</Button> : null}</div><div className="alert alert--warning">Đang chờ schema/DTO/API thực tế của Phase 6. Không có request quotation nào được gửi đến backend.</div>{creating ? <QuotationForm ticketId={ticket.id} onDone={() => setCreating(false)} /> : null}{data.length === 0 ? <EmptyState title="Chưa có báo giá" description={canCreate ? "Có thể dùng mock adapter để kiểm tra luồng giao diện." : "Báo giá sẽ xuất hiện khi Phase 6 backend hoàn tất."} /> : <div className="quote-history">{data.map((quotation) => <Link to={`/tickets/${ticket.id}/quotations/${quotation.id}`} key={quotation.id} className="quote-row"><div><span className="eyebrow">Phiên bản {quotation.version}</span><strong>{formatMoney(quotation.totalAmount)}</strong><small>Tạo {formatDateTime(quotation.createdAt)}</small></div><StatusBadge value={quotation.status} /><span>Chi tiết →</span></Link>)}</div>}</section>;
}
