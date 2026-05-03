import Link from "next/link";
import {
  Archive,
  FileEdit,
  Inbox,
  PenSquare,
  Send,
  Settings,
  Star,
  Trash2,
} from "lucide-react";
import {
  getMailboxFolderCounts,
  getMailboxLabels,
  type MailboxFolder,
} from "@/lib/mailbox-folders";
import { MailboxSidebarLink } from "./sidebar-link";
import { MailboxSidebarLabelLink } from "./sidebar-label-link";
import { MailboxLabelManager } from "./label-manager";

type FolderItem = {
  key: MailboxFolder;
  label: string;
  href: string;
  icon: "inbox" | "star" | "send" | "archive" | "trash" | "drafts";
  /** Show this number in bold next to the row when > 0 (e.g. unread). */
  highlight?: number;
  /** Subtle total count shown muted on the right. */
  total: number;
};

const ICONS = {
  inbox: Inbox,
  star: Star,
  send: Send,
  archive: Archive,
  trash: Trash2,
  drafts: FileEdit,
} as const;

export async function MailboxSidebar() {
  const [counts, labels] = await Promise.all([
    getMailboxFolderCounts(),
    getMailboxLabels(),
  ]);

  const items: FolderItem[] = [
    {
      key: "inbox",
      label: "Doručené",
      href: "/admin/mailbox",
      icon: "inbox",
      highlight: counts.inboxUnread,
      total: counts.inbox,
    },
    {
      key: "starred",
      label: "S hvězdičkou",
      href: "/admin/mailbox?folder=starred",
      icon: "star",
      total: counts.starred,
    },
    {
      key: "drafts",
      label: "Koncepty",
      href: "/admin/mailbox?folder=drafts",
      icon: "drafts",
      total: counts.drafts,
    },
    {
      key: "sent",
      label: "Odeslané",
      href: "/admin/mailbox?folder=sent",
      icon: "send",
      total: counts.sent,
    },
    {
      key: "archived",
      label: "Archiv",
      href: "/admin/mailbox?folder=archived",
      icon: "archive",
      total: counts.archived,
    },
    {
      key: "trash",
      label: "Koš",
      href: "/admin/mailbox?folder=trash",
      icon: "trash",
      total: counts.trash,
    },
  ];

  return (
    <aside
      aria-label="Složky schránky"
      className="w-full shrink-0 lg:w-56"
    >
      <Link
        href="/admin/mailbox/compose"
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary/40"
      >
        <PenSquare className="size-4" />
        Napsat
      </Link>

      <nav className="mt-4">
        <ul className="space-y-0.5">
          {items.map((it) => {
            const Icon = ICONS[it.icon];
            return (
              <li key={it.key}>
                <MailboxSidebarLink
                  folder={it.key}
                  href={it.href}
                  label={it.label}
                  highlight={it.highlight ?? 0}
                  total={it.total}
                >
                  <Icon className="size-4 shrink-0" />
                </MailboxSidebarLink>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="mt-6 border-t pt-4">
        <div className="flex items-center justify-between px-3 pb-1">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/70">
            Štítky
          </span>
        </div>
        {labels.length > 0 ? (
          <ul className="space-y-0.5">
            {labels.map((l) => (
              <li key={l.id}>
                <MailboxSidebarLabelLink
                  labelId={l.id}
                  name={l.name}
                  color={l.color}
                  total={l.threadCount}
                />
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-3 py-2 text-xs text-muted-foreground/70">
            Žádné štítky.
          </p>
        )}
        <div className="mt-1">
          <MailboxLabelManager />
        </div>
      </div>

      <div className="mt-6 border-t pt-4">
        <Link
          href="/admin/mailbox/settings"
          className="inline-flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <Settings className="size-3.5" />
          Nastavení
        </Link>
      </div>
    </aside>
  );
}
