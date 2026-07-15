import type { DiagnosisStatus, InvoicePaymentStatus, PartRequestStatus, PaymentStatus, QuotationStatus, TestResultValue, TicketPriority, TicketStatus, UserAccountStatus } from "../../types/domain";

const labels: Record<string, string> = {
  ACTIVE: "Đang hoạt động", INACTIVE: "Tạm ngưng", LOCKED: "Đã khóa",
  NEW: "Mới tạo", RECEIVED: "Đã tiếp nhận", ASSIGNED: "Đã phân công", DIAGNOSING: "Đang chẩn đoán",
  WAITING_FOR_QUOTATION: "Chờ báo giá", WAITING_FOR_CUSTOMER_APPROVAL: "Chờ khách xác nhận",
  CUSTOMER_REJECTED: "Khách từ chối", WAITING_FOR_PARTS: "Chờ linh kiện", REPAIRING: "Đang sửa",
  TESTING: "Đang kiểm thử", COMPLETED: "Hoàn tất", READY_FOR_DELIVERY: "Sẵn sàng bàn giao",
  DELIVERED: "Đã bàn giao", CLOSED: "Đã đóng", ON_HOLD: "Tạm giữ", CANCELLED: "Đã hủy",
  DRAFT: "Bản nháp", SUBMITTED: "Chờ duyệt", REVISION_REQUIRED: "Cần chỉnh sửa", APPROVED: "Đã duyệt",
  PENDING_APPROVAL: "Chờ duyệt", SENT: "Đã gửi", ACCEPTED: "Đã chấp nhận", REJECTED: "Đã từ chối",
  PENDING: "Chờ duyệt", PARTIALLY_FULFILLED: "Đã cấp một phần", FULFILLED: "Đã cấp đủ",
  EXPIRED: "Hết hạn", SUPERSEDED: "Đã thay thế", LOW: "Thấp", NORMAL: "Bình thường", HIGH: "Cao", URGENT: "Khẩn cấp",
  PASS: "Đạt", FAIL: "Không đạt",
  UNPAID: "Chưa thanh toán", PARTIALLY_PAID: "Đã thanh toán một phần", PAID: "Đã thanh toán",
  REFUNDED: "Đã hoàn tiền", PARTIALLY_REFUNDED: "Đã hoàn một phần", FAILED: "Thất bại",
};

type StatusValue = TicketStatus | TicketPriority | DiagnosisStatus | QuotationStatus | PartRequestStatus | UserAccountStatus | TestResultValue | InvoicePaymentStatus | PaymentStatus;

export function StatusBadge({ value }: { value: StatusValue }) {
  const tone = ["ACTIVE", "APPROVED", "ACCEPTED", "COMPLETED", "CLOSED", "DELIVERED", "FULFILLED", "PASS", "PAID"].includes(value)
    ? "success"
    : ["CANCELLED", "REJECTED", "CUSTOMER_REJECTED", "LOCKED", "URGENT", "FAIL", "FAILED", "REFUNDED"].includes(value)
      ? "danger"
      : ["ON_HOLD", "REVISION_REQUIRED", "EXPIRED", "SUPERSEDED", "INACTIVE", "HIGH", "PARTIALLY_REFUNDED"].includes(value)
        ? "warning"
        : "info";
  return <span className={`badge badge--${tone}`}>{labels[value] ?? value}</span>;
}
