import type { Metadata } from "next";
import { cacheLife, cacheTag } from "next/cache";
import { getDb } from "@/lib/db";
import { SettingsForm } from "./settings-form";
import { PasswordChangeForm } from "./password-form";
import { MeasurementsBackfill } from "./measurements-backfill";

export const metadata: Metadata = {
  title: "Nastavení obchodu",
};

async function getCachedShopSettings() {
  "use cache";
  cacheLife("minutes");
  cacheTag("admin-settings");

  const db = await getDb();
  return db.shopSettings.findUnique({
    where: { id: "singleton" },
  });
}

export default async function AdminSettingsPage() {
  let settings = await getCachedShopSettings();
  if (!settings) {
    const db = await getDb();
    settings = await db.shopSettings.create({ data: { id: "singleton" } });
  }

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

      <div className="mt-6 rounded-xl border bg-card p-6 shadow-sm">
        <h2 className="font-heading text-lg font-semibold text-foreground">
          Změna hesla
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Změňte přihlašovací heslo do administrace.
        </p>
        <div className="mt-4">
          <PasswordChangeForm />
        </div>
      </div>

      <div className="mt-6 rounded-xl border bg-card p-6 shadow-sm">
        <h2 className="font-heading text-lg font-semibold text-foreground">
          Údržba dat — rozměry produktů
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Hromadně doplní rozměry (hrudník, pas, boky, délka) do produktů
          z původních popisků z Vinted.
        </p>
        <div className="mt-4">
          <MeasurementsBackfill />
        </div>
      </div>
    </>
  );
}
