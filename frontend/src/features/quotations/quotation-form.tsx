import { useState } from "react";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { MutationError } from "../../components/ui/data-state";
import { FormField } from "../../components/ui/form-field";
import type { Quotation } from "../../types/domain";
import { useCreateMockQuotation, useUpdateMockQuotation } from "./quotations.api";

interface Line { itemType: string; description: string; quantity: number; unitPrice: number }

export function QuotationForm({ ticketId, quotation, onDone }: { ticketId: number; quotation?: Quotation; onDone?(): void }) {
  const [expiresAt, setExpiresAt] = useState(quotation?.expiresAt?.slice(0, 16) ?? "");
  const [items, setItems] = useState<Line[]>(quotation?.items.map(({ itemType, description, quantity, unitPrice }) => ({ itemType, description, quantity, unitPrice })) ?? [{ itemType: "LABOR", description: "", quantity: 1, unitPrice: 0 }]);
  const create = useCreateMockQuotation(ticketId);
  const update = useUpdateMockQuotation(ticketId, quotation?.id ?? 0);
  const mutation = quotation ? update : create;
  const valid = items.length > 0 && items.every((item) => item.description.trim().length > 0 && item.quantity > 0 && item.unitPrice >= 0);
  const submit = async () => {
    if (!valid) return;
    await mutation.mutateAsync({ items, expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null });
    onDone?.();
  };
  const change = (index: number, patch: Partial<Line>) => setItems((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
  return <Card className="form-card quotation-mock"><div className="alert alert--warning"><strong>Mock adapter:</strong> Biểu mẫu này không gọi backend và không đại diện cho DTO Phase 6 cuối cùng.</div><MutationError error={mutation.error} /><FormField label="Hạn phản hồi" htmlFor="quote-expiry"><input id="quote-expiry" type="datetime-local" value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} /></FormField><div className="section-heading"><h3>Hạng mục báo giá mock</h3><Button type="button" size="sm" variant="secondary" onClick={() => setItems((current) => [...current, { itemType: "PART", description: "", quantity: 1, unitPrice: 0 }])}>+ Thêm dòng</Button></div>{items.map((item, index) => <div className="quote-line-form" key={index}><FormField label="Loại" htmlFor={`quote-type-${index}`}><select id={`quote-type-${index}`} value={item.itemType} onChange={(event) => change(index, { itemType: event.target.value })}><option value="LABOR">LABOR</option><option value="PART">PART</option><option value="OTHER">OTHER</option></select></FormField><FormField label="Mô tả" htmlFor={`quote-desc-${index}`}><input id={`quote-desc-${index}`} value={item.description} onChange={(event) => change(index, { description: event.target.value })} /></FormField><FormField label="Số lượng" htmlFor={`quote-qty-${index}`}><input id={`quote-qty-${index}`} type="number" min={1} value={item.quantity} onChange={(event) => change(index, { quantity: Number(event.target.value) })} /></FormField><FormField label="Đơn giá mock" htmlFor={`quote-price-${index}`}><input id={`quote-price-${index}`} type="number" min={0} step="0.01" value={item.unitPrice} onChange={(event) => change(index, { unitPrice: Number(event.target.value) })} /></FormField><Button type="button" variant="ghost" size="sm" disabled={items.length === 1} onClick={() => setItems((current) => current.filter((_, itemIndex) => itemIndex !== index))}>Xóa</Button></div>)}<Button type="button" disabled={!valid} loading={mutation.isPending} onClick={() => void submit()}>{quotation ? "Lưu bản nháp mock" : "Tạo bản nháp mock"}</Button></Card>;
}
