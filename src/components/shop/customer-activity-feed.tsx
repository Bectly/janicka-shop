import { labelForAction } from "@/lib/audit-log";

interface Entry {
  action: string;
  ip: string | null;
  userAgent: string | null;
  metadata: string;
  createdAt: Date;
}

function formatWhen(d: Date): string {
  return new Intl.DateTimeFormat("cs-CZ", {
    day: "numeric",
    month: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

function summarizeUserAgent(ua: string | null): string {
  if (!ua) return "";
  if (/iPhone|iPad|iPod/i.test(ua)) return "iOS";
  if (/Android/i.test(ua)) return "Android";
  if (/Macintosh/i.test(ua)) return "Mac";
  if (/Windows/i.test(ua)) return "Windows";
  if (/Linux/i.test(ua)) return "Linux";
  return "";
}

export function CustomerActivityFeed({
  entries,
  showIp = false,
}: {
  entries: Entry[];
  showIp?: boolean;
}) {
  if (entries.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Žádná aktivita na účtu zatím nebyla zaznamenána.
      </p>
    );
  }

  return (
    <ol className="space-y-2 text-sm">
      {entries.map((entry, idx) => {
        const device = summarizeUserAgent(entry.userAgent);
        return (
          <li
            key={idx}
            className="flex items-start justify-between gap-3 rounded-lg border bg-background/50 px-3 py-2"
          >
            <div className="min-w-0">
              <p className="font-medium text-foreground">{labelForAction(entry.action)}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {formatWhen(entry.createdAt)}
                {device ? ` · ${device}` : ""}
                {showIp && entry.ip ? ` · ${entry.ip}` : ""}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
