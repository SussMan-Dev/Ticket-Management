import { Button } from "./button";

export function Pagination({ page, totalPages, onChange }: { page: number; totalPages: number; onChange(page: number): void }) {
  if (totalPages <= 1) return null;
  return <nav className="pagination" aria-label="Phân trang"><Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => onChange(page - 1)}>Trang trước</Button><span>Trang {page} / {totalPages}</span><Button variant="secondary" size="sm" disabled={page >= totalPages} onClick={() => onChange(page + 1)}>Trang sau</Button></nav>;
}
