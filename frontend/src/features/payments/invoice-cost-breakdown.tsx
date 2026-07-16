import { formatMoney } from "../../lib/formatting/formatters";
import type {
  InvoiceCostBreakdown as InvoiceCostBreakdownData,
  InvoiceCostLine,
} from "../../types/domain";

const typeLabels: Record<InvoiceCostLine["type"], string> = {
  LABOR: "Tiền công",
  OTHER: "Dịch vụ khác",
  PART: "Linh kiện",
};

function formatQuantity(line: InvoiceCostLine): string {
  const quantity = new Intl.NumberFormat("vi-VN", {
    maximumFractionDigits: 2,
  }).format(line.quantity);
  return line.part ? `${quantity} ${line.part.unit}` : quantity;
}

export function InvoiceCostBreakdown({
  breakdown,
  title = "Các khoản tạo nên chi phí",
  description = "Số tiền được tính từ dự toán đã chấp nhận và linh kiện kho thực tế đã cấp.",
}: {
  breakdown: InvoiceCostBreakdownData;
  title?: string;
  description?: string;
}) {
  return (
    <section className="invoice-breakdown" aria-labelledby="invoice-breakdown-title">
      <div className="section-heading invoice-breakdown__heading">
        <div>
          <h3 id="invoice-breakdown-title">{title}</h3>
          <p>{description}</p>
        </div>
      </div>

      <div className="table-wrap invoice-breakdown__table-wrap">
        <table className="invoice-breakdown__table">
          <thead>
            <tr>
              <th>Khoản mục</th>
              <th>Nội dung</th>
              <th>Số lượng</th>
              <th>Đơn giá</th>
              <th>Thành tiền</th>
            </tr>
          </thead>
          <tbody>
            {breakdown.lines.length === 0 ? (
              <tr><td colSpan={5} className="invoice-breakdown__empty">Không có khoản chi phí phát sinh.</td></tr>
            ) : breakdown.lines.map((line, index) => (
              <tr key={`${line.source}-${line.part?.id ?? line.type}-${index}`}>
                <td>
                  <span className={`invoice-cost-type invoice-cost-type--${line.type.toLowerCase()}`}>
                    {typeLabels[line.type]}
                  </span>
                </td>
                <td>
                  <strong>{line.description}</strong>
                  <small>
                    {line.part
                      ? `${line.part.sku} · Theo số lượng kho đã cấp`
                      : "Theo dự toán đã được khách hàng chấp nhận"}
                  </small>
                </td>
                <td>{formatQuantity(line)}</td>
                <td>{formatMoney(line.unitPrice)}</td>
                <td><strong>{formatMoney(line.lineTotal)}</strong></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="invoice-breakdown__footer">
        <div className="invoice-breakdown__subtotals">
          <div><span>Tiền công & dịch vụ</span><strong>{formatMoney(breakdown.serviceSubtotal)}</strong></div>
          <div><span>Linh kiện thực tế</span><strong>{formatMoney(breakdown.partSubtotal)}</strong></div>
        </div>
        <dl className="invoice-breakdown__totals">
          <div><dt>Tạm tính</dt><dd>{formatMoney(breakdown.subtotal)}</dd></div>
          <div><dt>Giảm giá</dt><dd>- {formatMoney(breakdown.discountAmount)}</dd></div>
          <div><dt>Thuế</dt><dd>+ {formatMoney(breakdown.taxAmount)}</dd></div>
          <div className="invoice-breakdown__grand-total"><dt>Tổng thanh toán</dt><dd>{formatMoney(breakdown.totalAmount)}</dd></div>
        </dl>
      </div>
    </section>
  );
}
