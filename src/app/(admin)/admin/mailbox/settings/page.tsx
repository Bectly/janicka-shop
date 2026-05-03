import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import { connection } from "next/server";
import { listSignaturesAction } from "../actions";
import { SignatureManager } from "./signature-manager";

export const metadata: Metadata = {
  title: "Nastavení schránky",
};

const ALIAS_OPTIONS = [
  "podpora@jvsatnik.cz",
  "objednavky@jvsatnik.cz",
  "info@jvsatnik.cz",
  "novinky@jvsatnik.cz",
];

export default async function MailboxSettingsPage() {
  await connection();
  const signatures = await listSignaturesAction();
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
            Nastavení schránky
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Spravuj e-mailové podpisy pro jednotlivé aliasy.
          </p>
        </div>
      </div>

      <section className="mt-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Podpisy
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Podpis se automaticky vloží při psaní nové zprávy podle vybraného
          aliasu (jen pokud je tělo prázdné).
        </p>
        <div className="mt-4">
          <SignatureManager aliases={ALIAS_OPTIONS} initial={signatures} />
        </div>
      </section>
    </>
  );
}
