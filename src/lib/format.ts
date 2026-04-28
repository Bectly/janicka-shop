const TIME_ZONE = "Europe/Prague";
const LOCALE = "cs-CZ";

export function formatPrice(price: number): string {
  return new Intl.NumberFormat(LOCALE, {
    style: "currency",
    currency: "CZK",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price);
}

type DateInput = Date | string | number | null | undefined;

function toDate(input: DateInput): Date | null {
  if (input == null) return null;
  const d = input instanceof Date ? input : new Date(input);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatDate(input: DateInput): string {
  const date = toDate(input);
  if (!date) return "";
  return new Intl.DateTimeFormat(LOCALE, {
    day: "numeric",
    month: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TIME_ZONE,
  }).format(date);
}

export function formatDateOnly(input: DateInput): string {
  const date = toDate(input);
  if (!date) return "";
  return new Intl.DateTimeFormat(LOCALE, {
    day: "numeric",
    month: "numeric",
    year: "numeric",
    timeZone: TIME_ZONE,
  }).format(date);
}

export function formatDateTime(input: DateInput): string {
  const date = toDate(input);
  if (!date) return "";
  return new Intl.DateTimeFormat(LOCALE, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TIME_ZONE,
  }).format(date);
}

export function formatTime(input: DateInput): string {
  const date = toDate(input);
  if (!date) return "";
  return new Intl.DateTimeFormat(LOCALE, {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TIME_ZONE,
  }).format(date);
}

export function formatLongDate(input: DateInput): string {
  const date = toDate(input);
  if (!date) return "";
  return new Intl.DateTimeFormat(LOCALE, {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: TIME_ZONE,
  }).format(date);
}

export function formatTimeAgo(input: DateInput): string {
  const date = toDate(input);
  if (!date) return "";
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
  if (diffD < 30) return weeks === 1 ? "Před týdnem" : `Před ${weeks} týdny`;
  return new Intl.DateTimeFormat(LOCALE, {
    day: "numeric",
    month: "numeric",
    timeZone: TIME_ZONE,
  }).format(date);
}

export const formatRelativeTime = formatTimeAgo;
