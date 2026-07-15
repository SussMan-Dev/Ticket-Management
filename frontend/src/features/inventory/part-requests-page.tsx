import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  MutationError,
} from "../../components/ui/data-state";
import { FormField } from "../../components/ui/form-field";
import { PageHeader } from "../../components/ui/page-header";
import { Pagination } from "../../components/ui/pagination";
import { StatusBadge } from "../../components/ui/status-badge";
import { formatDateTime } from "../../lib/formatting/formatters";
import { useAuth } from "../../lib/auth/use-auth";
import type { PartRequest, PartRequestStatus } from "../../types/domain";
import {
  useApprovePartRequest,
  useFulfillPartRequest,
  usePartRequests,
  useRejectPartRequest,
} from "./inventory.api";

const filterStatuses: Array<PartRequestStatus | ""> = [
  "",
  "PENDING",
  "APPROVED",
  "PARTIALLY_FULFILLED",
  "FULFILLED",
  "REJECTED",
];

export function PartRequestsPage() {
  const { user } = useAuth();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<PartRequestStatus | "">("");
  const requests = usePartRequests({
    page,
    limit: 20,
    status: status || undefined,
  });
  if (!user) return null;

  return (
    <>
      <PageHeader
        eyebrow="Phase 7 · Part requests"
        title="Yêu cầu linh kiện"
        description={user.role === "TECHNICIAN"
          ? "Chỉ các request do bạn tạo được backend trả về."
          : "Theo dõi duyệt, cấp một phần và hoàn tất cấp linh kiện."}
      />
      <Card>
        <div className="toolbar">
          <FormField label="Trạng thái" htmlFor="request-status">
            <select
              id="request-status"
              value={status}
              onChange={(event) => {
                setStatus(event.target.value as PartRequestStatus | "");
                setPage(1);
              }}
            >
              {filterStatuses.map((value) => (
                <option key={value || "ALL"} value={value}>{value || "Tất cả"}</option>
              ))}
            </select>
          </FormField>
        </div>
        {requests.isLoading ? <LoadingState /> : requests.isError ? (
          <ErrorState error={requests.error} retry={() => void requests.refetch()} />
        ) : (requests.data?.data ?? []).length === 0 ? (
          <EmptyState title="Không có yêu cầu" description="Yêu cầu phù hợp bộ lọc sẽ xuất hiện tại đây." />
        ) : (
          <div className="request-list">
            {(requests.data?.data ?? []).map((request) => (
              <Card key={request.id} className="diagnosis-card">
                <div className="section-heading">
                  <div>
                    <span className="eyebrow">Request #{request.id}</span>
                    <h2>{user.role === "INVENTORY_STAFF" ? request.ticket.ticketCode : <Link to={`/tickets/${request.ticket.id}`}>{request.ticket.ticketCode}</Link>}</h2>
                    <p>{request.requestedBy.fullName} · {formatDateTime(request.createdAt)}</p>
                  </div>
                  <StatusBadge value={request.status} />
                </div>
                {request.note ? <p>{request.note}</p> : null}
                <RequestItems request={request} />
                {user.role === "INVENTORY_STAFF" ? (
                  <InventoryRequestActions request={request} />
                ) : null}
              </Card>
            ))}
          </div>
        )}
        <Pagination
          page={page}
          totalPages={requests.data?.meta.totalPages ?? 1}
          onChange={setPage}
        />
      </Card>
    </>
  );
}

export function RequestItems({ request }: { request: PartRequest }) {
  return (
    <div className="table-wrap">
      <table>
        <thead><tr><th>Linh kiện</th><th>Yêu cầu</th><th>Đã cấp</th><th>Còn lại</th><th>Tồn kho</th></tr></thead>
        <tbody>
          {request.items.map((item) => (
            <tr key={item.id}>
              <td><strong>{item.part.name}</strong><small>{item.part.sku}</small></td>
              <td>{item.requestedQuantity} {item.part.unit}</td>
              <td>{item.fulfilledQuantity}</td>
              <td>{item.remainingQuantity}</td>
              <td>{item.part.quantityOnHand}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function InventoryRequestActions({ request }: { request: PartRequest }) {
  const approve = useApprovePartRequest(request.id);
  const reject = useRejectPartRequest(request.id);
  const fulfill = useFulfillPartRequest(request.id);
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [quantities, setQuantities] = useState<Record<number, number>>({});
  const fulfillmentItems = request.items
    .map((item) => ({ partId: item.part.id, quantity: quantities[item.part.id] ?? 0 }))
    .filter((item) => item.quantity > 0);
  const fulfillmentValid = fulfillmentItems.length > 0 && fulfillmentItems.every((input) => {
    const item = request.items.find((candidate) => candidate.part.id === input.partId);
    return !!item && Number.isInteger(input.quantity) && input.quantity <= item.remainingQuantity;
  });

  if (request.status === "PENDING") {
    return (
      <div className="review-actions">
        <div>
          <FormField label="Lý do từ chối" htmlFor={`reject-${request.id}`}>
            <textarea id={`reject-${request.id}`} rows={2} value={reason} onChange={(event) => setReason(event.target.value)} />
          </FormField>
          <Button variant="danger" disabled={reason.trim().length < 3} loading={reject.isPending} onClick={() => reject.mutate(reason.trim())}>Từ chối</Button>
        </div>
        <Button loading={approve.isPending} onClick={() => approve.mutate("Stock reviewed")}>Duyệt request</Button>
        <MutationError error={approve.error ?? reject.error} />
      </div>
    );
  }
  if (request.status !== "APPROVED" && request.status !== "PARTIALLY_FULFILLED") {
    return null;
  }
  return (
    <div className="form-card">
      <h3>Cấp linh kiện</h3>
      <div className="form-grid">
        {request.items.filter((item) => item.remainingQuantity > 0).map((item) => (
          <FormField
            key={item.id}
            label={`${item.part.sku} (còn ${item.remainingQuantity}, kho ${item.part.quantityOnHand})`}
            htmlFor={`fulfill-${request.id}-${item.part.id}`}
          >
            <input
              id={`fulfill-${request.id}-${item.part.id}`}
              type="number"
              min={0}
              max={item.remainingQuantity}
              value={quantities[item.part.id] ?? 0}
              onChange={(event) => setQuantities((current) => ({
                ...current,
                [item.part.id]: Number(event.target.value),
              }))}
            />
          </FormField>
        ))}
      </div>
      <FormField label="Ghi chú cấp kho" htmlFor={`fulfill-note-${request.id}`}>
        <textarea id={`fulfill-note-${request.id}`} rows={2} value={note} onChange={(event) => setNote(event.target.value)} />
      </FormField>
      <Button
        disabled={!fulfillmentValid}
        loading={fulfill.isPending}
        onClick={() => fulfill.mutate({ items: fulfillmentItems, note: note.trim() || null })}
      >
        Ghi nhận cấp kho
      </Button>
      <MutationError error={fulfill.error} />
    </div>
  );
}
