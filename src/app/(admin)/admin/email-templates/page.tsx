import type { Metadata } from "next";
import { connection } from "next/server";
import { getCollectionsForEditor } from "./actions";
import { EmailEditor } from "./email-editor";

export const metadata: Metadata = {
  title: "E-mail editor",
};

export default async function AdminEmailTemplatesPage() {
  await connection();
  const collections = await getCollectionsForEditor();

  return (
    <>
      <h1 className="font-heading text-2xl font-bold text-foreground">
        E-mail editor
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Sestavte newsletter kampaň, zkontrolujte náhled a odešlete test na svůj e-mail.
      </p>
      <div className="mt-6">
        <EmailEditor collections={collections} />
      </div>
    </>
  );
}
