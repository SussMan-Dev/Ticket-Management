import { useMemo, useState } from "react";
import { Card } from "../../components/ui/card";
import { EmptyState, ErrorState, LoadingState } from "../../components/ui/data-state";
import { FormField } from "../../components/ui/form-field";
import { PageHeader } from "../../components/ui/page-header";
import { StatusBadge } from "../../components/ui/status-badge";
import { useAuth } from "../../lib/auth/use-auth";
import { formatMoney } from "../../lib/formatting/formatters";
import { useDashboardReport, useLowStockReport, usePartsUsageReport, useRepairTimeReport, useRevenueReport, useTechnicianPerformanceReport, useTicketStatusReport } from "./reports.api";

function dateInput(date: Date): string { return date.toISOString().slice(0, 10); }

export function ReportsPage() {
  const { user } = useAuth();
  const today = useMemo(() => new Date(), []);
  const [from, setFrom] = useState(dateInput(new Date(today.getTime() - 29 * 24 * 60 * 60 * 1_000)));
  const [to, setTo] = useState(dateInput(today));
  if (!user) return null;
  const manager = user.role === "MANAGER";
  const range = { from: new Date(`${from}T00:00:00`).toISOString(), to: new Date(`${to}T23:59:59.999`).toISOString() };
  return <><PageHeader eyebrow={manager ? "Tổng hợp quản lý" : "Theo dõi kho"} title={manager ? "Báo cáo vận hành" : "Báo cáo kho"} description={manager ? "Theo dõi khối lượng sửa chữa, doanh thu, hiệu suất và thời gian xử lý." : "Theo dõi mức sử dụng linh kiện và các mặt hàng cần bổ sung."} /><Card><div className="report-filter"><FormField label="Từ ngày" htmlFor="report-from"><input id="report-from" type="date" required max={to} value={from} onChange={(event) => { if (event.target.value) setFrom(event.target.value); }} /></FormField><FormField label="Đến ngày" htmlFor="report-to"><input id="report-to" type="date" required min={from} max={dateInput(today)} value={to} onChange={(event) => { if (event.target.value) setTo(event.target.value); }} /></FormField><p>Khoảng báo cáo tối đa 366 ngày.</p></div></Card>{manager ? <ManagerReports range={range} /> : null}<InventoryReports range={range} /></>;
}

function ManagerReports({ range }: { range: { from: string; to: string } }) {
  const dashboard = useDashboardReport(true);
  const statuses = useTicketStatusReport(range, true);
  const revenue = useRevenueReport(range, true);
  const technicians = useTechnicianPerformanceReport(range, true);
  const repairTime = useRepairTimeReport(range, true);
  if (dashboard.isLoading) return <LoadingState />;
  if (dashboard.isError) return <ErrorState error={dashboard.error} retry={() => void dashboard.refetch()} />;
  const data = dashboard.data;
  return <><div className="metric-grid report-metrics"><Card><span className="metric__label">Phiếu đang mở</span><strong className="metric__value">{data?.openTickets ?? 0}</strong><small>{data?.readyForDelivery ?? 0} chờ bàn giao</small></Card><Card><span className="metric__label">Doanh thu ròng tháng</span><strong className="metric__value metric__value--text">{formatMoney(data?.netRevenueThisMonth ?? 0)}</strong><small>Còn phải thu {formatMoney(data?.outstandingAmount ?? 0)}</small></Card><Card><span className="metric__label">Đã bàn giao tháng</span><strong className="metric__value">{data?.deliveredThisMonth ?? 0}</strong><small>Đánh giá trung bình {data?.averageRating ?? "—"}/5</small></Card><Card><span className="metric__label">Linh kiện sắp hết</span><strong className="metric__value">{data?.lowStockParts ?? 0}</strong><small>Theo ngưỡng tồn tối thiểu</small></Card></div><div className="report-grid"><ReportCard title="Phiếu theo trạng thái" query={statuses}>{(rows) => <div className="status-report">{rows.map((row) => <div key={row.status}><StatusBadge value={row.status} /><strong>{row.total}</strong></div>)}</div>}</ReportCard><ReportCard title="Doanh thu theo ngày" query={revenue}>{(rows) => <Table headers={["Ngày", "Thu ròng", "Hoàn tiền", "Giao dịch"]} rows={rows.map((row) => [row.period, formatMoney(row.netAmount), formatMoney(row.refundedAmount), row.completedPayments])} />}</ReportCard><ReportCard title="Hiệu suất kỹ thuật viên" query={technicians}>{(rows) => <Table headers={["Kỹ thuật viên", "Phiếu hoàn tất", "Nhật ký", "Tỷ lệ đạt"]} rows={rows.map((row) => [row.technicianName, row.completedTickets, row.repairLogs, `${row.passRate}%`])} />}</ReportCard><ReportCard title="Thời gian sửa chữa" query={repairTime}>{(rows) => <Table headers={["Tháng", "Phiếu hoàn tất", "Giờ sửa trung bình", "Giờ chờ bàn giao"]} rows={rows.map((row) => [row.period, row.completedTickets, row.averageRepairHours, row.averageDeliveryWaitHours ?? "—"]) } />}</ReportCard></div></>;
}

function InventoryReports({ range }: { range: { from: string; to: string } }) {
  const usage = usePartsUsageReport(range);
  const lowStock = useLowStockReport();
  return <div className="report-grid"><ReportCard title="Linh kiện đã xuất cho sửa chữa" query={usage}>{(rows) => <Table headers={["Linh kiện", "SKU", "Đã dùng", "Lượt xuất"]} rows={rows.map((row) => [row.name, row.sku, `${row.quantityUsed} ${row.unit}`, row.movementCount])} />}</ReportCard><ReportCard title="Cảnh báo tồn kho" query={lowStock}>{(rows) => <Table headers={["Linh kiện", "Hiện có", "Tối thiểu", "Thiếu"]} rows={rows.map((row) => [row.name, `${row.quantityOnHand} ${row.unit}`, row.minimumStock, row.shortageQuantity])} />}</ReportCard></div>;
}

type ReportQuery<T> = { data?: T; isLoading: boolean; isError: boolean; error: unknown; refetch(): unknown };
function ReportCard<T extends unknown[]>({ title, query, children }: { title: string; query: ReportQuery<T>; children(data: T): React.ReactNode }) {
  return <Card><div className="section-heading"><h2>{title}</h2></div>{query.isLoading ? <LoadingState rows={3} /> : query.isError ? <ErrorState error={query.error} retry={() => void query.refetch()} /> : !query.data?.length ? <EmptyState title="Chưa có dữ liệu" description="Không phát sinh dữ liệu trong khoảng đã chọn." /> : children(query.data)}</Card>;
}

function Table({ headers, rows }: { headers: string[]; rows: Array<Array<string | number>> }) {
  return <div className="table-wrap"><table><thead><tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={index}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>)}</tbody></table></div>;
}
