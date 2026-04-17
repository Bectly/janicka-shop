import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { AddressList, type AddressItem } from "./address-list";

export const metadata: Metadata = {
  title: "Adresy — Janička",
};

export default async function AddressesPage() {
  await connection();
  const session = await auth();
  if (!session?.user || session.user.role !== "customer") {
    redirect("/login?redirect=/account/adresy");
  }

  const db = await getDb();
  const rows = await db.customerAddress.findMany({
    where: { customerId: session.user.id },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
  });

  const addresses: AddressItem[] = rows.map((r) => ({
    id: r.id,
    label: r.label,
    firstName: r.firstName,
    lastName: r.lastName,
    street: r.street,
    city: r.city,
    zip: r.zip,
    country: r.country,
    phone: r.phone,
    isDefault: r.isDefault,
  }));

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-heading text-xl font-semibold">Adresy</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Uložené adresy se předvyplní při dalším nákupu.
        </p>
      </div>
      <AddressList addresses={addresses} />
    </div>
  );
}
