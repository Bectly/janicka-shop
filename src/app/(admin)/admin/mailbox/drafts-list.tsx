"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileEdit, Trash2 } from "lucide-react";
import { formatRelativeTime } from "@/lib/format";
import { deleteEmailDraftAction } from "./actions";

type DraftItem = {
  id: string;
  threadId: string | null;
  fromAlias: string;
  toAddresses: string[];
  subject: string;
  bodyText: string;
  updatedAt: Date;
};

export function MailboxDraftsList({ drafts }: { drafts: DraftItem[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onDelete(id: string) {
    if (!confirm("Smazat tento koncept?")) return;
    setError(null);
    startTransition(async () => {
      try {
        await deleteEmailDraftAction(id);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Smazání selhalo.");
      }
    });
  }

  if (drafts.length === 0) {
    return (
      <div className="mt-12 rounded-xl border bg-card p-12 text-center shadow-sm">
        <FileEdit className="mx-auto size-12 text-muted-foreground/30" />
        <p className="mt-4 text-lg font-medium text-muted-foreground">
          Žádné koncepty
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Rozepsané zprávy se ukládají automaticky každých 10 sekund.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-6 overflow-hidden rounded-xl border bg-card shadow-sm">
      {error ? (
        <p className="border-b px-4 py-2 text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <ul className="divide-y">
        {drafts.map((d) => {
          const recipients = d.toAddresses.length > 0
            ? d.toAddresses.join(", ")
            : "(bez příjemce)";
          const subject = d.subject?.trim() || "(bez předmětu)";
          const preview = (d.bodyText ?? "").replace(/\s+/g, " ").trim();
          return (
            <li key={d.id} className="flex items-start gap-3 px-4 py-3">
              <Link
                href={`/admin/mailbox/compose?draftId=${encodeURIComponent(d.id)}`}
                className="flex flex-1 items-start gap-3 transition-colors hover:bg-muted/50"
              >
                <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-amber-500/10 text-xs font-semibold text-amber-600">
                  <FileEdit className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-sm font-semibold text-foreground">
                      {recipients}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {formatRelativeTime(d.updatedAt)}
                    </span>
                  </div>
                  <p className="truncate text-sm text-foreground">{subject}</p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {preview.length > 120 ? preview.slice(0, 119) + "…" : preview}
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground/70">
                    Odesílatel: {d.fromAlias}
                  </p>
                </div>
              </Link>
              <button
                type="button"
                onClick={() => onDelete(d.id)}
                disabled={pending}
                className="rounded p-2 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                aria-label={`Smazat koncept pro ${recipients}`}
              >
                <Trash2 className="size-4" />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
