import type { Metadata } from "next";
import { connection } from "next/server";
import { getCollectionsForEditor, listTemplateEntries } from "./actions";
import { EmailEditor } from "./email-editor";
import { TemplatesList } from "./templates-list";

export const metadata: Metadata = {
  title: "E-mail šablony",
};

export default async function AdminEmailTemplatesPage() {
  await connection();
  const [collections, templates] = await Promise.all([
    getCollectionsForEditor(),
    listTemplateEntries(),
  ]);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-heading text-2xl font-bold text-foreground">
          E-mail šablony
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Náhled a test transakčních e-mailů + editor newsletter kampaní.
        </p>
      </header>

      <TemplatesList templates={templates} />

      <section>
        <h2 className="font-heading text-xl font-semibold text-foreground">
          Newsletter kampaň
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Sestavte newsletter kampaň, zkontrolujte náhled a odešlete test na svůj e-mail.
        </p>
        <div className="mt-4">
          <EmailEditor collections={collections} />
        </div>
      </section>
    </div>
  );
}
