import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import {
  MailboxComposeForm,
  type ComposePrefillDraft,
} from "@/components/admin/mailbox-compose-form";
import { listEmailDraftsAction } from "../actions";

export const metadata: Metadata = {
  title: "Nová zpráva",
};

export default async function MailboxComposePage({
  searchParams,
}: {
  searchParams: Promise<{ to?: string; draftId?: string }>;
}) {
  const { to, draftId } = await searchParams;

  let prefillDraft: ComposePrefillDraft | undefined;
  if (draftId) {
    // listEmailDraftsAction is per-author, so this only returns the draft if
    // the current admin actually owns it (no separate auth check needed here).
    const all = await listEmailDraftsAction({ limit: 200 });
    const found = all.find((d) => d.id === draftId);
    if (found) {
      prefillDraft = {
        id: found.id,
        fromAlias: found.fromAlias,
        toAddresses: found.toAddresses,
        subject: found.subject,
        bodyText: found.bodyText,
        bodyHtml: found.bodyHtml,
      };
    }
  }

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
            {prefillDraft ? "Pokračovat v konceptu" : "Nová zpráva"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {prefillDraft
              ? "Změny se ukládají automaticky každých 10 sekund."
              : "Odchozí zpráva založí novou konverzaci ve schránce."}
          </p>
        </div>
      </div>

      <MailboxComposeForm prefillTo={to} prefillDraft={prefillDraft} />
    </>
  );
}
