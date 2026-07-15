import type { DiagnosisStatus, QuotationStatus, TicketPriority, TicketStatus, UserAccountStatus } from "../../types/domain";

const labels: Record<string, string> = {
  ACTIVE: "Đang hoạt động", INACTIVE: "Tạm ngưng", LOCKED: "Đã khóa",
  NEW: "Mới tạo", RECEIVED: "Đã tiếp nhận", ASSIGNED: "Đã phân công", DIAGNOSING: "Đang chẩn đoán",
  WAITING_FOR_QUOTATION: "Chờ báo giá", WAITING_FOR_CUSTOMER_APPROVAL: "Chờ khách xác nhận",
  CUSTOMER_REJECTED: "Khách từ chối", WAITING_FOR_PARTS: "Chờ linh kiện", REPAIRING: "Đang sửa",
  TESTING: "Đang kiểm thử", COMPLETED: "Hoàn tất", READY_FOR_DELIVERY: "Sẵn sàng bàn giao",
  DELIVERED: "Đã bàn giao", CLOSED: "Đã đóng", ON_HOLD: "Tạm giữ", CANCELLED: "Đã hủy",
  DRAFT: "Bản nháp", SUBMITTED: "Chờ duyệt", REVISION_REQUIRED: "Cần chỉnh sửa", APPROVED: "Đã duyệt",
  PENDING_APPROVAL: "Chờ duyệt", SENT: "Đã gửi", ACCEPTED: "Đã chấp nhận", REJECTED: "Đã từ chối",
  EXPIRED: "Hết hạn", SUPERSEDED: "Đã thay thế", LOW: "Thấp", NORMAL: "Bình thường", HIGH: "Cao", URGENT: "Khẩn cấp",
};

type StatusValue = TicketStatus | TicketPriority | DiagnosisStatus | QuotationStatus | UserAccountStatus;

export function StatusBadge({ value }: { value: StatusValue }) {
  const tone = ["ACTIVE", "APPROVED", "ACCEPTED", "COMPLETED", "CLOSED", "DELIVERED"].includes(value)
    ? "success"
    : ["CANCELLED", "REJECTED", "CUSTOMER_REJECTED", "LOCKED", "URGENT"].includes(value)
      ? "danger"
      : ["ON_HOLD", "REVISION_REQUIRED", "EXPIRED", "SUPERSEDED", "INACTIVE", "HIGH"].includes(value)
        ? "warning"
        : "info";
  return <span className={`badge badge--${tone}`}>{labels[value] ?? value}</span>;
}
