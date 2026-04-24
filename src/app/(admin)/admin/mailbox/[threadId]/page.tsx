import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { ArrowLeft, Paperclip, Star } from "lucide-react";
import type { Metadata } from "next";
import { getDb } from "@/lib/db";
import { formatDate } from "@/lib/format";
import {
  archiveThreadAction,
  flagThreadAction,
  markThreadReadAction,
  markThreadUnreadAction,
  trashThreadAction,
  unarchiveThreadAction,
} from "../actions";

export const metadata: Metadata = {
  title: "Konverzace",
};

function parseJsonList(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export default async function AdminThreadPage({
  params,
}: {
  params: Promise<{ threadId: string }>;
}) {
  const { threadId } = await params;

  await connection();
  const db = await getDb();

  const thread = await db.emailThread.findUnique({
    where: { id: threadId },
    include: {
      messages: {
        orderBy: { receivedAt: "asc" },
        include: {
          attachments: true,
        },
      },
    },
  });

  if (!thread) notFound();

  // Mark the thread as read on view (best-effort, non-blocking semantics via a
  // fire-and-forget update in server action would be ideal — but RSC path is OK
  // here since Prisma update is fast).
  if (thread.unreadCount > 0) {
    const now = new Date();
    await db.emailMessage.updateMany({
      where: { threadId: thread.id, readAt: null },
      data: { readAt: now },
    });
    await db.emailThread.update({
      where: { id: thread.id },
      data: { unreadCount: 0 },
    });
  }

  const markReadBound = markThreadReadAction.bind(null, thread.id);
  const markUnreadBound = markThreadUnreadAction.bind(null, thread.id);
  const archiveBound = archiveThreadAction.bind(null, thread.id);
  const unarchiveBound = unarchiveThreadAction.bind(null, thread.id);
  const trashBound = trashThreadAction.bind(null, thread.id);
  const flagBound = flagThreadAction.bind(null, thread.id, !thread.flagged);

  return (
    <>
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href="/admin/mailbox"
            className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Zpět do schránky"
          >
            <ArrowLeft className="size-4" />
          </Link>
          <div className="min-w-0">
            <h1 className="truncate font-heading text-xl font-bold text-foreground">
              {thread.subject || "(bez předmětu)"}
            </h1>
            <p className="text-xs text-muted-foreground">
              {thread.messageCount} zprávy · poslední {formatDate(thread.lastMessageAt)}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 gap-1">
          <form action={flagBound}>
            <button
              type="submit"
              className={`rounded-lg p-2 transition-colors ${
                thread.flagged
                  ? "bg-amber-100 text-amber-700 hover:bg-amber-200"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
              aria-label={thread.flagged ? "Odznačit" : "Označit hvězdičkou"}
            >
              <Star className={`size-4 ${thread.flagged ? "fill-current" : ""}`} />
            </button>
          </form>
          <form action={markUnreadBound}>
            <button
              type="submit"
              className="rounded-lg px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              Nepřečtené
            </button>
          </form>
          <form action={thread.archived ? unarchiveBound : archiveBound}>
            <button
              type="submit"
              className="rounded-lg px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              {thread.archived ? "Obnovit" : "Archivovat"}
            </button>
          </form>
          <form action={trashBound}>
            <button
              type="submit"
              className="rounded-lg px-3 py-2 text-xs font-medium text-destructive transition-colors hover:bg-destructive/10"
            >
              Koš
            </button>
          </form>
          {/* Hidden marker action so TS doesn't complain about the unused binding */}
          <form action={markReadBound} className="hidden" />
        </div>
      </div>

      <div className="mt-6 space-y-4">
        {thread.messages.map((m, i) => {
          const toList = parseJsonList(m.toAddresses);
          const ccList = parseJsonList(m.ccAddresses);
          const isOutbound = m.direction === "outbound";
          const isLatest = i === thread.messages.length - 1;
          return (
            <article
              key={m.id}
              className={`overflow-hidden rounded-xl border bg-card shadow-sm ${
                isOutbound ? "border-primary/30" : ""
              }`}
            >
              <header className="border-b px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-baseline gap-2">
                      <span className="truncate text-sm font-semibold text-foreground">
                        {m.fromName?.trim() || m.fromAddress}
                      </span>
                      {isOutbound ? (
                        <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-primary">
                          Odesláno
                        </span>
                      ) : null}
                    </div>
                    <p className="truncate text-xs text-muted-foreground">
                      {m.fromAddress} → {toList.join(", ") || "—"}
                      {ccList.length > 0 ? ` · kopie: ${ccList.join(", ")}` : ""}
                    </p>
                  </div>
                  <time
                    dateTime={m.receivedAt.toISOString()}
                    className="shrink-0 text-xs text-muted-foreground"
                  >
                    {formatDate(m.receivedAt)}
                  </time>
                </div>
              </header>

              <div className="px-4 py-4">
                <MessageBody
                  bodyHtml={m.bodyHtml}
                  bodyText={m.bodyText}
                  collapsed={!isLatest && thread.messages.length > 3}
                />
              </div>

              {m.attachments.length > 0 ? (
                <footer className="flex flex-wrap gap-2 border-t bg-muted/30 px-4 py-3">
                  {m.attachments.map((a) => (
                    <div
                      key={a.id}
                      className="flex items-center gap-2 rounded-lg border bg-card px-3 py-1.5 text-xs"
                    >
                      <Paperclip className="size-3.5 text-muted-foreground" />
                      <span className="max-w-[160px] truncate font-medium">
                        {a.filename}
                      </span>
                      <span className="text-muted-foreground">
                        {formatBytes(a.sizeBytes)}
                      </span>
                    </div>
                  ))}
                </footer>
              ) : null}
            </article>
          );
        })}
      </div>

      <div className="mt-6 rounded-xl border border-dashed bg-card/50 p-6 text-center text-sm text-muted-foreground">
        Odpovídání a psaní nové zprávy přijde v další iteraci (Phase 3).
      </div>
    </>
  );
}

function MessageBody({
  bodyHtml,
  bodyText,
  collapsed,
}: {
  bodyHtml: string | null;
  bodyText: string | null;
  collapsed: boolean;
}) {
  if (bodyHtml) {
    return (
      <iframe
        sandbox=""
        srcDoc={bodyHtml}
        className={`w-full border-0 ${collapsed ? "h-40" : "h-[480px]"}`}
        title="Tělo e-mailu"
      />
    );
  }
  const text = bodyText ?? "(Zpráva bez textového obsahu)";
  return (
    <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-relaxed text-foreground">
      {text}
    </pre>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} kB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
