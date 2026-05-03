import { cacheLife, cacheTag } from "next/cache";
import type { Prisma } from "@prisma/client";
import { getDb } from "@/lib/db";

export type MailboxFolder =
  | "inbox"
  | "starred"
  | "sent"
  | "archived"
  | "trash"
  | "drafts";

export type MailboxFolderCounts = Record<MailboxFolder, number> & {
  inboxUnread: number;
};

export function isMailboxFolder(value: unknown): value is MailboxFolder {
  return (
    value === "inbox" ||
    value === "starred" ||
    value === "sent" ||
    value === "archived" ||
    value === "trash" ||
    value === "drafts"
  );
}

/**
 * Thread-table filter for folder views. Drafts live in EmailDraft (separate
 * table) so this throws — page-level code branches on folder==="drafts" first.
 */
export function folderWhere(folder: MailboxFolder): Prisma.EmailThreadWhereInput {
  switch (folder) {
    case "inbox":
      return { archived: false, trashed: false };
    case "starred":
      return { flagged: true, trashed: false };
    case "sent":
      return {
        trashed: false,
        messages: { some: { direction: "outbound" } },
      };
    case "archived":
      return { archived: true, trashed: false };
    case "trash":
      return { trashed: true };
    case "drafts":
      throw new Error("folderWhere: drafts is not an EmailThread folder");
  }
}

/**
 * Folder counts shown in the mailbox sidebar. Cached and tagged "admin-mailbox"
 * so writers (archive/trash/flag/sync) drop the entry alongside the page.
 */
export async function getMailboxFolderCounts(): Promise<MailboxFolderCounts> {
  "use cache";
  cacheLife({ stale: 30, revalidate: 30, expire: 120 });
  cacheTag("admin-mailbox");

  const db = await getDb();

  const [inbox, starred, sent, archived, trash, drafts, inboxUnreadAgg] =
    await Promise.all([
      db.emailThread.count({ where: folderWhere("inbox") }),
      db.emailThread.count({ where: folderWhere("starred") }),
      db.emailThread.count({ where: folderWhere("sent") }),
      db.emailThread.count({ where: folderWhere("archived") }),
      db.emailThread.count({ where: folderWhere("trash") }),
      db.emailDraft.count(),
      db.emailThread.aggregate({
        where: { archived: false, trashed: false },
        _sum: { unreadCount: true },
      }),
    ]);

  return {
    inbox,
    starred,
    sent,
    archived,
    trash,
    drafts,
    inboxUnread: inboxUnreadAgg._sum.unreadCount ?? 0,
  };
}

export type MailboxLabelSummary = {
  id: string;
  name: string;
  color: string;
  /** Threads with this label that aren't trashed (matches the sidebar filter). */
  threadCount: number;
};

/**
 * Sidebar label list with non-trashed thread counts. Same cache lifetime as
 * folder counts so the labels section stays cheap on repeat renders.
 */
export async function getMailboxLabels(): Promise<MailboxLabelSummary[]> {
  "use cache";
  cacheLife({ stale: 30, revalidate: 30, expire: 120 });
  cacheTag("admin-mailbox");

  const db = await getDb();
  const labels = await db.emailLabel.findMany({ orderBy: { name: "asc" } });
  if (labels.length === 0) return [];

  const counts = await db.emailThreadLabel.groupBy({
    by: ["labelId"],
    where: { thread: { trashed: false } },
    _count: { _all: true },
  });
  const byId = new Map(counts.map((c) => [c.labelId, c._count._all]));

  return labels.map((l) => ({
    id: l.id,
    name: l.name,
    color: l.color,
    threadCount: byId.get(l.id) ?? 0,
  }));
}
