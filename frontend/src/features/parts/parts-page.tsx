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
import { PageHeader } from "../../components/ui/page-header";
import { Pagination } from "../../components/ui/pagination";
import { formatDateTime, formatMoney } from "../../lib/formatting/formatters";
import { useAuth } from "../../lib/auth/use-auth";
import type { InventoryTransactionType, Part } from "../../types/domain";
import {
  useAdjustStock,
  useCreatePart,
  useParts,
  usePartTransactions,
  useStockIn,
  useUpdatePart,
  type PartInput,
} from "./parts.api";

const emptyPart: PartInput = {
  sku: "",
  name: "",
  description: null,
  unit: "piece",
  purchasePrice: 0,
  sellingPrice: 0,
  minimumStock: 0,
  isActive: true,
};

const inventoryTransactionLabels: Record<InventoryTransactionType, string> = {
  STOCK_IN: "Nhập kho",
  STOCK_OUT: "Xuất kho",
  ADJUSTMENT_IN: "Điều chỉnh tăng",
  ADJUSTMENT_OUT: "Điều chỉnh giảm",
  RETURN: "Hoàn kho",
};

export function PartsPage() {
  const { user } = useAuth();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [lowStock, setLowStock] = useState(false);
  const [editing, setEditing] = useState<Part | null>(null);
  const [creating, setCreating] = useState(false);
  const [movement, setMovement] = useState<Part | null>(null);
  const [history, setHistory] = useState<Part | null>(null);
  const parts = useParts({
    page,
    limit: 20,
    search: search || undefined,
    lowStock: lowStock || undefined,
    sortBy: "name",
    sortOrder: "asc",
  });
  if (!user) return null;
  const canManage = user.role === "INVENTORY_STAFF";
  const pageCopy = user.role === "INVENTORY_STAFF"
    ? { eyebrow: "Quản lý kho", description: "Theo dõi tồn kho, giá bán và ghi nhận mọi lần nhập hoặc điều chỉnh." }
    : user.role === "TECHNICIAN"
      ? { eyebrow: "Tra cứu linh kiện", description: "Xem linh kiện đang sử dụng và số lượng hiện có để lập yêu cầu cấp kho." }
      : { eyebrow: "Theo dõi kho", description: "Kiểm tra tồn kho, giá và lịch sử biến động để hỗ trợ điều phối." };

  return (
    <>
      <PageHeader
        eyebrow={pageCopy.eyebrow}
        title="Linh kiện và tồn kho"
        description={pageCopy.description}
        actions={canManage ? (
          <Button onClick={() => { setCreating((value) => !value); setEditing(null); }}>
            {creating ? "Đóng" : "+ Tạo linh kiện"}
          </Button>
        ) : undefined}
      />
      {creating ? <PartForm onDone={() => setCreating(false)} /> : null}
      {editing ? <PartForm part={editing} onDone={() => setEditing(null)} /> : null}
      {movement ? <StockMovementForm part={movement} onDone={() => setMovement(null)} /> : null}
      {history ? <InventoryHistory part={history} onClose={() => setHistory(null)} /> : null}

      <Card className="inventory-page-card">
        <div className="toolbar inventory-toolbar">
          <label className="search-field">
            <span className="sr-only">Tìm linh kiện</span>
            <input
              value={search}
              onChange={(event) => { setSearch(event.target.value); setPage(1); }}
              placeholder="Tìm SKU, tên hoặc mô tả…"
            />
          </label>
          <label className="check-field">
            <input
              type="checkbox"
              checked={lowStock}
              onChange={(event) => { setLowStock(event.target.checked); setPage(1); }}
            />
            <span><strong>Sắp hết hàng</strong><small>Tồn kho ≤ mức tối thiểu</small></span>
          </label>
        </div>
        {parts.isLoading ? <LoadingState /> : parts.isError ? (
          <ErrorState error={parts.error} retry={() => void parts.refetch()} />
        ) : (parts.data?.data ?? []).length === 0 ? (
          <EmptyState title="Không có linh kiện" description="Thử thay đổi bộ lọc hoặc thêm linh kiện mới." />
        ) : (
          <div className="table-wrap inventory-table-wrap">
            <table className="inventory-table inventory-parts-table">
              <thead>
                <tr>
                  <th>Linh kiện</th><th>Đơn vị</th><th>Giá bán</th>
                  {user.role !== "TECHNICIAN" ? <th>Giá mua</th> : null}
                  <th>Tồn kho</th><th>Trạng thái</th><th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {(parts.data?.data ?? []).map((part) => (
                  <tr key={part.id}>
                    <td><strong>{part.name}</strong><small>{part.sku}</small></td>
                    <td>{part.unit === "piece" ? "cái" : part.unit}</td>
                    <td>{formatMoney(part.sellingPrice)}</td>
                    {user.role !== "TECHNICIAN" ? <td>{formatMoney(part.purchasePrice ?? 0)}</td> : null}
                    <td>
                      <strong>{part.quantityOnHand}</strong>
                      <small>Tối thiểu {part.minimumStock}</small>
                    </td>
                    <td>
                      <span className={`badge ${!part.isActive ? "badge--info" : part.isLowStock ? "badge--warning" : "badge--success"}`}>
                        {part.isActive ? (part.isLowStock ? "Sắp hết" : "Đang sử dụng") : "Tạm ngưng"}
                      </span>
                    </td>
                    <td>
                      <div className="button-row inventory-table-actions">
                        {canManage ? (
                          <>
                            <Button size="sm" variant="secondary" onClick={() => setEditing(part)}>Sửa</Button>
                            <Button size="sm" onClick={() => setMovement(part)}>Nhập/điều chỉnh</Button>
                          </>
                        ) : null}
                        {user.role !== "TECHNICIAN" ? (
                          <Button size="sm" variant="ghost" onClick={() => setHistory(part)}>Lịch sử</Button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pagination
          page={page}
          totalPages={parts.data?.meta.totalPages ?? 1}
          onChange={setPage}
        />
      </Card>
    </>
  );
}

function PartForm({ part, onDone }: { part?: Part; onDone(): void }) {
  const [values, setValues] = useState<PartInput>(part ? {
    sku: part.sku,
    name: part.name,
    description: part.description,
    unit: part.unit,
    purchasePrice: part.purchasePrice ?? 0,
    sellingPrice: part.sellingPrice,
    minimumStock: part.minimumStock,
    isActive: part.isActive,
  } : emptyPart);
  const create = useCreatePart();
  const update = useUpdatePart(part?.id ?? 0);
  const mutation = part ? update : create;
  const set = <K extends keyof PartInput>(key: K, value: PartInput[K]) =>
    setValues((current) => ({ ...current, [key]: value }));
  const valid = values.sku.trim().length > 0 && values.name.trim().length >= 2 &&
    values.unit.trim().length > 0 && values.purchasePrice >= 0 &&
    values.sellingPrice >= 0 && values.minimumStock >= 0;
  const submit = async () => {
    if (!valid) return;
    await mutation.mutateAsync({
      ...values,
      sku: values.sku.trim().toUpperCase(),
      name: values.name.trim(),
      description: values.description?.trim() || null,
      unit: values.unit.trim(),
    });
    onDone();
  };
  return (
    <Card className="form-card inventory-form-card">
      <div className="section-heading"><h2>{part ? `Sửa ${part.sku}` : "Tạo linh kiện"}</h2><Button variant="ghost" onClick={onDone}>Đóng</Button></div>
      <MutationError error={mutation.error} />
      <div className="form-grid">
        <FormField label="SKU" htmlFor="part-sku" required><input id="part-sku" value={values.sku} onChange={(event) => set("sku", event.target.value)} /></FormField>
        <FormField label="Tên" htmlFor="part-name" required><input id="part-name" value={values.name} onChange={(event) => set("name", event.target.value)} /></FormField>
        <FormField label="Đơn vị" htmlFor="part-unit" required><input id="part-unit" value={values.unit} onChange={(event) => set("unit", event.target.value)} /></FormField>
        <FormField label="Mức tồn tối thiểu" htmlFor="part-min"><input id="part-min" type="number" min={0} value={values.minimumStock} onChange={(event) => set("minimumStock", Number(event.target.value))} /></FormField>
        <FormField label="Giá mua (VNĐ)" htmlFor="part-purchase"><input id="part-purchase" type="number" min={0} step="0.01" value={values.purchasePrice} onChange={(event) => set("purchasePrice", Number(event.target.value))} /></FormField>
        <FormField label="Giá bán (VNĐ)" htmlFor="part-selling"><input id="part-selling" type="number" min={0} step="0.01" value={values.sellingPrice} onChange={(event) => set("sellingPrice", Number(event.target.value))} /></FormField>
      </div>
      <FormField label="Mô tả" htmlFor="part-description"><textarea id="part-description" rows={2} value={values.description ?? ""} onChange={(event) => set("description", event.target.value)} /></FormField>
      <label className="check-field"><input type="checkbox" checked={values.isActive} onChange={(event) => set("isActive", event.target.checked)} /><span><strong>Đang sử dụng</strong><small>Chỉ linh kiện đang sử dụng mới có thể được chọn trong yêu cầu cấp kho mới.</small></span></label>
      <Button disabled={!valid} loading={mutation.isPending} onClick={() => void submit()}>{part ? "Lưu thay đổi" : "Tạo linh kiện"}</Button>
    </Card>
  );
}

function StockMovementForm({ part, onDone }: { part: Part; onDone(): void }) {
  const [mode, setMode] = useState<"STOCK_IN" | "ADJUST">("STOCK_IN");
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState("");
  const stockIn = useStockIn(part.id);
  const adjust = useAdjustStock(part.id);
  const mutation = mode === "STOCK_IN" ? stockIn : adjust;
  const valid = note.trim().length >= 3 && quantity !== 0 &&
    (mode === "ADJUST" || quantity > 0);
  const submit = async () => {
    if (!valid) return;
    if (mode === "STOCK_IN") await stockIn.mutateAsync({ quantity, note: note.trim() });
    else await adjust.mutateAsync({ quantityChange: quantity, note: note.trim() });
    onDone();
  };
  return (
    <Card className="form-card inventory-form-card">
      <div className="section-heading"><div><h2>Biến động kho · {part.sku}</h2><p>Tồn hiện tại: {part.quantityOnHand} {part.unit}</p></div><Button variant="ghost" onClick={onDone}>Đóng</Button></div>
      <MutationError error={mutation.error} />
      <div className="form-grid">
        <FormField label="Loại" htmlFor="stock-mode"><select id="stock-mode" value={mode} onChange={(event) => { setMode(event.target.value as typeof mode); setQuantity(1); }}><option value="STOCK_IN">Nhập kho</option><option value="ADJUST">Điều chỉnh chênh lệch</option></select></FormField>
        <FormField label={mode === "STOCK_IN" ? "Số lượng nhập" : "Chênh lệch (+/−)"} htmlFor="stock-quantity" required><input id="stock-quantity" type="number" min={mode === "STOCK_IN" ? 1 : undefined} value={quantity} onChange={(event) => setQuantity(Number(event.target.value))} /></FormField>
      </div>
      <FormField label="Lý do" htmlFor="stock-note" required hint="Tối thiểu 3 ký tự; nội dung được giữ trong lịch sử kho."><textarea id="stock-note" rows={2} value={note} onChange={(event) => setNote(event.target.value)} /></FormField>
      <Button disabled={!valid} loading={mutation.isPending} onClick={() => void submit()}>Ghi biến động</Button>
    </Card>
  );
}

function InventoryHistory({ part, onClose }: { part: Part; onClose(): void }) {
  const transactions = usePartTransactions(part.id, { page: 1, limit: 50 });
  return (
    <Card>
      <div className="section-heading"><div><h2>Lịch sử kho · {part.sku}</h2><p>Mọi lần nhập, xuất và điều chỉnh được sắp xếp từ mới nhất.</p></div><Button variant="ghost" onClick={onClose}>Đóng</Button></div>
      {transactions.isLoading ? <LoadingState rows={3} /> : transactions.isError ? <ErrorState error={transactions.error} /> : (transactions.data?.data ?? []).length === 0 ? <EmptyState title="Chưa có biến động" description="Lịch sử sẽ xuất hiện sau lần nhập, xuất hoặc điều chỉnh đầu tiên." /> : (
        <div className="table-wrap inventory-table-wrap"><table className="inventory-table inventory-history-table"><thead><tr><th>Thời gian</th><th>Loại</th><th>Số lượng</th><th>Trước → Sau</th><th>Người thực hiện</th><th>Ghi chú</th></tr></thead><tbody>{(transactions.data?.data ?? []).map((item) => <tr key={item.id}><td>{formatDateTime(item.createdAt)}</td><td>{inventoryTransactionLabels[item.transactionType]}</td><td>{item.quantity}</td><td>{item.quantityBefore} → {item.quantityAfter}</td><td>{item.performedBy.fullName}</td><td>{item.note ?? "—"}</td></tr>)}</tbody></table></div>
      )}
    </Card>
  );
}
