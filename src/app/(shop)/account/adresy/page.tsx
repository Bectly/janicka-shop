import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { cacheLife, cacheTag } from "next/cache";
import { connection } from "next/server";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { customerTag } from "@/lib/customer-cache";
import { AddressList, type AddressItem } from "./address-list";

export const metadata: Metadata = {
  title: "Adresy — Janička",
};

async function getCustomerAddresses(customerId: string): Promise<AddressItem[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag(customerTag(customerId, "addresses"));

  const db = await getDb();
  const rows = await db.customerAddress.findMany({
    where: { customerId },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
  });

  return rows.map((r) => ({
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
}

export default async function AddressesPage() {
  await connection();
  const session = await auth();
  if (!session?.user || session.user.role !== "customer") {
    redirect("/login?redirect=/account/adresy");
  }

  const addresses = await getCustomerAddresses(session.user.id);

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
