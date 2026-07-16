import { useMemo, useState } from "react";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  MutationError,
} from "../../components/ui/data-state";
import { FormField } from "../../components/ui/form-field";
import { StatusBadge } from "../../components/ui/status-badge";
import { useAuth } from "../../lib/auth/use-auth";
import { formatDateTime } from "../../lib/formatting/formatters";
import type {
  RepairLog,
  RepairTicket,
  TestResultValue,
} from "../../types/domain";
import { usePartRequests } from "../inventory/inventory.api";
import { canWriteRepairLog } from "./repair-action.rules";
import {
  useCompleteTesting,
  useCreateRepairLog,
  useCreateTestResult,
  useRepairLogs,
  useTestResults,
  useUpdateRepairLog,
} from "./repair-actions.api";

interface UsageLine { partId: number; quantity: number }

export function RepairActionPanel({ ticket }: { ticket: RepairTicket }) {
  const { user } = useAuth();
  const logs = useRepairLogs(ticket.id);
  const tests = useTestResults(ticket.id);
  if (!user || !["CUSTOMER", "TECHNICIAN", "MANAGER"].includes(user.role)) return null;
  if (logs.isLoading || tests.isLoading) return <LoadingState rows={3} />;
  if (logs.isError) return <ErrorState error={logs.error} retry={() => void logs.refetch()} />;
  if (tests.isError) return <ErrorState error={tests.error} retry={() => void tests.refetch()} />;

  const repairLogs = logs.data ?? [];
  const testResults = tests.data ?? [];
  const technicianCanLogRepair = canWriteRepairLog(user.role, ticket.status);
  const technicianCanTest = user.role === "TECHNICIAN" &&
    ["REPAIRING", "TESTING"].includes(ticket.status) &&
    repairLogs.length > 0 && repairLogs.every((log) => Boolean(log.finishedAt));

  return (
    <section className="detail-section" aria-labelledby="repair-actions-title">
      <div className="section-heading">
        <div><span className="eyebrow">Tiến độ kỹ thuật</span><h2 id="repair-actions-title">Sửa chữa & kiểm tra</h2></div>
        <StatusBadge value={ticket.status} />
      </div>

      {technicianCanLogRepair && ticket.status === "WAITING_FOR_PARTS" ? (
        <div className="alert alert--info">
          Bạn vẫn có thể ghi công việc trong lúc chờ kho. Chỉ linh kiện đã được cấp mới có thể được ghi nhận là đã sử dụng; bước kiểm tra bắt đầu sau khi phiếu trở lại trạng thái đang sửa.
        </div>
      ) : null}
      {technicianCanLogRepair ? <CreateRepairLogForm ticketId={ticket.id} logs={repairLogs} /> : null}

      <div className="section-heading"><h3>Nhật ký sửa chữa</h3><span>{repairLogs.length} bản ghi</span></div>
      {repairLogs.length === 0
        ? <EmptyState title="Chưa có nhật ký sửa chữa" description="Kỹ thuật viên được phân công sẽ ghi lại từng công việc tại đây." />
        : repairLogs.map((log) => (
          <Card key={log.id} className="diagnosis-card">
            <div className="section-heading">
              <strong>Công việc #{log.id} · {log.actionDescription}</strong>
              <span>{log.finishedAt ? "Đã hoàn tất" : "Đang thực hiện"}</span>
            </div>
            {log.technician ? <small>Kỹ thuật viên: {log.technician.fullName}</small> : null}
            {log.result ? <p>{log.result}</p> : null}
            <small>{formatDateTime(log.startedAt)} → {formatDateTime(log.finishedAt)}</small>
            {log.parts && log.parts.length > 0 ? (
              <ul className="compact-list">
                {log.parts.map((part) => (
                  <li key={part.id}>{part.part.sku} · {part.part.name}: {part.quantity} {part.part.unit}</li>
                ))}
              </ul>
            ) : null}
            {technicianCanLogRepair && !log.finishedAt ? (
              <FinishRepairLog ticketId={ticket.id} log={log} />
            ) : null}
          </Card>
        ))}

      <div className="section-heading"><h3>Kết quả kiểm tra</h3><span>{testResults.length} kết quả</span></div>
      {technicianCanTest ? <CreateTestResultForm ticketId={ticket.id} /> : null}
      {testResults.length === 0
        ? <EmptyState title="Chưa có kết quả kiểm tra" description="Kết quả sẽ được ghi nhận sau khi có ít nhất một công việc sửa chữa hoàn tất." />
        : <div className="table-wrap"><table><thead><tr><th>Bài kiểm tra</th><th>Kết quả</th><th>Người kiểm tra</th><th>Thời gian</th></tr></thead><tbody>{testResults.map((result) => (
          <tr key={result.id}>
            <td><strong>{result.testName}</strong>{result.note ? <small>{result.note}</small> : null}</td>
            <td><StatusBadge value={result.result} /></td>
            <td>{result.testedBy?.fullName ?? "—"}</td>
            <td>{formatDateTime(result.testedAt)}</td>
          </tr>
        ))}</tbody></table></div>}
      {user.role === "TECHNICIAN" && ticket.status === "TESTING" ? (
        <CompleteTesting ticketId={ticket.id} />
      ) : null}
    </section>
  );
}

function CreateRepairLogForm({ ticketId, logs }: { ticketId: number; logs: RepairLog[] }) {
  const requests = usePartRequests({ page: 1, limit: 100, ticketId });
  const create = useCreateRepairLog(ticketId);
  const [actionDescription, setActionDescription] = useState("");
  const [result, setResult] = useState("");
  const [finishNow, setFinishNow] = useState(false);
  const [parts, setParts] = useState<UsageLine[]>([]);
  const partOptions = useMemo(() => {
    const fulfilled = new Map<number, { partId: number; sku: string; name: string; unit: string; quantity: number }>();
    for (const request of requests.data?.data ?? []) {
      for (const item of request.items) {
        const current = fulfilled.get(item.part.id);
        fulfilled.set(item.part.id, {
          partId: item.part.id,
          sku: item.part.sku,
          name: item.part.name,
          unit: item.part.unit,
          quantity: (current?.quantity ?? 0) + item.fulfilledQuantity,
        });
      }
    }
    for (const log of logs) {
      for (const item of log.parts ?? []) {
        const current = fulfilled.get(item.part.id);
        if (current) current.quantity -= item.quantity;
      }
    }
    return [...fulfilled.values()].filter((part) => part.quantity > 0);
  }, [logs, requests.data]);
  const validParts = parts.every((part) => {
    const option = partOptions.find((item) => item.partId === part.partId);
    return Boolean(option && part.quantity > 0 && part.quantity <= (option?.quantity ?? 0));
  }) && new Set(parts.map((part) => part.partId)).size === parts.length;
  const submit = async () => {
    if (actionDescription.trim().length < 3 || !validParts) return;
    await create.mutateAsync({
      actionDescription: actionDescription.trim(),
      result: result.trim() || null,
      finishedAt: finishNow ? new Date().toISOString() : null,
      parts,
    });
    setActionDescription("");
    setResult("");
    setFinishNow(false);
    setParts([]);
  };

  return (
    <Card className="form-card">
      <h3>Ghi công việc sửa chữa</h3>
      <MutationError error={create.error ?? requests.error} />
      <FormField label="Công việc đã thực hiện" htmlFor="repair-action-description" required>
        <textarea id="repair-action-description" rows={3} value={actionDescription} onChange={(event) => setActionDescription(event.target.value)} />
      </FormField>
      <FormField label="Kết quả / ghi chú kỹ thuật" htmlFor="repair-action-result">
        <textarea id="repair-action-result" rows={2} value={result} onChange={(event) => setResult(event.target.value)} />
      </FormField>
      {parts.map((line, index) => (
        <div className="part-row" key={index}>
          <FormField label="Linh kiện ghi nhận trong công việc" htmlFor={`repair-part-${index}`} required>
            <select id={`repair-part-${index}`} value={line.partId} onChange={(event) => setParts((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, partId: Number(event.target.value) } : item))}>
              <option value={0}>Chọn linh kiện đã được cấp</option>
              {partOptions.map((part) => <option key={part.partId} value={part.partId}>{part.sku} · {part.name} (còn {part.quantity} {part.unit})</option>)}
            </select>
          </FormField>
          <FormField label="Số lượng" htmlFor={`repair-part-quantity-${index}`} required>
            <input id={`repair-part-quantity-${index}`} type="number" min={1} value={line.quantity} onChange={(event) => setParts((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, quantity: Number(event.target.value) } : item))} />
          </FormField>
          <Button type="button" size="sm" variant="ghost" onClick={() => setParts((current) => current.filter((_, itemIndex) => itemIndex !== index))}>Xóa</Button>
        </div>
      ))}
      <div className="button-row">
        <Button type="button" size="sm" variant="secondary" disabled={partOptions.length === 0} onClick={() => setParts((current) => [...current, { partId: 0, quantity: 1 }])}>+ Ghi linh kiện sử dụng</Button>
        <label><input type="checkbox" checked={finishNow} onChange={(event) => setFinishNow(event.target.checked)} /> Đánh dấu công việc đã hoàn tất</label>
      </div>
      <Button disabled={actionDescription.trim().length < 3 || !validParts} loading={create.isPending} onClick={() => void submit()}>Lưu công việc</Button>
    </Card>
  );
}

function FinishRepairLog({ ticketId, log }: { ticketId: number; log: RepairLog }) {
  const update = useUpdateRepairLog(ticketId, log.id);
  const [result, setResult] = useState(log.result ?? "");
  return (
    <div className="assignment-box">
      <FormField label="Kết quả hoàn tất" htmlFor={`finish-log-${log.id}`} required>
        <textarea id={`finish-log-${log.id}`} rows={2} value={result} onChange={(event) => setResult(event.target.value)} />
      </FormField>
      <Button size="sm" disabled={result.trim().length < 1} loading={update.isPending} onClick={() => update.mutate({ result: result.trim(), finishedAt: new Date().toISOString() })}>Hoàn tất công việc</Button>
      <MutationError error={update.error} />
    </div>
  );
}

function CreateTestResultForm({ ticketId }: { ticketId: number }) {
  const create = useCreateTestResult(ticketId);
  const [testName, setTestName] = useState("");
  const [result, setResult] = useState<TestResultValue>("PASS");
  const [note, setNote] = useState("");
  const submit = async () => {
    if (testName.trim().length < 2) return;
    await create.mutateAsync({ testName: testName.trim(), result, note: note.trim() || null });
    setTestName("");
    setNote("");
  };
  return (
    <Card className="form-card">
      <div className="form-grid">
        <FormField label="Tên bài kiểm tra" htmlFor="test-result-name" required><input id="test-result-name" value={testName} onChange={(event) => setTestName(event.target.value)} /></FormField>
        <FormField label="Kết quả" htmlFor="test-result-value" required><select id="test-result-value" value={result} onChange={(event) => setResult(event.target.value as TestResultValue)}><option value="PASS">Đạt</option><option value="FAIL">Không đạt</option></select></FormField>
      </div>
      <FormField label="Ghi chú" htmlFor="test-result-note"><textarea id="test-result-note" rows={2} value={note} onChange={(event) => setNote(event.target.value)} /></FormField>
      <Button disabled={testName.trim().length < 2} loading={create.isPending} onClick={() => void submit()}>Ghi kết quả kiểm tra</Button>
      <MutationError error={create.error} />
    </Card>
  );
}

function CompleteTesting({ ticketId }: { ticketId: number }) {
  const complete = useCompleteTesting(ticketId);
  const [reason, setReason] = useState("");
  return (
    <Card className="form-card">
      <h3>Kết thúc vòng kiểm tra</h3>
      <p className="read-only-note">Hệ thống dùng kết quả mới nhất của từng bài kiểm tra. Linh kiện thợ yêu cầu và được kho thực tế cấp sẽ được tính vào hóa đơn theo đơn giá đã chốt khi yêu cầu; nhật ký linh kiện tại đây dùng để theo dõi công việc kỹ thuật.</p>
      <FormField label="Ghi chú kết luận" htmlFor="complete-testing-reason"><textarea id="complete-testing-reason" rows={2} value={reason} onChange={(event) => setReason(event.target.value)} /></FormField>
      <Button loading={complete.isPending} onClick={() => complete.mutate(reason.trim() || undefined)}>Hoàn tất kiểm tra</Button>
      <MutationError error={complete.error} />
    </Card>
  );
}
