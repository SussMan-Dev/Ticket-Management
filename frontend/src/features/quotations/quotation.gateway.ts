import { apiClient } from "../../lib/api/client";
import type { Quotation, QuotationStatus } from "../../types/domain";

export type QuotationDraftItem =
  | { itemType: "PART"; partId: number; quantity: number }
  | {
      itemType: "LABOR" | "OTHER";
      description: string;
      quantity: number;
      unitPrice: number;
    };

export interface CreateQuotationInput {
  ticketId: number;
  expiresAt?: string | null;
}

export interface UpdateQuotationInput {
  expiresAt?: string | null;
  items?: QuotationDraftItem[];
}

export interface QuotationGateway {
  list(ticketId: number): Promise<Quotation[]>;
  get(id: number): Promise<Quotation>;
  createDraft(input: CreateQuotationInput): Promise<Quotation>;
  updateDraft(id: number, input: UpdateQuotationInput): Promise<Quotation>;
  transition(id: number, status: QuotationStatus): Promise<Quotation>;
  publish(id: number, currentStatus: QuotationStatus): Promise<Quotation>;
}

const actionByStatus: Partial<Record<QuotationStatus, string>> = {
  PENDING_APPROVAL: "submit",
  APPROVED: "approve",
  SENT: "send",
  ACCEPTED: "accept",
  REJECTED: "reject",
};

const publicationSteps: Partial<Record<QuotationStatus, QuotationStatus[]>> = {
  DRAFT: ["PENDING_APPROVAL", "APPROVED", "SENT"],
  PENDING_APPROVAL: ["APPROVED", "SENT"],
  APPROVED: ["SENT"],
};

async function transitionQuotation(id: number, status: QuotationStatus): Promise<Quotation> {
  const action = actionByStatus[status];
  if (!action) throw new Error(`Unsupported quotation transition: ${status}`);
  return (await apiClient.post<Quotation>(`/quotations/${id}/${action}`, {})).data;
}

export const quotationGateway: QuotationGateway = {
  async list(ticketId) {
    return (await apiClient.get<Quotation[]>(`/repair-tickets/${ticketId}/quotations`)).data;
  },

  async get(id) {
    return (await apiClient.get<Quotation>(`/quotations/${id}`)).data;
  },

  async createDraft({ ticketId, ...input }) {
    return (
      await apiClient.post<Quotation>(`/repair-tickets/${ticketId}/quotations`, input)
    ).data;
  },

  async updateDraft(id, input) {
    return (await apiClient.patch<Quotation>(`/quotations/${id}`, input)).data;
  },

  async transition(id, status) {
    return transitionQuotation(id, status);
  },

  async publish(id, currentStatus) {
    const steps = publicationSteps[currentStatus];
    if (!steps) throw new Error(`Quotation cannot be published from status: ${currentStatus}`);
    let quotation: Quotation | undefined;
    for (const status of steps) {
      quotation = await transitionQuotation(id, status);
    }
    if (!quotation) throw new Error("Quotation publication has no transition steps");
    return quotation;
  },
};
