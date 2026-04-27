import { cacheLife, cacheTag } from "next/cache";
import { connection } from "next/server";
import type { Metadata } from "next";
import { Truck } from "lucide-react";
import { getDb } from "@/lib/db";
import { SupplierRow } from "./supplier-row";
import { SupplierFormSheet } from "./supplier-form-sheet";

export const metadata: Metadata = {
  title: "Dodavatelé",
};

async function getSuppliers() {
  "use cache";
  cacheLife("minutes");
  cacheTag("admin-suppliers");

  const db = await getDb();
  return db.supplier.findMany({
    orderBy: [{ active: "desc" }, { name: "asc" }],
    include: {
      _count: { select: { bundles: true } },
    },
  });
}

export default async function AdminSuppliersPage() {
  await connection();
  const suppliers = await getSuppliers();

  const total = suppliers.length;
  const totalLabel =
    total === 1
      ? "dodavatel"
      : total >= 2 && total <= 4
        ? "dodavatelé"
        : "dodavatelů";

  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground">
            Dodavatelé
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {total} {totalLabel}
          </p>
        </div>
        <SupplierFormSheet />
      </div>

      <div className="mt-6 overflow-hidden rounded-xl border bg-card shadow-sm">
        {suppliers.length === 0 ? (
          <div className="p-12 text-center">
            <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-muted">
              <Truck className="size-6 text-muted-foreground" />
            </div>
            <p className="font-medium text-foreground">Žádní dodavatelé</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Přidejte prvního velkoobchodního dodavatele second-hand zboží.
            </p>
            <div className="mt-4 inline-block">
              <SupplierFormSheet />
            </div>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  Název
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  Stav
                </th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                  Balíky
                </th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                  Akce
                </th>
              </tr>
            </thead>
            <tbody>
              {suppliers.map((s) => (
                <SupplierRow
                  key={s.id}
                  supplier={{
                    id: s.id,
                    name: s.name,
                    url: s.url,
                    contactEmail: s.contactEmail,
                    contactPhone: s.contactPhone,
                    notes: s.notes,
                    active: s.active,
                    bundleCount: s._count.bundles,
                  }}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
