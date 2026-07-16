import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "../../components/ui/button";
import { ConfirmDialog } from "../../components/ui/confirm-dialog";
import { EmptyState, ErrorState, LoadingState, MutationError } from "../../components/ui/data-state";
import { StatusBadge } from "../../components/ui/status-badge";
import { formatDateTime, formatMoney } from "../../lib/formatting/formatters";
import { useAuth } from "../../lib/auth/use-auth";
import type { Diagnosis, Quotation, RepairTicket } from "../../types/domain";
import { QuotationForm } from "./quotation-form";
import { isQuotationExpired } from "./quotation.rules";
import { useQuotations, useTransitionQuotation } from "./quotations.api";

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
          <span className="eyebrow">Chi phí sửa chữa</span>
          <h2 id="quotation-title">Lịch sử báo giá</h2>
          <p>Mỗi lần điều chỉnh được lưu riêng để bạn dễ theo dõi và đối chiếu.</p>
        </div>
        {canCreate ? (
          <Button variant="secondary" onClick={() => setCreating((value) => !value)}>
            {creating ? "Đóng" : "+ Tạo báo giá"}
          </Button>
        ) : null}
      </div>

      {canCreate && !creating ? (
        <div className="alert alert--info">
          Chẩn đoán đã được duyệt. Quản lý cần tạo, duyệt và gửi báo giá trước khi khách hàng có thể phản hồi.
        </div>
      ) : null}

      {creating ? (
        <QuotationForm ticketId={ticket.id} onDone={() => setCreating(false)} />
      ) : null}

      {user.role === "CUSTOMER" && latestQuotation ? (
        <CustomerQuotationResponse ticketId={ticket.id} quotation={latestQuotation} />
      ) : null}

      {data.length === 0 ? (
        <EmptyState
          title="Chưa có báo giá"
          description={canCreate
            ? "Tạo bản nháp từ chẩn đoán đã được duyệt."
            : user.role === "CUSTOMER"
              ? "Quản lý chưa tạo và gửi báo giá. Khi báo giá được gửi, nút chấp nhận hoặc từ chối sẽ xuất hiện ngay tại đây."
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

export function CustomerQuotationResponse({
  ticketId,
  quotation,
}: {
  ticketId: number;
  quotation: Quotation;
}) {
  const transition = useTransitionQuotation(ticketId, quotation.id);
  const [response, setResponse] = useState<"ACCEPTED" | "REJECTED" | null>(null);
  if (quotation.status !== "SENT" || isQuotationExpired(quotation)) return null;
  const accepting = response === "ACCEPTED";

  return <div className="customer-quote-response"><div><span className="eyebrow">Cần phản hồi</span><h3>Báo giá {formatMoney(quotation.totalAmount)}</h3><p>Hạn phản hồi: {formatDateTime(quotation.expiresAt)}. Kiểm tra hạng mục trước khi xác nhận.</p></div><div className="customer-quote-response__actions"><Link className="button button--secondary button--md" to={`/tickets/${ticketId}/quotations/${quotation.id}`}>Xem chi tiết</Link><Button onClick={() => setResponse("ACCEPTED")}>Chấp nhận báo giá</Button><Button variant="danger" onClick={() => setResponse("REJECTED")}>Từ chối</Button></div><MutationError error={transition.error} /><ConfirmDialog open={response !== null} title={accepting ? "Chấp nhận báo giá?" : "Từ chối báo giá?"} description={accepting ? `Bạn đồng ý với tổng giá trị ${formatMoney(quotation.totalAmount)} và các hạng mục đã gửi.` : "Báo giá hiện tại sẽ không thể được chấp nhận sau khi từ chối."} confirmLabel={accepting ? "Xác nhận chấp nhận" : "Xác nhận từ chối"} danger={!accepting} loading={transition.isPending} onClose={() => setResponse(null)} onConfirm={() => { if (response) transition.mutate(response, { onSuccess: () => setResponse(null) }); }} /></div>;
}
