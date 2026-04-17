import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { CustomerActivityFeed } from "@/components/shop/customer-activity-feed";
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
  const [customer, activity] = await Promise.all([
    db.customer.findUnique({
      where: { id: session.user.id },
      select: { email: true, notifyMarketing: true },
    }),
    db.customerAuditLog.findMany({
      where: { customerId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        action: true,
        ip: true,
        userAgent: true,
        metadata: true,
        createdAt: true,
      },
    }),
  ]);
  if (!customer) redirect("/login");

  return (
    <div className="space-y-6">
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

      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <h3 className="font-heading text-lg font-semibold">Aktivita na účtu</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Posledních 20 událostí — přihlášení, změny profilu, oblíbené. Pokud tady vidíš
          něco, co jsi nedělala, okamžitě si změň heslo.
        </p>
        <div className="mt-4">
          <CustomerActivityFeed entries={activity} />
        </div>
      </div>
    </div>
  );
}
