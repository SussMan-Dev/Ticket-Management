import { Link, useParams } from "react-router-dom";
import { Card } from "../../components/ui/card";
import { ErrorState, LoadingState } from "../../components/ui/data-state";
import { PageHeader } from "../../components/ui/page-header";
import { StatusBadge } from "../../components/ui/status-badge";
import { formatDateTime } from "../../lib/formatting/formatters";
import { useCustomer } from "./customers.api";

export function CustomerDetailPage() {
  const id = Number(useParams().customerId);
  const customer = useCustomer(id);
  if (customer.isLoading) return <LoadingState />;
  if (customer.isError || !customer.data) return <ErrorState error={customer.error} retry={() => void customer.refetch()} />;
  const data = customer.data;
  return <><PageHeader eyebrow="Hồ sơ khách hàng" title={data.fullName} description="Thông tin liên hệ và ghi chú phục vụ quá trình tiếp nhận." actions={<div className="button-row"><Link className="button button--secondary button--md" to={`/devices?customerId=${data.id}`}>Xem thiết bị</Link><Link className="button button--primary button--md" to={`/tickets/new?customerId=${data.id}`}>Tạo phiếu sửa chữa</Link></div>} /><div className="detail-grid"><Card><h2>Thông tin liên hệ</h2><dl className="detail-list"><div><dt>Email</dt><dd>{data.email}</dd></div><div><dt>Điện thoại</dt><dd>{data.phone ?? "—"}</dd></div><div><dt>Địa chỉ</dt><dd>{data.address ?? "—"}</dd></div><div><dt>Trạng thái</dt><dd><StatusBadge value={data.status} /></dd></div></dl></Card><Card><h2>Lịch sử hồ sơ</h2><dl className="detail-list"><div><dt>Ngày tạo</dt><dd>{formatDateTime(data.createdAt)}</dd></div><div><dt>Cập nhật gần nhất</dt><dd>{formatDateTime(data.updatedAt)}</dd></div>{"notes" in data ? <div><dt>Ghi chú nội bộ</dt><dd>{data.notes ?? "—"}</dd></div> : null}</dl></Card></div></>;
}
