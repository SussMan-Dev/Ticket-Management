import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { ConfirmDialog } from "../../components/ui/confirm-dialog";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  MutationError,
} from "../../components/ui/data-state";
import { PageHeader } from "../../components/ui/page-header";
import { StatusBadge } from "../../components/ui/status-badge";
import { formatDateTime, formatMoney } from "../../lib/formatting/formatters";
import { useAuth } from "../../lib/auth/use-auth";
import type { QuotationStatus } from "../../types/domain";
import { QuotationForm } from "./quotation-form";
import {
  visibleQuotationActions,
  type QuotationAction,
} from "./quotation.rules";
import { useQuotation, useTransitionQuotation } from "./quotations.api";

const actionCopy: Record<
  QuotationAction,
  {
    label: string;
    status?: QuotationStatus;
    title?: string;
    description?: string;
    danger?: boolean;
  }
> = {
  EDIT: { label: "Chỉnh sửa" },
  SUBMIT: { label: "Gửi chờ duyệt", status: "PENDING_APPROVAL" },
  APPROVE: {
    label: "Duyệt báo giá",
    status: "APPROVED",
    title: "Duyệt báo giá?",
    description: "Xác nhận nội dung và giá trị trước khi cho phép gửi khách hàng.",
  },
  SEND: {
    label: "Gửi khách hàng",
    status: "SENT",
    title: "Gửi báo giá?",
    description: "Khách hàng có thể chấp nhận hoặc từ chối khi báo giá còn hạn.",
  },
  ACCEPT: {
    label: "Chấp nhận báo giá",
    status: "ACCEPTED",
    title: "Chấp nhận báo giá?",
    description: "Xác nhận bạn đồng ý với các hạng mục và tổng chi phí trong báo giá.",
  },
  REJECT: {
    label: "Từ chối báo giá",
    status: "REJECTED",
    title: "Từ chối báo giá?",
    description: "Phiên bản hiện tại sẽ không thể được chấp nhận sau thao tác này.",
    danger: true,
  },
};

const itemTypeLabels = {
  LABOR: "Tiền công",
  PART: "Linh kiện",
  OTHER: "Chi phí khác",
} as const;

export function QuotationDetailPage() {
  const quotationId = Number(useParams().quotationId);
  const ticketId = Number(useParams().ticketId);
  const { user } = useAuth();
  const quotation = useQuotation(quotationId);
  const transition = useTransitionQuotation(ticketId, quotationId);
  const [editing, setEditing] = useState(false);
  const [confirm, setConfirm] = useState<QuotationAction | null>(null);

  if (quotation.isLoading) return <LoadingState />;
  if (quotation.isError) {
    return <ErrorState error={quotation.error} retry={() => void quotation.refetch()} />;
  }
  if (!quotation.data || !user) {
    return (
      <EmptyState
        title="Không tìm thấy báo giá"
        description="Báo giá không tồn tại hoặc bạn không có quyền xem."
        action={<Link to={`/tickets/${ticketId}`}>Về chi tiết phiếu</Link>}
      />
    );
  }

  const data = quotation.data;
  const actions = visibleQuotationActions(user.role, data);
  const act = (action: QuotationAction) => {
    if (action === "EDIT") {
      setEditing(true);
      return;
    }
    if (action === "SUBMIT") {
      transition.mutate("PENDING_APPROVAL");
      return;
    }
    setConfirm(action);
  };
  const confirmed = actionCopy[confirm ?? "EDIT"];

  return (
    <>
      <PageHeader
        eyebrow={`Báo giá · Phiên bản ${data.version}`}
        title="Chi tiết báo giá sửa chữa"
        description="Kiểm tra từng hạng mục, đơn giá và tổng chi phí trước khi xác nhận."
        actions={(
          <Link className="button button--secondary button--md" to={`/tickets/${ticketId}`}>
            ← Về phiếu
          </Link>
        )}
      />

      {editing ? (
        <QuotationForm
          ticketId={ticketId}
          quotation={data}
          onDone={() => setEditing(false)}
        />
      ) : (
        <Card>
          <div className="quote-summary">
            <div><span className="eyebrow">Trạng thái</span><StatusBadge value={data.status} /></div>
            <div><span className="eyebrow">Tổng tiền</span><strong>{formatMoney(data.totalAmount)}</strong></div>
            <div><span className="eyebrow">Hạn phản hồi</span><strong>{formatDateTime(data.expiresAt)}</strong></div>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Loại</th><th>Mô tả</th><th>Số lượng</th><th>Đơn giá</th><th>Thành tiền</th></tr>
              </thead>
              <tbody>
                {data.items.map((item) => (
                  <tr key={item.id}>
                    <td>{itemTypeLabels[item.itemType]}</td>
                    <td>{item.description}</td>
                    <td>{item.quantity}</td>
                    <td>{formatMoney(item.unitPrice)}</td>
                    <td><strong>{formatMoney(item.lineTotal)}</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <dl className="amount-summary">
            <div><dt>Tiền công</dt><dd>{formatMoney(data.laborAmount)}</dd></div>
            <div><dt>Tiền linh kiện</dt><dd>{formatMoney(data.partsAmount)}</dd></div>
            {data.otherAmount > 0 ? (
              <div><dt>Chi phí khác</dt><dd>{formatMoney(data.otherAmount)}</dd></div>
            ) : null}
            <div><dt>Thuế</dt><dd>{formatMoney(data.taxAmount)}</dd></div>
            <div><dt>Giảm giá</dt><dd>{formatMoney(data.discountAmount)}</dd></div>
            <div><dt>Tổng cộng</dt><dd>{formatMoney(data.totalAmount)}</dd></div>
          </dl>
          {data.customerResponseNote ? (
            <p className="read-only-note">Phản hồi khách hàng: {data.customerResponseNote}</p>
          ) : null}
          {actions.length === 0 ? (
            <p className="read-only-note">
              Báo giá này hiện không cần thêm thao tác hoặc đã qua thời hạn phản hồi.
            </p>
          ) : (
            <div className="form-actions">
              {actions.map((action) => (
                <Button
                  key={action}
                  variant={action === "REJECT" ? "danger" : action === "EDIT" ? "secondary" : "primary"}
                  onClick={() => act(action)}
                >
                  {actionCopy[action].label}
                </Button>
              ))}
            </div>
          )}
          <MutationError error={transition.error} />
        </Card>
      )}

      <ConfirmDialog
        open={confirm !== null}
        title={confirmed.title ?? "Xác nhận thao tác"}
        description={confirmed.description ?? "Bạn có chắc chắn muốn tiếp tục?"}
        confirmLabel={confirmed.label}
        danger={confirmed.danger}
        loading={transition.isPending}
        onClose={() => setConfirm(null)}
        onConfirm={() => {
          if (confirmed.status) {
            transition.mutate(confirmed.status, { onSuccess: () => setConfirm(null) });
          }
        }}
      />
    </>
  );
}
