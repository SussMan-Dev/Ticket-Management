import { Outlet } from "react-router-dom";

export function AuthLayout() {
  return <main id="main-content" className="auth-shell"><section className="auth-brand"><div className="brand brand--light"><span className="brand__mark">EF</span><span><strong>ElectronicFixer</strong><small>Dịch vụ sửa chữa minh bạch, đúng hẹn</small></span></div><div><span className="eyebrow eyebrow--light">Cổng dịch vụ khách hàng</span><h1>Theo dõi thiết bị từ tiếp nhận đến bàn giao.</h1><p>Một không gian thống nhất cho khách hàng và đội ngũ vận hành.</p></div><div className="auth-proof"><span>✓ Trạng thái rõ ràng</span><span>✓ Lịch sử không thể chỉnh sửa</span><span>✓ Bảo mật theo vai trò</span></div></section><section className="auth-panel"><Outlet /></section></main>;
}
