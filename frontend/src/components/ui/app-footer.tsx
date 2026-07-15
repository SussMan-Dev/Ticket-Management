interface AppFooterProps {
  compact?: boolean;
}

export function AppFooter({ compact = false }: AppFooterProps) {
  const currentYear = new Date().getFullYear();

  return (
    <footer className={`site-footer${compact ? " site-footer--compact" : ""}`}>
      <div className="site-footer__inner">
        <div className="site-footer__identity">
          <span className="site-footer__mark" aria-hidden="true">EF</span>
          <span>
            <strong>ElectronicFixer</strong>
            <small>Quản lý sửa chữa rõ ràng từ tiếp nhận đến bàn giao</small>
          </span>
        </div>
        <div className="site-footer__meta">
          <span className="site-footer__status"><i aria-hidden="true" /> Dữ liệu được bảo vệ theo vai trò</span>
          <small>© {currentYear} ElectronicFixer. All rights reserved.</small>
        </div>
      </div>
    </footer>
  );
}
