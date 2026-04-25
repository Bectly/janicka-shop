import type {
  HumanTaskCategory,
  HumanTaskPriority,
} from "@/lib/jarvis-db";

/**
 * Czech labels + Tailwind class palettes for category/priority badges.
 * Keeping them in one place so card + dialog stay visually consistent.
 */

export const CATEGORY_LABELS: Record<HumanTaskCategory, string> = {
  sales: "Prodej",
  marketing: "Marketing",
  tech: "Technika",
  analytics: "Analytika",
  people: "Lidé",
  strategy: "Strategie",
  admin: "Admin",
  other: "Ostatní",
};

export const CATEGORY_CLASSES: Record<HumanTaskCategory, string> = {
  sales: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300",
  marketing: "bg-violet-100 text-violet-800 dark:bg-violet-950/40 dark:text-violet-300",
  tech: "bg-sky-100 text-sky-800 dark:bg-sky-950/40 dark:text-sky-300",
  analytics: "bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300",
  people: "bg-pink-100 text-pink-800 dark:bg-pink-950/40 dark:text-pink-300",
  strategy: "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300",
  admin: "bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-200",
  other: "bg-muted text-muted-foreground",
};

export const PRIORITY_LABELS: Record<HumanTaskPriority, string> = {
  urgent: "Urgentní",
  high: "Vysoká",
  medium: "Střední",
  low: "Nízká",
};

export const PRIORITY_CLASSES: Record<HumanTaskPriority, string> = {
  urgent: "bg-red-600 text-white",
  high: "bg-amber-500 text-white",
  medium: "bg-muted text-muted-foreground",
  low: "bg-muted/60 text-muted-foreground",
};

/**
 * Quick-and-dirty markdown → plain text for preview snippets. Strips fenced
 * code blocks, headings markers, lists, links → text, bold/italic markers.
 * Not a full parser — just enough to make a 200-char preview readable.
 */
export function stripMarkdown(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^[-*+]\s+/gm, "")
    .replace(/^\s*\d+\.\s+/gm, "")
    .replace(/[*_]{1,3}([^*_]+)[*_]{1,3}/g, "$1")
    .replace(/>\s?/g, "")
    .replace(/\n{2,}/g, "\n")
    .replace(/\s+/g, " ")
    .trim();
}

export function previewText(md: string, max = 200): string {
  const stripped = stripMarkdown(md);
  if (stripped.length <= max) return stripped;
  return `${stripped.slice(0, max - 1)}…`;
}

/**
 * Format an ISO datetime (CEST = UTC+2 during summer; the Manager Framework
 * inserts via SQLite `datetime('now')` which is UTC). We render in cs-CZ.
 */
export function formatCzDate(iso: string): string {
  // SQLite `datetime('now')` returns "YYYY-MM-DD HH:MM:SS" without timezone.
  // Treat as UTC.
  const normalized = iso.includes("T") ? iso : iso.replace(" ", "T") + "Z";
  const d = new Date(normalized);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("cs-CZ", {
    day: "numeric",
    month: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Prague",
  }).format(d);
}

export function formatCzDueDate(iso: string): string {
  const normalized = iso.includes("T") ? iso : iso.replace(" ", "T") + "Z";
  const d = new Date(normalized);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("cs-CZ", {
    day: "numeric",
    month: "numeric",
    year: "numeric",
    timeZone: "Europe/Prague",
  }).format(d);
}
