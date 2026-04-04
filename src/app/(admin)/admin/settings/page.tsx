import type { Metadata } from "next";
import { getShopSettings } from "./actions";
import { SettingsForm } from "./settings-form";

export const metadata: Metadata = {
  title: "Nastavení obchodu",
};

export default async function AdminSettingsPage() {
  const settings = await getShopSettings();

  return (
    <>
      <h1 className="font-heading text-2xl font-bold text-foreground">
        Nastavení obchodu
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Základní konfigurace eshopu, kontaktní údaje a sociální sítě.
      </p>

      <div className="mt-6 rounded-xl border bg-card p-6 shadow-sm">
        <SettingsForm settings={settings} />
      </div>
    </>
  );
}
