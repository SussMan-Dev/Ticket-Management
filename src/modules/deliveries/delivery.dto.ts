export interface CreateDeliveryDto {
  recipientName: string;
  recipientPhone?: string | null;
  proofUrl?: string | null;
  note?: string | null;
  paymentExceptionReason?: string | null;
}

export interface CloseDeliveryDto {
  reason?: string | null;
}
