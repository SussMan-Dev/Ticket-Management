import { Link } from "react-router-dom";

function ErrorPage({ code, title, description }: { code: string; title: string; description: string }) {
  return <main id="main-content" className="standalone-error"><span>{code}</span><h1>{title}</h1><p>{description}</p><Link className="button button--primary button--md" to="/">Về trang tổng quan</Link></main>;
}
export function ForbiddenPage() { return <ErrorPage code="403" title="Bạn không có quyền truy cập" description="Tài khoản hiện tại không được phép sử dụng chức năng này." />; }
export function UnauthorizedPage() { return <ErrorPage code="401" title="Phiên đăng nhập không hợp lệ" description="Vui lòng đăng nhập lại để tiếp tục." />; }
export function NotFoundPage() { return <ErrorPage code="404" title="Không tìm thấy trang" description="Đường dẫn có thể đã thay đổi hoặc không còn tồn tại." />; }
