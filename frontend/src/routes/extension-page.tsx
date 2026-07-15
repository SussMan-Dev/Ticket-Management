import { Card } from "../components/ui/card";
import { EmptyState } from "../components/ui/data-state";
import { PageHeader } from "../components/ui/page-header";

export function ExtensionPage() { return <><PageHeader eyebrow="Extension point" title="Module nghiệp vụ tiếp theo" description="Frontend không dựng Inventory Staff hoặc Cashier khi backend chưa có API." /><Card><EmptyState title="Đang chờ backend" description="Phase 7 sẽ cung cấp Parts/Inventory; Phase 9 sẽ cung cấp Invoice/Payment. Route này giữ navigation ổn định mà không tạo contract giả." /></Card></>; }
