import { useState } from "react";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  MutationError,
} from "../../components/ui/data-state";
import { FormField } from "../../components/ui/form-field";
import { StatusBadge } from "../../components/ui/status-badge";
import { useAuth } from "../../lib/auth/use-auth";
import { formatMoney } from "../../lib/formatting/formatters";
import type { RepairTicket } from "../../types/domain";
import { useParts } from "../parts/parts.api";
import { useCreatePartRequest, usePartRequests } from "./inventory.api";
import { RequestItems } from "./part-requests-page";

interface RequestLine { partId: number; requestedQuantity: number }

export function PartRequestPanel({ ticket }: { ticket: RepairTicket }) {
  const { user } = useAuth();
  const requests = usePartRequests({ page: 1, limit: 50, ticketId: ticket.id });
  const [creating, setCreating] = useState(false);
  if (!user || !["TECHNICIAN", "MANAGER"].includes(user.role)) return null;
  if (requests.isLoading) return <LoadingState rows={2} />;
  if (requests.isError) return <ErrorState error={requests.error} retry={() => void requests.refetch()} />;
  const canCreate = user.role === "TECHNICIAN" &&
    ["WAITING_FOR_PARTS", "REPAIRING"].includes(ticket.status);
  const data = requests.data?.data ?? [];

  return (
    <section className="detail-section inventory-request-panel" aria-labelledby="part-request-title">
      <div className="section-heading inventory-request-heading">
        <div><span className="eyebrow">Cấp linh kiện</span><h2 id="part-request-title">Yêu cầu linh kiện</h2></div>
        {canCreate ? <Button variant="secondary" onClick={() => setCreating((value) => !value)}>{creating ? "Đóng" : "+ Tạo yêu cầu"}</Button> : null}
      </div>
      {canCreate ? <div className="alert alert--info">Yêu cầu sẽ chốt đơn giá hiện tại. Kho phải duyệt và chỉ số lượng thực tế được cấp mới được cộng vào hóa đơn.</div> : null}
      {creating ? <CreateRequestForm ticketId={ticket.id} onDone={() => setCreating(false)} /> : null}
      {data.length === 0 ? <EmptyState title="Chưa có yêu cầu linh kiện" description="Kỹ thuật viên được phân công có thể gửi yêu cầu khi phiếu đang chờ linh kiện hoặc đang sửa chữa." /> : data.map((request) => (
        <Card key={request.id} className="diagnosis-card inventory-request-card">
          <div className="section-heading"><strong>Yêu cầu #{request.id}</strong><StatusBadge value={request.status} /></div>
          {request.note ? <p>{request.note}</p> : null}
          <RequestItems request={request} />
        </Card>
      ))}
    </section>
  );
}

function CreateRequestForm({ ticketId, onDone }: { ticketId: number; onDone(): void }) {
  const [search, setSearch] = useState("");
  const catalog = useParts({
    page: 1,
    limit: 100,
    search: search || undefined,
    isActive: true,
    sortBy: "name",
    sortOrder: "asc",
  });
  const [items, setItems] = useState<RequestLine[]>([{ partId: 0, requestedQuantity: 1 }]);
  const [note, setNote] = useState("");
  const create = useCreatePartRequest(ticketId);
  const partOptions = catalog.data?.data ?? [];
  const valid = items.length > 0 && items.every((item) =>
    item.partId > 0 && item.requestedQuantity > 0) &&
    new Set(items.map((item) => item.partId)).size === items.length;
  const change = (index: number, patch: Partial<RequestLine>) => setItems((current) =>
    current.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
  const submit = async () => {
    if (!valid) return;
    await create.mutateAsync({ items, note: note.trim() || null });
    onDone();
  };
  return (
    <Card className="form-card inventory-request-form">
      <MutationError error={create.error} />
      <FormField label="Tìm linh kiện" htmlFor="request-part-search"><input id="request-part-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="SKU hoặc tên…" /></FormField>
      {items.map((item, index) => (
        <div className="part-row inventory-request-row" key={index}>
          <FormField label="Linh kiện" htmlFor={`request-part-${index}`} required>
            <select id={`request-part-${index}`} value={item.partId} onChange={(event) => change(index, { partId: Number(event.target.value) })}>
              <option value={0}>Chọn linh kiện</option>
              {partOptions.map((part) => <option key={part.id} value={part.id}>{part.sku} · {part.name} · {formatMoney(part.sellingPrice)} (tồn {part.quantityOnHand})</option>)}
            </select>
          </FormField>
          <FormField label="Số lượng" htmlFor={`request-quantity-${index}`} required><input id={`request-quantity-${index}`} type="number" min={1} value={item.requestedQuantity} onChange={(event) => change(index, { requestedQuantity: Number(event.target.value) })} /></FormField>
          <Button className="inventory-request-row__remove" type="button" variant="ghost" size="sm" disabled={items.length === 1} onClick={() => setItems((current) => current.filter((_, itemIndex) => itemIndex !== index))}>Xóa</Button>
        </div>
      ))}
      <Button type="button" size="sm" variant="secondary" onClick={() => setItems((current) => [...current, { partId: 0, requestedQuantity: 1 }])}>+ Thêm linh kiện</Button>
      <FormField label="Ghi chú" htmlFor="request-note"><textarea id="request-note" rows={2} value={note} onChange={(event) => setNote(event.target.value)} /></FormField>
      <Button disabled={!valid} loading={create.isPending} onClick={() => void submit()}>Gửi yêu cầu cấp linh kiện</Button>
    </Card>
  );
}
