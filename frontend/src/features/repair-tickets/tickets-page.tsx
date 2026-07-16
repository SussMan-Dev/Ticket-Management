import { useState } from "react";
import { Link } from "react-router-dom";
import { Card } from "../../components/ui/card";
import { EmptyState, ErrorState, LoadingState } from "../../components/ui/data-state";
import { PageHeader } from "../../components/ui/page-header";
import { Pagination } from "../../components/ui/pagination";
import { StatusBadge } from "../../components/ui/status-badge";
import { formatDateTime } from "../../lib/formatting/formatters";
import { useAuth } from "../../lib/auth/use-auth";
import { TICKET_STATUSES, type TicketPriority, type TicketStatus } from "../../types/domain";
import { useTickets } from "./tickets.api";

const statusLabels: Record<TicketStatus, string> = {
  NEW: "Mới tạo", RECEIVED: "Đã tiếp nhận", ASSIGNED: "Đã phân công", DIAGNOSING: "Đang chẩn đoán",
  WAITING_FOR_QUOTATION: "Chờ báo giá", WAITING_FOR_CUSTOMER_APPROVAL: "Chờ khách xác nhận",
  CUSTOMER_REJECTED: "Khách từ chối", WAITING_FOR_PARTS: "Chờ linh kiện", REPAIRING: "Đang sửa",
  TESTING: "Kiểm thử", COMPLETED: "Hoàn tất", READY_FOR_DELIVERY: "Sẵn sàng bàn giao",
  DELIVERED: "Đã bàn giao", CLOSED: "Đã đóng", ON_HOLD: "Tạm giữ", CANCELLED: "Đã hủy",
};

export function TicketsPage() {
  const { user } = useAuth();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<TicketStatus | "">("");
  const [priority, setPriority] = useState<TicketPriority | "">("");
  const tickets = useTickets({ page, limit: 20, search: search || undefined, status: status || undefined, priority: priority || undefined, sortBy: "updatedAt", sortOrder: "desc" });
  const canCreate = user && ["CUSTOMER", "RECEPTIONIST", "MANAGER"].includes(user.role);
  const isCustomer = user?.role === "CUSTOMER";
  const title = isCustomer ? "Yêu cầu sửa chữa của tôi" : user?.role === "TECHNICIAN" ? "Phiếu được phân công" : "Phiếu sửa chữa";
  const description = isCustomer
    ? "Theo dõi tiến độ, xem báo giá và các cập nhật mới nhất cho thiết bị của bạn."
    : user?.role === "TECHNICIAN"
      ? "Danh sách các phiếu đang được giao cho bạn xử lý."
      : "Tìm kiếm và theo dõi các phiếu trong phạm vi công việc của bạn.";

  return <><PageHeader eyebrow={isCustomer ? "Dịch vụ của tôi" : "Quản lý sửa chữa"} title={title} description={description} actions={canCreate ? <Link className="button button--primary button--md" to="/tickets/new">{isCustomer ? "+ Gửi yêu cầu" : "+ Tạo phiếu"}</Link> : undefined} /><Card><div className="toolbar toolbar--filters"><label className="search-field"><span className="sr-only">Tìm phiếu</span><input placeholder="Mã phiếu, nội dung, thiết bị…" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} /></label><select aria-label="Lọc trạng thái" value={status} onChange={(event) => { setStatus(event.target.value as TicketStatus | ""); setPage(1); }}><option value="">Mọi trạng thái</option>{TICKET_STATUSES.map((value) => <option key={value} value={value}>{statusLabels[value]}</option>)}</select>{!isCustomer ? <select aria-label="Lọc ưu tiên" value={priority} onChange={(event) => { setPriority(event.target.value as TicketPriority | ""); setPage(1); }}><option value="">Mọi ưu tiên</option><option value="LOW">Thấp</option><option value="NORMAL">Bình thường</option><option value="HIGH">Cao</option><option value="URGENT">Khẩn cấp</option></select> : null}</div>{tickets.isLoading ? <LoadingState /> : tickets.isError ? <ErrorState error={tickets.error} retry={() => void tickets.refetch()} /> : (tickets.data?.data ?? []).length === 0 ? <EmptyState title="Không có yêu cầu phù hợp" description={isCustomer ? "Bạn có thể bỏ bộ lọc hoặc gửi một yêu cầu sửa chữa mới." : "Hãy thử bỏ bớt bộ lọc để xem thêm kết quả."} /> : <div className="ticket-list">{(tickets.data?.data ?? []).map((ticket) => <Link className="ticket-row" to={`/tickets/${ticket.id}`} key={ticket.id}><div><span className="ticket-code">{ticket.ticketCode}</span><h2>{ticket.title}</h2><p>{ticket.device.brand ?? ticket.device.category} {ticket.device.model ?? ""}{isCustomer ? "" : ` · ${ticket.customer.fullName}`}</p></div><div className="ticket-row__status"><StatusBadge value={ticket.status} />{!isCustomer ? <StatusBadge value={ticket.priority} /> : null}</div><div><small>Cập nhật</small><time>{formatDateTime(ticket.updatedAt)}</time></div><span aria-hidden="true">→</span></Link>)}</div>}<Pagination page={page} totalPages={tickets.data?.meta.totalPages ?? 1} onChange={setPage} /></Card></>;
}
