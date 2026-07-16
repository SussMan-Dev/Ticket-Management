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
import { usePublishQuotation, useQuotation, useTransitionQuotation } from "./quotations.api";

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
  PUBLISH: {
    label: "Duyệt và gửi dự toán",
    title: "Duyệt và gửi dự toán?",
    description: "Dự toán sẽ được duyệt và gửi ngay. Khách hàng có thể đồng ý hoặc từ chối sửa chữa khi dự toán còn hạn.",
  },
  ACCEPT: {
    label: "Đồng ý sửa chữa",
    status: "ACCEPTED",
    title: "Đồng ý sửa chữa theo dự toán?",
    description: "Dự toán giúp quyết định sửa chữa, không phải số tiền hóa đơn cố định. Hóa đơn sẽ cộng tiền công/dịch vụ và linh kiện kho thực tế cấp.",
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
  PART: "Linh kiện dự kiến",
  OTHER: "Chi phí khác",
} as const;

export function QuotationDetailPage() {
  const quotationId = Number(useParams().quotationId);
  const ticketId = Number(useParams().ticketId);
  const { user } = useAuth();
  const quotation = useQuotation(quotationId);
  const transition = useTransitionQuotation(ticketId, quotationId);
  const publish = usePublishQuotation(ticketId, quotationId);
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
    setConfirm(action);
  };
  const confirmed = actionCopy[confirm ?? "EDIT"];

  return (
    <>
      <PageHeader
        eyebrow={`Báo giá · Phiên bản ${data.version}`}
        title="Chi tiết dự toán sửa chữa"
        description="Dự toán dùng để khách quyết định sửa chữa. Hóa đơn cuối cùng sẽ căn cứ tiền công/dịch vụ và linh kiện kho thực tế cấp."
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
            <div><span className="eyebrow">Tổng dự toán</span><strong>{formatMoney(data.totalAmount)}</strong></div>
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
            <div><dt>Linh kiện dự kiến</dt><dd>{formatMoney(data.partsAmount)}</dd></div>
            {data.otherAmount > 0 ? (
              <div><dt>Chi phí khác</dt><dd>{formatMoney(data.otherAmount)}</dd></div>
            ) : null}
            <div><dt>Thuế</dt><dd>{formatMoney(data.taxAmount)}</dd></div>
            <div><dt>Giảm giá</dt><dd>{formatMoney(data.discountAmount)}</dd></div>
            <div><dt>Tổng dự toán</dt><dd>{formatMoney(data.totalAmount)}</dd></div>
          </dl>
          <p className="read-only-note">Linh kiện trong dự toán không tự động yêu cầu kho và không được lấy nguyên số lượng này để tính hóa đơn. Chỉ linh kiện thợ yêu cầu trong lúc sửa và kho thực tế cấp mới được cộng.</p>
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
          <MutationError error={publish.error ?? transition.error} />
        </Card>
      )}

      <ConfirmDialog
        open={confirm !== null}
        title={confirmed.title ?? "Xác nhận thao tác"}
        description={confirmed.description ?? "Bạn có chắc chắn muốn tiếp tục?"}
        confirmLabel={confirmed.label}
        danger={confirmed.danger}
        loading={publish.isPending || transition.isPending}
        onClose={() => setConfirm(null)}
        onConfirm={() => {
          if (confirm === "PUBLISH") {
            publish.mutate(data.status, { onSuccess: () => setConfirm(null) });
          } else if (confirmed.status) {
            transition.mutate(confirmed.status, { onSuccess: () => setConfirm(null) });
          }
        }}
      />
    </>
  );
}
