import type { ReactNode } from "react";
import { ApiError } from "../../lib/api/api-error";
import { Button } from "./button";

export function LoadingState({ rows = 4 }: { rows?: number }) {
  return <div className="skeleton-stack" role="status" aria-label="Đang tải">{Array.from({ length: rows }, (_, index) => <div className="skeleton" key={index} />)}</div>;
}

export function EmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return <div className="empty-state"><div className="empty-state__icon" aria-hidden="true">◇</div><h3>{title}</h3><p>{description}</p>{action}</div>;
}

export function ErrorState({ error, retry }: { error: unknown; retry?: () => void }) {
  const message = error instanceof ApiError ? error.message : "Đã có lỗi xảy ra khi tải dữ liệu.";
  return <div className="error-state" role="alert"><strong>Không thể tải dữ liệu</strong><p>{message}</p>{retry ? <Button variant="secondary" onClick={retry}>Thử lại</Button> : null}</div>;
}

export function MutationError({ error }: { error: unknown }) {
  if (!error) return null;
  const apiError = error instanceof ApiError ? error : null;
  const detail = apiError?.status === 409
    ? "Dữ liệu đã thay đổi ở nơi khác. Hãy tải lại trước khi tiếp tục."
    : apiError?.status === 422
      ? "Một số dữ liệu chưa hợp lệ. Hãy kiểm tra các trường bên dưới."
      : apiError?.message ?? "Không thể hoàn tất thao tác.";
  return <div className="alert alert--error" role="alert">{detail}</div>;
}
