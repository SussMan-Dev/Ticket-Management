import type { RowDataPacket } from "mysql2";

export interface NotificationRow extends RowDataPacket {
  id: number;
  user_id: number;
  type: string;
  title: string;
  content: string;
  reference_type: string | null;
  reference_id: number | null;
  is_read: number | boolean;
  read_at: Date | null;
  created_at: Date;
}

export interface Notification {
  id: number;
  type: string;
  title: string;
  content: string;
  reference: { type: string; id: number } | null;
  isRead: boolean;
  readAt: Date | null;
  createdAt: Date;
}

const legacyTitleTranslations: Readonly<Record<string, string>> = {
  "New repair ticket assignment": "Phân công phiếu sửa chữa mới",
  "Repair ticket reassigned": "Phiếu sửa chữa đã được phân công lại",
  "Diagnosis awaiting review": "Chẩn đoán đang chờ duyệt",
  "Diagnosis revision required": "Yêu cầu chỉnh sửa chẩn đoán",
  "Diagnosis approved": "Chẩn đoán đã được phê duyệt",
  "Repair diagnosis approved": "Chẩn đoán sửa chữa đã được phê duyệt",
  "Quotation awaiting your response": "Báo giá đang chờ phản hồi",
  "Quotation accepted": "Báo giá đã được chấp nhận",
  "Quotation rejected": "Báo giá đã bị từ chối",
  "Quotation expired": "Báo giá đã hết hạn",
  "Part request awaiting review": "Yêu cầu linh kiện đang chờ duyệt",
  "Part request approved": "Yêu cầu linh kiện đã được phê duyệt",
  "Part request rejected": "Yêu cầu linh kiện đã bị từ chối",
  "Part request fulfilled": "Yêu cầu linh kiện đã được cấp đủ",
  "Part request partially fulfilled": "Yêu cầu linh kiện đã được cấp một phần",
  "Repair completed": "Sửa chữa đã hoàn tất",
  "Invoice issued": "Hóa đơn đã được phát hành",
  "Invoice paid": "Hóa đơn đã được thanh toán",
  "Payment received": "Đã nhận thanh toán",
  "Payment refunded": "Khoản thanh toán đã được hoàn tiền",
  "Device delivered": "Thiết bị đã được bàn giao",
  "Repair ticket closed": "Phiếu sửa chữa đã được đóng",
};

const legacyContentTranslations: ReadonlyArray<readonly [RegExp, string]> = [
  [/^You were assigned repair ticket (.+)\.$/, "Bạn đã được phân công xử lý phiếu sửa chữa $1."],
  [/^Repair ticket (.+) was reassigned to another technician\.$/, "Phiếu sửa chữa $1 đã được chuyển cho kỹ thuật viên khác."],
  [/^A diagnosis for repair ticket (.+) is ready for review\.$/, "Bản chẩn đoán của phiếu sửa chữa $1 đã sẵn sàng để xét duyệt."],
  [/^The diagnosis for repair ticket (.+) requires revision\.$/, "Bản chẩn đoán của phiếu sửa chữa $1 cần được chỉnh sửa."],
  [/^The diagnosis for repair ticket (.+) was approved\.$/, "Bản chẩn đoán của phiếu sửa chữa $1 đã được phê duyệt."],
  [/^The diagnosis for repair ticket (.+) was approved and is being prepared for quotation\.$/, "Bản chẩn đoán của phiếu sửa chữa $1 đã được phê duyệt và đang được chuẩn bị báo giá."],
  [/^Quotation version (\d+) for repair ticket (.+) is ready for review\.$/, "Báo giá phiên bản $1 của phiếu sửa chữa $2 đã sẵn sàng để bạn xem xét."],
  [/^The customer accepted quotation version (\d+) for repair ticket (.+)\.$/, "Khách hàng đã chấp nhận báo giá phiên bản $1 của phiếu sửa chữa $2."],
  [/^The customer rejected quotation version (\d+) for repair ticket (.+)\.$/, "Khách hàng đã từ chối báo giá phiên bản $1 của phiếu sửa chữa $2."],
  [/^Quotation version (\d+) for repair ticket (.+) expired\.$/, "Báo giá phiên bản $1 của phiếu sửa chữa $2 đã hết hạn."],
  [/^Part request (\d+) for repair ticket (.+) is awaiting review\.$/, "Yêu cầu linh kiện $1 của phiếu sửa chữa $2 đang chờ xét duyệt."],
  [/^Part request (\d+) for repair ticket (.+) was approved\.$/, "Yêu cầu linh kiện $1 của phiếu sửa chữa $2 đã được phê duyệt."],
  [/^Part request (\d+) for repair ticket (.+) was rejected\.$/, "Yêu cầu linh kiện $1 của phiếu sửa chữa $2 đã bị từ chối."],
  [/^Part request (\d+) for repair ticket (.+) was fulfilled\.$/, "Yêu cầu linh kiện $1 của phiếu sửa chữa $2 đã được cấp đủ."],
  [/^Part request (\d+) for repair ticket (.+) was partially fulfilled\.$/, "Yêu cầu linh kiện $1 của phiếu sửa chữa $2 đã được cấp một phần."],
  [/^Repair ticket (.+) passed technical testing\.$/, "Phiếu sửa chữa $1 đã vượt qua kiểm tra kỹ thuật."],
  [/^Invoice (.+) has been issued for ticket (.+)\.$/, "Hóa đơn $1 đã được phát hành cho phiếu sửa chữa $2."],
  [/^(.+) for invoice (.+) was recorded successfully\.$/, "Khoản thanh toán $1 cho hóa đơn $2 đã được ghi nhận thành công."],
  [/^Payment (.+) for invoice (.+) was refunded\.$/, "Khoản thanh toán $1 cho hóa đơn $2 đã được hoàn tiền."],
  [/^Device handover for ticket (.+) was recorded\.$/, "Việc bàn giao thiết bị của phiếu sửa chữa $1 đã được ghi nhận."],
  [/^Repair ticket (.+) has been closed after delivery\.$/, "Phiếu sửa chữa $1 đã được đóng sau khi bàn giao."],
];

function localizeLegacyContent(content: string): string {
  for (const [pattern, translation] of legacyContentTranslations) {
    if (pattern.test(content)) return content.replace(pattern, translation);
  }
  return content;
}

export function toNotification(row: NotificationRow): Notification {
  return {
    id: row.id,
    type: row.type,
    title: legacyTitleTranslations[row.title] ?? row.title,
    content: localizeLegacyContent(row.content),
    reference: row.reference_type && row.reference_id
      ? { type: row.reference_type, id: row.reference_id }
      : null,
    isRead: Boolean(row.is_read),
    readAt: row.read_at,
    createdAt: row.created_at,
  };
}
