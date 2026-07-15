import { Card } from "../components/ui/card";
import { EmptyState } from "../components/ui/data-state";
import { PageHeader } from "../components/ui/page-header";

export function ExtensionPage() { return <><PageHeader eyebrow="Extension point" title="Module thu ngân" description="Frontend chưa dựng Cashier khi backend Invoice/Payment chưa có API." /><Card><EmptyState title="Đang chờ Phase 9" description="Route này giữ navigation ổn định mà không tạo contract thanh toán giả." /></Card></>; }
