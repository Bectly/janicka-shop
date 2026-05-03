"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import type { MailboxFolder } from "@/lib/mailbox-folders";

/**
 * Folder row that highlights itself when the current URL matches.
 * Lives on the client so the layout (which can't see searchParams) can still
 * render an active-state aware sidebar without a parallel-routes dance.
 */
export function MailboxSidebarLink({
  folder,
  href,
  label,
  highlight,
  total,
  children,
}: {
  folder: MailboxFolder;
  href: string;
  label: string;
  highlight: number;
  total: number;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentFolder = searchParams.get("folder");

  // Active when on the mailbox index AND the folder query matches.
  // Inbox (no query) matches when ?folder is absent or "inbox".
  const onIndex = pathname === "/admin/mailbox";
  const isActive =
    onIndex &&
    (folder === "inbox"
      ? currentFolder === null || currentFolder === "inbox"
      : currentFolder === folder);

  return (
    <Link
      href={href}
      aria-current={isActive ? "page" : undefined}
      className={`group flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
        isActive
          ? "bg-primary/10 font-semibold text-foreground"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      }`}
    >
      <span
        className={isActive ? "text-primary" : "text-muted-foreground/80"}
      >
        {children}
      </span>
      <span className="flex-1 truncate">{label}</span>
      {highlight > 0 ? (
        <span className="rounded-md bg-primary px-1.5 py-0.5 text-[11px] font-semibold leading-4 text-primary-foreground">
          {highlight}
        </span>
      ) : total > 0 ? (
        <span className="text-[11px] font-medium tabular-nums text-muted-foreground/70">
          {total}
        </span>
      ) : null}
    </Link>
  );
}
