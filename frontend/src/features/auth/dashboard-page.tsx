import { Link } from "react-router-dom";
import { Card } from "../../components/ui/card";
import { EmptyState, ErrorState, LoadingState } from "../../components/ui/data-state";
import { PageHeader } from "../../components/ui/page-header";
import { StatusBadge } from "../../components/ui/status-badge";
import { formatDateTime } from "../../lib/formatting/formatters";
import { useAuth } from "../../lib/auth/use-auth";
import type { UserRole } from "../../types/domain";
import { useTickets } from "../repair-tickets/tickets.api";
import { useUsers } from "../users/users.api";

const roleCopy: Record<UserRole, { title: string; description: string }> = {
  CUSTOMER: { title: "Thiết bị của bạn, luôn trong tầm mắt", description: "Theo dõi tiến độ, chẩn đoán và phản hồi báo giá từ một nơi." },
  RECEPTIONIST: { title: "Bàn tiếp nhận hôm nay", description: "Tạo hồ sơ khách hàng, ghi nhận thiết bị và tiếp nhận phiếu sửa chữa." },
  TECHNICIAN: { title: "Công việc đang được phân công", description: "Ưu tiên chẩn đoán các phiếu đang chờ xử lý của bạn." },
  MANAGER: { title: "Điều phối vận hành", description: "Theo dõi hàng đợi, phân công kỹ thuật viên và duyệt chẩn đoán." },
  ADMIN: { title: "Quản trị tài khoản", description: "Kiểm soát quyền truy cập và trạng thái người dùng hệ thống." },
  INVENTORY_STAFF: { title: "Không gian kho", description: "Điểm mở rộng đã sẵn sàng; API kho được triển khai ở Phase 7." },
  CASHIER: { title: "Không gian thu ngân", description: "Điểm mở rộng đã sẵn sàng; API thanh toán được triển khai ở Phase 9." },
};

export function DashboardPage() {
  const { user } = useAuth();
  if (!user) return null;
  const copy = roleCopy[user.role];
  return <><PageHeader eyebrow="ElectronicFixer workspace" title={`Xin chào, ${user.fullName.split(" ").at(-1) ?? user.fullName}`} description={copy.description} /><section className="hero-card"><div><span className="eyebrow eyebrow--light">Bắt đầu ngày làm việc</span><h2>{copy.title}</h2><p>{copy.description}</p></div><div className="hero-card__art" aria-hidden="true"><span>EF</span><i /><i /></div></section>{user.role === "ADMIN" ? <AdminOverview /> : ["INVENTORY_STAFF", "CASHIER"].includes(user.role) ? <ExtensionOverview /> : <OperationalOverview role={user.role} />}</>;
}

function OperationalOverview({ role }: { role: UserRole }) {
  const tickets = useTickets({ page: 1, limit: 5, sortBy: "updatedAt", sortOrder: "desc" });
  if (tickets.isLoading) return <LoadingState />;
  if (tickets.isError) return <ErrorState error={tickets.error} retry={() => void tickets.refetch()} />;
  const data = tickets.data?.data ?? [];
  const open = data.filter((ticket) => !["CLOSED", "CANCELLED", "DELIVERED"].includes(ticket.status)).length;
  return <><div className="metric-grid"><Card><span className="metric__label">Phiếu gần đây</span><strong className="metric__value">{tickets.data?.meta.total ?? 0}</strong><small>Theo phạm vi backend cho phép</small></Card><Card><span className="metric__label">Đang xử lý</span><strong className="metric__value">{open}</strong><small>Trong 5 cập nhật mới nhất</small></Card><Card><span className="metric__label">Vai trò</span><strong className="metric__value metric__value--text">{role === "CUSTOMER" ? "Khách hàng" : role === "MANAGER" ? "Quản lý" : role === "TECHNICIAN" ? "Kỹ thuật" : "Tiếp nhận"}</strong><small>Menu được cá nhân hóa</small></Card></div><Card><div className="section-heading"><div><h2>Cập nhật gần đây</h2><p>Danh sách được giới hạn theo ownership/assignment ở backend.</p></div><Link to="/tickets">Xem tất cả →</Link></div>{data.length === 0 ? <EmptyState title="Chưa có phiếu sửa chữa" description="Các phiếu mới sẽ xuất hiện tại đây." /> : <div className="activity-list">{data.map((ticket) => <Link to={`/tickets/${ticket.id}`} className="activity-row" key={ticket.id}><span className="activity-row__code">{ticket.ticketCode}</span><span><strong>{ticket.title}</strong><small>{ticket.device.category} · {ticket.device.model ?? "Chưa rõ model"}</small></span><StatusBadge value={ticket.status} /><time>{formatDateTime(ticket.updatedAt)}</time></Link>)}</div>}</Card></>;
}

function AdminOverview() {
  const users = useUsers({ page: 1, limit: 5, sortBy: "createdAt", sortOrder: "desc" });
  if (users.isLoading) return <LoadingState />;
  if (users.isError) return <ErrorState error={users.error} retry={() => void users.refetch()} />;
  return <div className="metric-grid"><Card><span className="metric__label">Tổng tài khoản</span><strong className="metric__value">{users.data?.meta.total ?? 0}</strong><Link to="/users">Quản lý tài khoản →</Link></Card><Card><span className="metric__label">Nguyên tắc</span><strong className="metric__value metric__value--text">Account only</strong><small>Không hiển thị tác vụ sửa chữa</small></Card></div>;
}

function ExtensionOverview() {
  return <Card><EmptyState title="Module chưa có backend API" description="Navigation extension point đã sẵn sàng. Chức năng nghiệp vụ sẽ được nối khi phase tương ứng hoàn tất." action={<Link className="button button--secondary button--md" to="/extension">Xem phạm vi</Link>} /></Card>;
}
