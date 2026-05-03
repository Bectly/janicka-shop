import { Suspense } from "react";
import { MailboxSidebar } from "@/components/admin/mailbox/sidebar";

export default function MailboxLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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
