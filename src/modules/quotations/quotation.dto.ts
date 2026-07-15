export type QuotationItemType = "LABOR" | "PART" | "OTHER";

export interface PartQuotationItemDto {
  itemType: "PART";
  partId: number;
  quantity: number;
}

export interface ServiceQuotationItemDto {
  itemType: "LABOR" | "OTHER";
  description: string;
  quantity: number;
  unitPrice: number;
}

export type QuotationItemDto =
  | PartQuotationItemDto
  | ServiceQuotationItemDto;

export interface CreateQuotationDto {
  expiresAt?: Date | null;
}

export interface UpdateQuotationDto {
  expiresAt?: Date | null;
  items?: QuotationItemDto[];
}

