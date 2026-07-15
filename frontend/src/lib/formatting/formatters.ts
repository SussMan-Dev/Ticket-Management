export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: import.meta.env.VITE_TIME_ZONE || undefined,
  }).format(new Date(value));
}

export function formatMoney(value: number): string {
  const currency = import.meta.env.VITE_CURRENCY?.trim();
  if (!currency) return `${new Intl.NumberFormat("vi-VN").format(value)} đơn vị tiền`;
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(value);
}

export function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(-2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}
