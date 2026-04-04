export function formatPrice(price: number): string {
  return new Intl.NumberFormat("cs-CZ", {
    style: "currency",
    currency: "CZK",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price);
}

export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("cs-CZ", {
    day: "numeric",
    month: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function formatRelativeTime(date: Date): string {
  const now = Date.now();
  const diffMs = now - date.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  const diffH = Math.floor(diffMs / 3_600_000);
  const diffD = Math.floor(diffMs / 86_400_000);

  if (diffMin < 1) return "Právě teď";
  if (diffMin < 60) return `Před ${diffMin} min`;
  if (diffH < 24) return `Před ${diffH} h`;
  if (diffD === 1) return "Včera";
  if (diffD < 7) return `Před ${diffD} dny`;
  const weeks = Math.floor(diffD / 7);
  if (diffD < 30) return weeks === 1 ? "Před týdnem" : `Před ${weeks} týd.`;
  return new Intl.DateTimeFormat("cs-CZ", { day: "numeric", month: "numeric" }).format(date);
}
