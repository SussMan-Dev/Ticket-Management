import type { Quotation, QuotationItem, QuotationStatus } from "../../types/domain";

export interface MockDraftInput {
  ticketId: number;
  items: Array<Pick<QuotationItem, "itemType" | "description" | "quantity" | "unitPrice">>;
  expiresAt: string | null;
}

export interface QuotationGateway {
  list(ticketId: number): Promise<Quotation[]>;
  get(id: number): Promise<Quotation | null>;
  createDraft(input: MockDraftInput): Promise<Quotation>;
  updateDraft(id: number, input: MockDraftInput): Promise<Quotation>;
  transition(id: number, status: QuotationStatus): Promise<Quotation>;
}

const records = new Map<number, Quotation>();
let nextId = 1;

function calculateMockAmounts(items: MockDraftInput["items"]) {
  const normalized = items.map((item, index) => ({
    ...item,
    id: index + 1,
    lineTotal: item.quantity * item.unitPrice,
  }));
  const totalAmount = normalized.reduce((sum, item) => sum + item.lineTotal, 0);
  return { items: normalized, totalAmount };
}

function requireRecord(id: number): Quotation {
  const quotation = records.get(id);
  if (!quotation) throw new Error("Không tìm thấy báo giá mock");
  return quotation;
}

export const mockQuotationGateway: QuotationGateway = {
  async list(ticketId) {
    return [...records.values()]
      .filter((quotation) => quotation.ticketId === ticketId)
      .sort((a, b) => b.version - a.version);
  },
  async get(id) {
    return records.get(id) ?? null;
  },
  async createDraft(input) {
    const existing = [...records.values()].filter((item) => item.ticketId === input.ticketId);
    existing.forEach((item) => {
      if (!["ACCEPTED", "REJECTED", "EXPIRED", "SUPERSEDED"].includes(item.status)) {
        records.set(item.id, { ...item, status: "SUPERSEDED", updatedAt: new Date().toISOString() });
      }
    });
    const amounts = calculateMockAmounts(input.items);
    const now = new Date().toISOString();
    const quotation: Quotation = {
      id: nextId++,
      ticketId: input.ticketId,
      version: existing.length + 1,
      status: "DRAFT",
      ...amounts,
      laborAmount: 0,
      partsAmount: 0,
      taxAmount: 0,
      discountAmount: 0,
      expiresAt: input.expiresAt,
      sentAt: null,
      respondedAt: null,
      createdAt: now,
      updatedAt: now,
      source: "mock",
    };
    records.set(quotation.id, quotation);
    return quotation;
  },
  async updateDraft(id, input) {
    const current = requireRecord(id);
    if (current.status !== "DRAFT") throw new Error("Chỉ có thể sửa báo giá DRAFT");
    const next = { ...current, ...calculateMockAmounts(input.items), expiresAt: input.expiresAt, updatedAt: new Date().toISOString() };
    records.set(id, next);
    return next;
  },
  async transition(id, status) {
    const current = requireRecord(id);
    const next = {
      ...current,
      status,
      sentAt: status === "SENT" ? new Date().toISOString() : current.sentAt,
      respondedAt: status === "ACCEPTED" || status === "REJECTED" ? new Date().toISOString() : current.respondedAt,
      updatedAt: new Date().toISOString(),
    };
    records.set(id, next);
    return next;
  },
};

// Phase 6 backend chưa được mount. Chỉ thay binding này bằng API gateway sau khi
// schema/DTO thực tế tồn tại; UI và query hooks không cần biết transport bên dưới.
export const quotationGateway: QuotationGateway = mockQuotationGateway;

export function resetMockQuotations(): void {
  records.clear();
  nextId = 1;
}
