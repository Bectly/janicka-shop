"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

export function MailboxSidebarLabelLink({
  labelId,
  name,
  color,
  total,
}: {
  labelId: string;
  name: string;
  color: string;
  total: number;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isActive =
    pathname === "/admin/mailbox" &&
    searchParams.get("label") === labelId;

  return (
    <Link
      href={`/admin/mailbox?label=${encodeURIComponent(labelId)}`}
      aria-current={isActive ? "page" : undefined}
      className={`group flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
        isActive
          ? "bg-primary/10 font-semibold text-foreground"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      }`}
    >
      <span
        aria-hidden
        className="size-3 shrink-0 rounded-full"
        style={{ backgroundColor: color }}
      />
      <span className="flex-1 truncate">{name}</span>
      {total > 0 ? (
        <span className="text-[11px] font-medium tabular-nums text-muted-foreground/70">
          {total}
        </span>
      ) : null}
    </Link>
  );
}
