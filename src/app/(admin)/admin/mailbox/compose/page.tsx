import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import { MailboxComposeForm } from "@/components/admin/mailbox-compose-form";

export const metadata: Metadata = {
  title: "Nová zpráva",
};

export default async function MailboxComposePage({
  searchParams,
}: {
  searchParams: Promise<{ to?: string }>;
}) {
  const { to } = await searchParams;
  return (
    <>
      <div className="flex items-center gap-3">
        <Link
          href="/admin/mailbox"
          className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Zpět do schránky"
        >
          <ArrowLeft className="size-4" />
        </Link>
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground">
            Nová zpráva
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Odchozí zpráva založí novou konverzaci ve schránce.
          </p>
        </div>
      </div>

      <MailboxComposeForm prefillTo={to} />
    </>
  );
}
