import Link from "next/link";
import { cacheLife, cacheTag } from "next/cache";
import { connection } from "next/server";
import { Mail, Paperclip, Star } from "lucide-react";
import type { Metadata } from "next";
import type { Prisma } from "@prisma/client";
import { getDb } from "@/lib/db";
import { formatRelativeTime } from "@/lib/format";
import {
  folderWhere,
  isMailboxFolder,
  type MailboxFolder,
} from "@/lib/mailbox-folders";
import { MailboxSearch } from "./mailbox-search";
import { MailboxDraftsList } from "./drafts-list";
import { listEmailDraftsAction } from "./actions";

export const metadata: Metadata = {
  title: "Schránka",
};

const THREADS_PER_PAGE = 50;

const FOLDER_LABELS: Record<MailboxFolder, string> = {
  inbox: "Doručené",
  starred: "S hvězdičkou",
  sent: "Odeslané",
  archived: "Archiv",
  trash: "Koš",
  drafts: "Koncepty",
};

const EMPTY_HINT: Record<MailboxFolder, string> = {
  inbox:
    "E-maily pro info@jvsatnik.cz a další aliasy se zobrazí po zapnutí inbound (Cloudflare Email Routing → Resend Inbound webhook → /api/email/inbound, env RESEND_INBOUND_SECRET).",
  starred: "Označené hvězdičkou se zobrazí tady.",
  sent: "Odeslané zprávy se zobrazí tady.",
  archived: "Archivované konverzace se zobrazí tady.",
  trash: "Vyhozené zprávy zůstanou tady, dokud je nesmažete natrvalo.",
  drafts: "Rozepsané zprávy se ukládají automaticky každých 10 sekund.",
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

function truncate(text: string | null | undefined, max = 140): string {
  if (!text) return "";
  const collapsed = text.replace(/\s+/g, " ").trim();
  return collapsed.length > max ? collapsed.slice(0, max - 1) + "…" : collapsed;
}

async function getMailboxPageData(
  folder: MailboxFolder,
  q: string,
  labelId: string | null,
) {
  "use cache";
  // Mailbox is expected to feel fresh — 30s TTL keeps IMAP sync visibility tight.
  cacheLife({ stale: 30, revalidate: 30, expire: 120 });
  cacheTag("admin-mailbox");

  const db = await getDb();

  const baseWhere: Prisma.EmailThreadWhereInput = labelId
    ? {
        trashed: false,
        threadLabels: { some: { labelId } },
      }
    : folderWhere(folder);

  // #524d: bodyText + fromAddress dropped from search OR. bodyText is an unindexed
  // large TEXT column (table-scan on every keystroke); fromAddress is redundant with
  // participants which already contains the normalized address list.
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
                  some: { fromName: { contains: q } },
                },
              },
            ],
          },
        ],
      }
    : baseWhere;

  const [threads, totalUnread, label] = await Promise.all([
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
        threadLabels: {
          include: {
            label: { select: { id: true, name: true, color: true } },
          },
        },
      },
    }),
    db.emailThread.aggregate({
      where: folderWhere("inbox"),
      _sum: { unreadCount: true },
    }),
    labelId
      ? db.emailLabel.findUnique({
          where: { id: labelId },
          select: { id: true, name: true, color: true },
        })
      : Promise.resolve(null),
  ]);

  return { threads, unread: totalUnread._sum.unreadCount ?? 0, label };
}

export default async function AdminMailboxPage({
  searchParams,
}: {
  searchParams: Promise<{ folder?: string; q?: string; label?: string }>;
}) {
  await connection();
  const params = await searchParams;
  const folder: MailboxFolder = isMailboxFolder(params.folder)
    ? params.folder
    : "inbox";
  const q = (params.q ?? "").trim();
  const labelId =
    typeof params.label === "string" && params.label ? params.label : null;

  if (folder === "drafts") {
    const drafts = await listEmailDraftsAction({ limit: 100 });
    return (
      <>
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <h1 className="font-heading text-2xl font-bold text-foreground">
              {FOLDER_LABELS.drafts}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {drafts.length === 0
                ? EMPTY_HINT.drafts
                : `${drafts.length} rozepsaných zpráv`}
            </p>
          </div>
        </div>
        <MailboxDraftsList drafts={drafts} />
      </>
    );
  }

  const { threads, unread, label } = await getMailboxPageData(folder, q, labelId);

  const heading = label ? `Štítek: ${label.name}` : FOLDER_LABELS[folder];

  return (
    <>
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-heading text-2xl font-bold text-foreground">
            {heading}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {!label && folder === "inbox" && unread > 0
              ? `${unread} nepřečtených · ${threads.length} konverzací na této stránce`
              : `${threads.length} konverzací`}
          </p>
        </div>
      </div>

      <MailboxSearch folder={folder} initialQ={q} />

      {threads.length === 0 ? (
        <div className="mt-12 rounded-xl border bg-card p-12 text-center shadow-sm">
          <Mail className="mx-auto size-12 text-muted-foreground/30" />
          <p className="mt-4 text-lg font-medium text-muted-foreground">
            {q ? "Žádné výsledky" : "Tato složka je prázdná"}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {q ? "Žádná konverzace nevyhovuje hledání." : EMPTY_HINT[folder]}
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
              const isUnread = t.unreadCount > 0 && folder !== "sent";
              const hasAttachment = (last?.attachments?.length ?? 0) > 0;
              return (
                <li key={t.id}>
                  <Link
                    href={`/admin/mailbox/${t.id}`}
                    className={`flex items-start gap-3 px-4 py-3 transition-colors hover:bg-muted/50 ${
                      isUnread ? "bg-primary/5" : ""
                    }`}
                  >
                    <div className="relative flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                      {senderLabel.slice(0, 2).toUpperCase()}
                      {t.flagged ? (
                        <Star
                          className="absolute -right-1 -top-1 size-3.5 fill-amber-400 text-amber-500"
                          aria-label="Hvězdička"
                        />
                      ) : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <span
                          className={`truncate text-sm ${
                            isUnread
                              ? "font-semibold text-foreground"
                              : "text-foreground"
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
                          isUnread
                            ? "font-medium text-foreground"
                            : "text-muted-foreground"
                        }`}
                      >
                        {t.subject || "(bez předmětu)"}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {truncate(last?.bodyText, 120)}
                      </p>
                      {t.threadLabels.length > 0 ? (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {t.threadLabels.map((tl) => (
                            <span
                              key={tl.label.id}
                              className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium"
                              style={{
                                backgroundColor: `${tl.label.color}20`,
                                color: tl.label.color,
                              }}
                            >
                              <span
                                aria-hidden
                                className="size-1 rounded-full"
                                style={{ backgroundColor: tl.label.color }}
                              />
                              {tl.label.name}
                            </span>
                          ))}
                        </div>
                      ) : null}
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
