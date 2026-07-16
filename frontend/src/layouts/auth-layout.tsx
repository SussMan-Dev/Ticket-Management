import { Outlet } from "react-router-dom";
import { AppFooter } from "../components/ui/app-footer";

export function AuthLayout() {
  return <main id="main-content" className="auth-shell"><section className="auth-brand"><div className="brand brand--light"><span className="brand__mark">EF</span><span><strong>ElectronicFixer</strong><small>Dịch vụ sửa chữa minh bạch, đúng hẹn</small></span></div><div><span className="eyebrow eyebrow--light">Cổng dịch vụ khách hàng</span><h1>An tâm theo dõi thiết bị trong suốt quá trình sửa chữa.</h1><p>Từ lúc gửi yêu cầu, duyệt báo giá đến khi nhận lại thiết bị — mọi cập nhật đều ở một nơi.</p></div><div className="auth-proof"><span>✓ Tiến độ dễ hiểu</span><span>✓ Báo giá rõ ràng</span><span>✓ Thông tin được bảo vệ</span></div></section><section className="auth-panel"><div className="auth-panel__content"><Outlet /></div><AppFooter compact /></section></main>;
}
