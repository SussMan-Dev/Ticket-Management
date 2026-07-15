import { useState } from "react";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { MutationError } from "../../components/ui/data-state";
import { FormField } from "../../components/ui/form-field";
import type { Quotation } from "../../types/domain";
import type { QuotationDraftItem } from "./quotation.gateway";
import { useCreateQuotation, useUpdateQuotation } from "./quotations.api";

interface Line {
  itemType: "LABOR" | "PART" | "OTHER";
  partId: number | null;
  description: string;
  quantity: number;
  unitPrice: number;
}

function initialLines(quotation?: Quotation): Line[] {
  return quotation?.items.map((item) => ({
    itemType: item.itemType,
    partId: item.partId,
    description: item.description,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
  })) ?? [];
}

function toLocalDateTimeInput(value: string | null | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16);
}

export function QuotationForm({
  ticketId,
  quotation,
  onDone,
}: {
  ticketId: number;
  quotation?: Quotation;
  onDone?(): void;
}) {
  const [expiresAt, setExpiresAt] = useState(
    toLocalDateTimeInput(quotation?.expiresAt),
  );
  const [items, setItems] = useState<Line[]>(initialLines(quotation));
  const create = useCreateQuotation(ticketId);
  const update = useUpdateQuotation(ticketId, quotation?.id ?? 0);
  const mutation = quotation ? update : create;
  const validItems = items.length > 0 && items.every((item) =>
    item.quantity > 0 && (
      item.itemType === "PART"
        ? !!item.partId && item.partId > 0
        : item.description.trim().length > 0 && item.unitPrice >= 0
    ));
  const valid = !!expiresAt && (!quotation || validItems);

  const submit = async () => {
    if (!valid) return;
    const expiry = new Date(expiresAt).toISOString();
    if (!quotation) {
      await create.mutateAsync({ expiresAt: expiry });
    } else {
      const normalized: QuotationDraftItem[] = items.map((item) =>
        item.itemType === "PART"
          ? { itemType: "PART", partId: item.partId ?? 0, quantity: item.quantity }
          : {
              itemType: item.itemType,
              description: item.description.trim(),
              quantity: item.quantity,
              unitPrice: item.unitPrice,
            });
      await update.mutateAsync({ expiresAt: expiry, items: normalized });
    }
    onDone?.();
  };

  const change = (index: number, patch: Partial<Line>) =>
    setItems((current) => current.map((item, itemIndex) =>
      itemIndex === index ? { ...item, ...patch } : item));

  return (
    <Card className="form-card">
      <h3>{quotation ? "Chỉnh sửa bản nháp" : "Tạo báo giá từ chẩn đoán"}</h3>
      <p className="muted">
        {quotation
          ? "Giá linh kiện được lấy lại từ catalog khi lưu; tổng tiền do server tính."
          : "Server sẽ chụp tiền công và linh kiện từ chẩn đoán đã duyệt."}
      </p>
      <MutationError error={mutation.error} />
      <FormField label="Hạn phản hồi" htmlFor="quote-expiry" required>
        <input
          id="quote-expiry"
          type="datetime-local"
          min={toLocalDateTimeInput(new Date().toISOString())}
          value={expiresAt}
          onChange={(event) => setExpiresAt(event.target.value)}
        />
      </FormField>

      {quotation ? (
        <>
          <div className="section-heading">
            <div>
              <h3>Hạng mục báo giá</h3>
              <p>PART chỉ gửi ID và số lượng; mô tả, đơn giá được server chụp lại.</p>
            </div>
            <div className="form-actions">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => setItems((current) => [...current, {
                  itemType: "LABOR",
                  partId: null,
                  description: "",
                  quantity: 1,
                  unitPrice: 0,
                }])}
              >
                + Dịch vụ
              </Button>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => setItems((current) => [...current, {
                  itemType: "PART",
                  partId: null,
                  description: "",
                  quantity: 1,
                  unitPrice: 0,
                }])}
              >
                + Linh kiện
              </Button>
            </div>
          </div>
          {items.map((item, index) => (
            <div className="quote-line-form" key={`${index}-${item.itemType}`}>
              <FormField label="Loại" htmlFor={`quote-type-${index}`}>
                <select
                  id={`quote-type-${index}`}
                  value={item.itemType}
                  onChange={(event) => change(index, {
                    itemType: event.target.value as Line["itemType"],
                    partId: event.target.value === "PART" ? item.partId : null,
                  })}
                >
                  <option value="LABOR">LABOR</option>
                  <option value="PART">PART</option>
                  <option value="OTHER">OTHER</option>
                </select>
              </FormField>
              {item.itemType === "PART" ? (
                <FormField label="Part ID" htmlFor={`quote-part-${index}`} required>
                  <input
                    id={`quote-part-${index}`}
                    type="number"
                    min={1}
                    value={item.partId ?? ""}
                    onChange={(event) => change(index, { partId: Number(event.target.value) })}
                  />
                </FormField>
              ) : (
                <FormField label="Mô tả" htmlFor={`quote-desc-${index}`} required>
                  <input
                    id={`quote-desc-${index}`}
                    value={item.description}
                    onChange={(event) => change(index, { description: event.target.value })}
                  />
                </FormField>
              )}
              <FormField label="Số lượng" htmlFor={`quote-qty-${index}`} required>
                <input
                  id={`quote-qty-${index}`}
                  type="number"
                  min={0.01}
                  step="0.01"
                  value={item.quantity}
                  onChange={(event) => change(index, { quantity: Number(event.target.value) })}
                />
              </FormField>
              {item.itemType === "PART" ? (
                <FormField label="Đơn giá catalog" htmlFor={`quote-price-${index}`}>
                  <input id={`quote-price-${index}`} value={item.unitPrice} disabled />
                </FormField>
              ) : (
                <FormField label="Đơn giá" htmlFor={`quote-price-${index}`} required>
                  <input
                    id={`quote-price-${index}`}
                    type="number"
                    min={0}
                    step="0.01"
                    value={item.unitPrice}
                    onChange={(event) => change(index, { unitPrice: Number(event.target.value) })}
                  />
                </FormField>
              )}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={items.length === 1}
                onClick={() => setItems((current) =>
                  current.filter((_, itemIndex) => itemIndex !== index))}
              >
                Xóa
              </Button>
            </div>
          ))}
        </>
      ) : null}

      <Button
        type="button"
        disabled={!valid}
        loading={mutation.isPending}
        onClick={() => void submit()}
      >
        {quotation ? "Lưu bản nháp" : "Tạo bản nháp"}
      </Button>
    </Card>
  );
}
