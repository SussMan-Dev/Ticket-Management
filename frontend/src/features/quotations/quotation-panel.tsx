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

export function QuotationPanel({
  ticket,
  approvedDiagnosis,
}: {
  ticket: RepairTicket;
  approvedDiagnosis?: Diagnosis;
}) {
  const { user } = useAuth();
  const quotations = useQuotations(ticket.id);
  const [creating, setCreating] = useState(false);

  if (!user) return null;
  if (quotations.isLoading) return <LoadingState rows={2} />;
  if (quotations.isError) {
    return <ErrorState error={quotations.error} retry={() => void quotations.refetch()} />;
  }

  const data = quotations.data ?? [];
  const latestQuotation = data[0];
  const canCreate =
    user.role === "MANAGER" &&
    (ticket.status === "WAITING_FOR_QUOTATION" || (
      ticket.status === "WAITING_FOR_CUSTOMER_APPROVAL" &&
      latestQuotation?.status === "EXPIRED"
    )) &&
    !!approvedDiagnosis;

  return (
    <section className="detail-section" aria-labelledby="quotation-title">
      <div className="section-heading">
        <div>
          <span className="eyebrow">Phase 6 · Dữ liệu API</span>
          <h2 id="quotation-title">Lịch sử báo giá</h2>
          <p>Mỗi phiên bản giữ nguyên hạng mục và đơn giá đã được server chụp tại thời điểm lưu.</p>
        </div>
        {canCreate ? (
          <Button variant="secondary" onClick={() => setCreating((value) => !value)}>
            {creating ? "Đóng" : "+ Tạo báo giá"}
          </Button>
        ) : null}
      </div>

      {creating ? (
        <QuotationForm ticketId={ticket.id} onDone={() => setCreating(false)} />
      ) : null}

      {data.length === 0 ? (
        <EmptyState
          title="Chưa có báo giá"
          description={canCreate
            ? "Tạo bản nháp từ chẩn đoán đã được duyệt."
            : "Báo giá sẽ xuất hiện khi quản lý hoàn tất bản nháp."}
        />
      ) : (
        <div className="quote-history">
          {data.map((quotation) => (
            <Link
              to={`/tickets/${ticket.id}/quotations/${quotation.id}`}
              key={quotation.id}
              className="quote-row"
            >
              <div>
                <span className="eyebrow">Phiên bản {quotation.version}</span>
                <strong>{formatMoney(quotation.totalAmount)}</strong>
                <small>Tạo {formatDateTime(quotation.createdAt)}</small>
              </div>
              <StatusBadge value={quotation.status} />
              <span>Chi tiết →</span>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
