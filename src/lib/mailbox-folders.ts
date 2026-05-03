import { cacheLife, cacheTag } from "next/cache";
import type { Prisma } from "@prisma/client";
import { getDb } from "@/lib/db";

export type MailboxFolder =
  | "inbox"
  | "starred"
  | "sent"
  | "archived"
  | "trash";

export type MailboxFolderCounts = Record<MailboxFolder, number> & {
  inboxUnread: number;
};

export function isMailboxFolder(value: unknown): value is MailboxFolder {
  return (
    value === "inbox" ||
    value === "starred" ||
    value === "sent" ||
    value === "archived" ||
    value === "trash"
  );
}

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

  const [inbox, starred, sent, archived, trash, inboxUnreadAgg] =
    await Promise.all([
      db.emailThread.count({ where: folderWhere("inbox") }),
      db.emailThread.count({ where: folderWhere("starred") }),
      db.emailThread.count({ where: folderWhere("sent") }),
      db.emailThread.count({ where: folderWhere("archived") }),
      db.emailThread.count({ where: folderWhere("trash") }),
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
    inboxUnread: inboxUnreadAgg._sum.unreadCount ?? 0,
  };
}
