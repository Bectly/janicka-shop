import { Suspense } from "react";
import { connection } from "next/server";
import { MailboxSidebar } from "@/components/admin/mailbox/sidebar";

export default async function MailboxLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Mailbox is per-admin and DB-backed; opt the whole subtree out of build-time
  // prerender so the sidebar's folder-count query never runs without a live DB.
  await connection();

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:gap-8">
      <Suspense
        fallback={
          <div
            aria-hidden
            className="h-10 w-full animate-pulse rounded-lg bg-muted lg:w-56"
          />
        }
      >
        <MailboxSidebar />
      </Suspense>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
