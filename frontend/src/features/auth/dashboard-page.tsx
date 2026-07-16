import { Link } from "react-router-dom";
import { Card } from "../../components/ui/card";
import { EmptyState, ErrorState, LoadingState } from "../../components/ui/data-state";
import { PageHeader } from "../../components/ui/page-header";
import { StatusBadge } from "../../components/ui/status-badge";
import { formatDateTime } from "../../lib/formatting/formatters";
import { useAuth } from "../../lib/auth/use-auth";
import type { RepairTicket, UserRole } from "../../types/domain";
import { useTickets } from "../repair-tickets/tickets.api";
import { useUsers } from "../users/users.api";

const roleCopy: Record<UserRole, { title: string; description: string }> = {
  CUSTOMER: { title: "Thiết bị của bạn, luôn trong tầm mắt", description: "Theo dõi tiến độ, xem chẩn đoán và phản hồi báo giá ngay khi cần." },
  RECEPTIONIST: { title: "Bàn tiếp nhận hôm nay", description: "Tạo hồ sơ khách hàng, ghi nhận thiết bị và tiếp nhận phiếu sửa chữa." },
  TECHNICIAN: { title: "Công việc đang được phân công", description: "Ưu tiên chẩn đoán các phiếu đang chờ xử lý của bạn." },
  MANAGER: { title: "Điều phối vận hành", description: "Theo dõi hàng đợi, phân công kỹ thuật viên và duyệt chẩn đoán." },
  ADMIN: { title: "Quản trị tài khoản", description: "Kiểm soát quyền truy cập và trạng thái người dùng hệ thống." },
  INVENTORY_STAFF: { title: "Không gian kho", description: "Quản lý danh mục, tồn kho và các yêu cầu cấp linh kiện." },
  CASHIER: { title: "Thanh toán thuận tiện, số liệu rõ ràng", description: "Lập hóa đơn, ghi nhận thanh toán và tra cứu lịch sử giao dịch." },
};

const roleTheme: Record<UserRole, string> = {
  CUSTOMER: "customer",
  RECEPTIONIST: "reception",
  TECHNICIAN: "technical",
  MANAGER: "management",
  ADMIN: "admin",
  INVENTORY_STAFF: "inventory",
  CASHIER: "finance",
};

interface WorkspaceConfig {
  eyebrow: string;
  title: string;
  description: string;
  steps: Array<{ title: string; description: string }>;
  actions: Array<{ label: string; description: string; to: string }>;
}

const workspaceCopy: Record<UserRole, WorkspaceConfig | null> = {
  CUSTOMER: null,
  RECEPTIONIST: {
    eyebrow: "Quy trình tiếp nhận",
    title: "Từ thông tin khách đến phiếu sửa chữa",
    description: "Đi theo ba bước để tránh thiếu thiết bị hoặc thông tin liên hệ.",
    steps: [
      { title: "Tìm hoặc tạo khách hàng", description: "Kiểm tra số điện thoại và email trước khi tạo mới." },
      { title: "Ghi nhận thiết bị", description: "Thêm loại máy, model và đặc điểm nhận dạng." },
      { title: "Tạo phiếu tiếp nhận", description: "Mô tả tình trạng và chuyển phiếu sang hàng đợi xử lý." },
    ],
    actions: [
      { label: "Khách hàng", description: "Tra cứu và tạo hồ sơ", to: "/customers" },
      { label: "Thiết bị", description: "Ghi nhận thiết bị tiếp nhận", to: "/devices" },
      { label: "Tạo phiếu", description: "Bắt đầu yêu cầu sửa chữa", to: "/tickets/new" },
    ],
  },
  TECHNICIAN: {
    eyebrow: "Quy trình kỹ thuật",
    title: "Tập trung vào phiếu được phân công",
    description: "Hoàn thành từng bước để quản lý và khách hàng luôn nhận được cập nhật rõ ràng.",
    steps: [
      { title: "Kiểm tra & chẩn đoán", description: "Ghi nhận lỗi thực tế, phương án và chi phí công dự kiến." },
      { title: "Chuẩn bị linh kiện", description: "Tra cứu tồn kho và gửi yêu cầu cấp linh kiện khi cần." },
      { title: "Sửa chữa & kiểm tra", description: "Lưu nhật ký công việc và kết quả kiểm tra cuối." },
    ],
    actions: [
      { label: "Phiếu của tôi", description: "Xem công việc được phân công", to: "/tickets" },
      { label: "Tra cứu linh kiện", description: "Kiểm tra số lượng hiện có", to: "/parts" },
      { label: "Yêu cầu linh kiện", description: "Theo dõi yêu cầu đã gửi", to: "/part-requests" },
    ],
  },
  MANAGER: {
    eyebrow: "Quy trình điều phối",
    title: "Theo dõi điểm nghẽn và đưa ra quyết định",
    description: "Ưu tiên các phiếu chờ phân công, nội dung cần duyệt và chỉ số vận hành.",
    steps: [
      { title: "Phân công", description: "Chọn kỹ thuật viên phù hợp cho từng phiếu tiếp nhận." },
      { title: "Duyệt chuyên môn", description: "Kiểm tra chẩn đoán và báo giá trước khi gửi khách hàng." },
      { title: "Theo dõi kết quả", description: "Xem doanh thu, thời gian xử lý và tình trạng tồn kho." },
    ],
    actions: [
      { label: "Điều phối phiếu", description: "Xem toàn bộ hàng đợi", to: "/tickets" },
      { label: "Báo cáo", description: "Theo dõi chỉ số vận hành", to: "/reports" },
      { label: "Khách hàng", description: "Tra cứu hồ sơ liên hệ", to: "/customers" },
    ],
  },
  ADMIN: {
    eyebrow: "Quy trình quản trị",
    title: "Quyền truy cập đúng người, đúng công việc",
    description: "Mỗi thay đổi vai trò hoặc trạng thái được áp dụng ngay và yêu cầu người dùng đăng nhập lại.",
    steps: [
      { title: "Tạo tài khoản", description: "Nhập thông tin nhân viên và chọn vai trò ban đầu." },
      { title: "Kiểm tra quyền", description: "Đảm bảo vai trò phù hợp với nhiệm vụ đang đảm nhận." },
      { title: "Kiểm soát truy cập", description: "Tạm ngưng hoặc khóa tài khoản khi cần bảo vệ hệ thống." },
    ],
    actions: [
      { label: "Tài khoản", description: "Tạo và phân quyền người dùng", to: "/users" },
      { label: "Hồ sơ của tôi", description: "Cập nhật thông tin cá nhân", to: "/profile" },
    ],
  },
  INVENTORY_STAFF: {
    eyebrow: "Quy trình kho",
    title: "Kiểm soát tồn kho và cấp phát chính xác",
    description: "Mọi lần nhập, điều chỉnh và cấp linh kiện đều được giữ trong lịch sử để đối chiếu.",
    steps: [
      { title: "Kiểm tra tồn", description: "Ưu tiên các linh kiện đã chạm mức tồn tối thiểu." },
      { title: "Duyệt yêu cầu", description: "Đối chiếu số lượng cần cấp với số lượng hiện có." },
      { title: "Ghi nhận cấp kho", description: "Lưu đúng số lượng thực tế và ghi chú khi cấp một phần." },
    ],
    actions: [
      { label: "Linh kiện & kho", description: "Cập nhật danh mục và số lượng", to: "/parts" },
      { label: "Yêu cầu cấp kho", description: "Duyệt và cấp linh kiện", to: "/part-requests" },
      { label: "Báo cáo kho", description: "Xem mức sử dụng và cảnh báo", to: "/reports" },
    ],
  },
  CASHIER: {
    eyebrow: "Quy trình thanh toán",
    title: "Thu đúng số tiền, giữ đủ lịch sử",
    description: "Số tiền luôn hiển thị bằng VNĐ và được kiểm tra lại trước khi ghi nhận.",
    steps: [
      { title: "Mở hóa đơn", description: "Kiểm tra khách hàng, phiếu sửa chữa và số tiền còn lại." },
      { title: "Ghi nhận thanh toán", description: "Chọn phương thức và nhập số tiền khách thực trả." },
      { title: "Đối chiếu giao dịch", description: "Tra cứu các khoản thu và hoàn tiền trong cùng hóa đơn." },
    ],
    actions: [
      { label: "Danh sách hóa đơn", description: "Xử lý khoản cần thu", to: "/invoices" },
      { label: "Hồ sơ của tôi", description: "Cập nhật thông tin cá nhân", to: "/profile" },
    ],
  },
};

export function DashboardPage() {
  const { user } = useAuth();
  if (!user) return null;
  const copy = roleCopy[user.role];
  const shortName = user.fullName.trim().split(/\s+/).at(-1) ?? user.fullName;
  const isCustomer = user.role === "CUSTOMER";

  return <>
    <PageHeader eyebrow={isCustomer ? "Trang chủ" : "Tổng quan hôm nay"} title={`Xin chào, ${shortName}`} description={copy.description} />
    <section className={`hero-card hero-card--${roleTheme[user.role]}`}>
      <div>
        <span className="eyebrow eyebrow--light">{isCustomer ? "Dịch vụ của bạn" : "Bắt đầu ngày làm việc"}</span>
        <h2>{copy.title}</h2>
        <p>{copy.description}</p>
        {isCustomer ? <div className="hero-card__actions">
          <Link className="button button--primary button--md" to="/tickets/new">Gửi yêu cầu sửa chữa</Link>
          <Link className="button button--secondary button--md" to="/tickets">Xem tiến độ</Link>
        </div> : null}
      </div>
      <div className="hero-card__art" aria-hidden="true"><span>EF</span><i /><i /></div>
    </section>
    {user.role === "CUSTOMER" ? <CustomerOverview /> : user.role === "ADMIN" ? <AdminOverview /> : user.role === "INVENTORY_STAFF" ? <InventoryOverview /> : user.role === "CASHIER" ? <CashierOverview /> : <OperationalOverview role={user.role} />}
  </>;
}

function CustomerOverview() {
  const tickets = useTickets({ page: 1, limit: 5, sortBy: "updatedAt", sortOrder: "desc" });
  const data = tickets.data?.data ?? [];
  const latest = data[0];

  return <>
    <div className="customer-home-grid">
      <Card className="service-journey">
        <div className="section-heading"><div><h2>Quy trình sửa chữa</h2><p>Bốn bước chính để bạn biết thiết bị đang ở đâu.</p></div></div>
        <ol className="service-steps">
          <li><span>1</span><div><strong>Gửi yêu cầu</strong><small>Thêm thiết bị và mô tả tình trạng đang gặp.</small></div></li>
          <li><span>2</span><div><strong>Kiểm tra & báo giá</strong><small>Kỹ thuật viên chẩn đoán, sau đó bạn xem và xác nhận chi phí.</small></div></li>
          <li><span>3</span><div><strong>Sửa chữa & kiểm tra</strong><small>Mọi công việc và kết quả kiểm tra được cập nhật trên phiếu.</small></div></li>
          <li><span>4</span><div><strong>Thanh toán & bàn giao</strong><small>Xem hóa đơn và nhận thông báo khi thiết bị sẵn sàng.</small></div></li>
        </ol>
      </Card>
      <Card className="customer-quick-card">
        <span className="eyebrow">Thông tin nhanh</span>
        <div className="customer-quick-card__metric"><strong>{tickets.data?.meta.total ?? 0}</strong><span>yêu cầu sửa chữa</span></div>
        {latest ? <div className="customer-quick-card__latest"><small>Cập nhật gần nhất</small><strong>{latest.ticketCode}</strong><StatusBadge value={latest.status} /></div> : <p className="muted">Bạn chưa có yêu cầu nào.</p>}
        <div className="customer-quick-card__links">
          <Link to="/devices">Quản lý thiết bị <span aria-hidden="true">→</span></Link>
          <Link to="/invoices">Xem hóa đơn <span aria-hidden="true">→</span></Link>
        </div>
      </Card>
    </div>
    <Card>
      <div className="section-heading"><div><h2>Yêu cầu gần đây</h2><p>Chọn một yêu cầu để xem đầy đủ tiến độ, báo giá và hình ảnh.</p></div><Link to="/tickets">Xem tất cả →</Link></div>
      {tickets.isLoading ? <LoadingState /> : tickets.isError ? <ErrorState error={tickets.error} retry={() => void tickets.refetch()} /> : data.length === 0 ? <EmptyState title="Chưa có yêu cầu sửa chữa" description="Hãy thêm thiết bị và gửi yêu cầu đầu tiên khi bạn cần hỗ trợ." action={<Link className="button button--primary button--md" to="/tickets/new">Gửi yêu cầu</Link>} /> : <RecentTicketList tickets={data} />}
    </Card>
  </>;
}

function OperationalOverview({ role }: { role: UserRole }) {
  const tickets = useTickets({ page: 1, limit: 5, sortBy: "updatedAt", sortOrder: "desc" });
  if (tickets.isLoading) return <LoadingState />;
  if (tickets.isError) return <ErrorState error={tickets.error} retry={() => void tickets.refetch()} />;
  const data = tickets.data?.data ?? [];
  const open = data.filter((ticket) => !["CLOSED", "CANCELLED", "DELIVERED"].includes(ticket.status)).length;
  return <><div className="metric-grid"><Card><span className="metric__label">Tổng phiếu có thể xem</span><strong className="metric__value">{tickets.data?.meta.total ?? 0}</strong><small>Theo phạm vi công việc của bạn</small></Card><Card><span className="metric__label">Đang xử lý gần đây</span><strong className="metric__value">{open}</strong><small>Trong 5 cập nhật mới nhất</small></Card><Card><span className="metric__label">Khu vực làm việc</span><strong className="metric__value metric__value--text">{role === "MANAGER" ? "Quản lý" : role === "TECHNICIAN" ? "Kỹ thuật" : "Tiếp nhận"}</strong><small>Các chức năng đã được sắp xếp theo công việc</small></Card></div><RoleWorkspace role={role} /><Card><div className="section-heading"><div><h2>Cập nhật gần đây</h2><p>Danh sách chỉ hiển thị các phiếu thuộc phạm vi công việc của bạn.</p></div><Link to="/tickets">Xem tất cả →</Link></div>{data.length === 0 ? <EmptyState title="Chưa có phiếu sửa chữa" description="Các phiếu mới sẽ xuất hiện tại đây." /> : <RecentTicketList tickets={data} />}</Card></>;
}

function RecentTicketList({ tickets }: { tickets: RepairTicket[] }) {
  return <div className="activity-list">{tickets.map((ticket) => <Link to={`/tickets/${ticket.id}`} className="activity-row" key={ticket.id}><span className="activity-row__code">{ticket.ticketCode}</span><span><strong>{ticket.title}</strong><small>{ticket.device.category} · {ticket.device.model ?? "Chưa nhập model"}</small></span><StatusBadge value={ticket.status} /><time>{formatDateTime(ticket.updatedAt)}</time></Link>)}</div>;
}

function AdminOverview() {
  const users = useUsers({ page: 1, limit: 5, sortBy: "createdAt", sortOrder: "desc" });
  if (users.isLoading) return <LoadingState />;
  if (users.isError) return <ErrorState error={users.error} retry={() => void users.refetch()} />;
  return <><div className="metric-grid"><Card><span className="metric__label">Tổng tài khoản</span><strong className="metric__value">{users.data?.meta.total ?? 0}</strong><Link to="/users">Quản lý tài khoản →</Link></Card><Card><span className="metric__label">Phạm vi quản trị</span><strong className="metric__value metric__value--text">Tài khoản & quyền</strong><small>Các tác vụ sửa chữa được giao cho bộ phận vận hành</small></Card><Card><span className="metric__label">Thay đổi truy cập</span><strong className="metric__value metric__value--text">Áp dụng ngay</strong><small>Người dùng cần đăng nhập lại sau thay đổi quan trọng</small></Card></div><RoleWorkspace role="ADMIN" /></>;
}

function CashierOverview() {
  return <><div className="metric-grid"><Card><span className="metric__label">Hóa đơn</span><strong className="metric__value metric__value--text">Sẵn sàng xử lý</strong><Link to="/invoices">Mở danh sách hóa đơn →</Link></Card><Card><span className="metric__label">Đơn vị tiền tệ</span><strong className="metric__value metric__value--text">VNĐ</strong><small>Áp dụng thống nhất cho hóa đơn và giao dịch</small></Card><Card><span className="metric__label">Đối chiếu</span><strong className="metric__value metric__value--text">Đủ lịch sử</strong><small>Mỗi khoản thu và hoàn tiền đều được lưu lại</small></Card></div><RoleWorkspace role="CASHIER" /></>;
}

function InventoryOverview() {
  return <><div className="metric-grid"><Card><span className="metric__label">Danh mục & tồn kho</span><strong className="metric__value metric__value--text">Đang cập nhật</strong><Link to="/parts">Quản lý linh kiện →</Link></Card><Card><span className="metric__label">Hàng đợi cấp kho</span><strong className="metric__value metric__value--text">Yêu cầu linh kiện</strong><Link to="/part-requests">Mở danh sách yêu cầu →</Link></Card><Card><span className="metric__label">Theo dõi kho</span><strong className="metric__value metric__value--text">Có lịch sử</strong><Link to="/reports">Xem báo cáo kho →</Link></Card></div><RoleWorkspace role="INVENTORY_STAFF" /></>;
}

function RoleWorkspace({ role }: { role: UserRole }) {
  const config = workspaceCopy[role];
  if (!config) return null;
  return <div className="role-workspace-grid">
    <Card className="role-guide">
      <span className="eyebrow">{config.eyebrow}</span>
      <h2>{config.title}</h2>
      <p>{config.description}</p>
      <ol className="role-guide__steps">
        {config.steps.map((step, index) => <li key={step.title}><span>{index + 1}</span><div><strong>{step.title}</strong><small>{step.description}</small></div></li>)}
      </ol>
    </Card>
    <Card className="role-actions-card">
      <div className="section-heading"><div><span className="eyebrow">Lối tắt</span><h2>Mở đúng khu vực cần làm</h2></div></div>
      <div className="role-action-list">
        {config.actions.map((action) => <Link to={action.to} key={action.to}><span><strong>{action.label}</strong><small>{action.description}</small></span><span aria-hidden="true">→</span></Link>)}
      </div>
    </Card>
  </div>;
}
