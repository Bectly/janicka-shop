import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { SettingsForm } from "./settings-form";

export const metadata: Metadata = {
  title: "Nastavení — Janička",
};

export default async function AccountSettingsPage() {
  await connection();
  const session = await auth();
  if (!session?.user || session.user.role !== "customer") {
    redirect("/login?redirect=/account/nastaveni");
  }

  const db = await getDb();
  const customer = await db.customer.findUnique({
    where: { id: session.user.id },
    select: { email: true, notifyMarketing: true },
  });
  if (!customer) redirect("/login");

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-heading text-xl font-semibold">Nastavení</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Emailové preference, export dat a smazání účtu.
        </p>
      </div>
      <SettingsForm
        email={customer.email}
        initial={{ notifyMarketing: customer.notifyMarketing }}
      />
    </div>
  );
}
