import Link from "next/link";
import { connection } from "next/server";
import { Mail, Paperclip, PenSquare, Search } from "lucide-react";
import type { Metadata } from "next";
import type { Prisma } from "@prisma/client";
import { getDb } from "@/lib/db";
import { formatRelativeTime } from "@/lib/format";

export const metadata: Metadata = {
  title: "Schránka",
};

const THREADS_PER_PAGE = 50;

function parseJsonList(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function truncate(text: string | null | undefined, max = 140): string {
  if (!text) return "";
  const collapsed = text.replace(/\s+/g, " ").trim();
  return collapsed.length > max ? collapsed.slice(0, max - 1) + "…" : collapsed;
}

export default async function AdminMailboxPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; q?: string }>;
}) {
  const params = await searchParams;
  const tab = params.tab === "archived" ? "archived" : "inbox";
  const q = (params.q ?? "").trim();

  await connection();
  const db = await getDb();

  const baseWhere: Prisma.EmailThreadWhereInput =
    tab === "archived"
      ? { archived: true, trashed: false }
      : { archived: false, trashed: false };

  const where: Prisma.EmailThreadWhereInput = q
    ? {
        AND: [
          baseWhere,
          {
            OR: [
              { subject: { contains: q } },
              { participants: { contains: q.toLowerCase() } },
              {
                messages: {
                  some: {
                    OR: [
                      { bodyText: { contains: q } },
                      { fromAddress: { contains: q.toLowerCase() } },
                      { fromName: { contains: q } },
                    ],
                  },
                },
              },
            ],
          },
        ],
      }
    : baseWhere;

  const [threads, totalUnread] = await Promise.all([
    db.emailThread.findMany({
      where,
      orderBy: { lastMessageAt: "desc" },
      take: THREADS_PER_PAGE,
      include: {
        messages: {
          orderBy: { receivedAt: "desc" },
          take: 1,
          select: {
            fromAddress: true,
            fromName: true,
            bodyText: true,
            receivedAt: true,
            attachments: { select: { id: true }, take: 1 },
          },
        },
      },
    }),
    db.emailThread.aggregate({
      where: { archived: false, trashed: false },
      _sum: { unreadCount: true },
    }),
  ]);

  const unread = totalUnread._sum.unreadCount ?? 0;

  return (
    <>
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground">
            Schránka
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {unread > 0
              ? `${unread} nepřečtených · ${threads.length} konverzací na této stránce`
              : `${threads.length} konverzací`}
          </p>
        </div>
        <Link
          href="/admin/mailbox/compose"
          className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <PenSquare className="size-4" />
          Nová zpráva
        </Link>
      </div>

      <form
        method="GET"
        action="/admin/mailbox"
        className="mt-4 flex items-center gap-2"
      >
        {tab === "archived" ? (
          <input type="hidden" name="tab" value="archived" />
        ) : null}
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Hledat v konverzacích (předmět, odesílatel, text)…"
            className="w-full rounded-lg border bg-background py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>
        {q ? (
          <Link
            href={tab === "archived" ? "/admin/mailbox?tab=archived" : "/admin/mailbox"}
            className="rounded-lg border px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            Vymazat
          </Link>
        ) : null}
      </form>

      <div className="mt-4 flex gap-1 border-b">
        <Link
          href="/admin/mailbox"
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            tab === "inbox"
              ? "border-b-2 border-primary text-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Doručené
        </Link>
        <Link
          href="/admin/mailbox?tab=archived"
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            tab === "archived"
              ? "border-b-2 border-primary text-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Archivované
        </Link>
      </div>

      {threads.length === 0 ? (
        <div className="mt-12 rounded-xl border bg-card p-12 text-center shadow-sm">
          <Mail className="mx-auto size-12 text-muted-foreground/30" />
          <p className="mt-4 text-lg font-medium text-muted-foreground">
            {tab === "archived" ? "Nic v archivu" : "Žádné e-maily"}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {q
              ? "Žádná konverzace nevyhovuje hledání."
              : tab === "archived"
                ? "Archivované konverzace se zobrazí tady."
                : "Příchozí e-maily z @jvsatnik.cz se zobrazí po nastavení IMAP serveru a spuštění sync cronu."}
          </p>
        </div>
      ) : (
        <div className="mt-6 overflow-hidden rounded-xl border bg-card shadow-sm">
          <ul className="divide-y">
            {threads.map((t) => {
              const last = t.messages[0];
              const participants = parseJsonList(t.participants);
              const senderLabel =
                last?.fromName?.trim() || last?.fromAddress || participants[0] || "—";
              const isUnread = t.unreadCount > 0;
              const hasAttachment = last?.attachments?.length ?? 0 > 0;
              return (
                <li key={t.id}>
                  <Link
                    href={`/admin/mailbox/${t.id}`}
                    className={`flex items-start gap-3 px-4 py-3 transition-colors hover:bg-muted/50 ${
                      isUnread ? "bg-primary/5" : ""
                    }`}
                  >
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                      {senderLabel.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <span
                          className={`truncate text-sm ${
                            isUnread ? "font-semibold text-foreground" : "text-foreground"
                          }`}
                        >
                          {senderLabel}
                        </span>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {last ? formatRelativeTime(last.receivedAt) : ""}
                        </span>
                      </div>
                      <p
                        className={`truncate text-sm ${
                          isUnread ? "font-medium text-foreground" : "text-muted-foreground"
                        }`}
                      >
                        {t.subject || "(bez předmětu)"}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {truncate(last?.bodyText, 120)}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      {isUnread ? (
                        <span className="inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-semibold leading-5 text-primary-foreground">
                          {t.unreadCount}
                        </span>
                      ) : null}
                      {hasAttachment ? (
                        <Paperclip
                          className="size-3.5 text-muted-foreground"
                          aria-label="Příloha"
                        />
                      ) : null}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </>
  );
}
