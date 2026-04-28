import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";

import { getDb } from "@/lib/db";
import { getSiteUrl } from "@/lib/site-url";
import { ThermalLabel, type LabelItem } from "@/components/admin/print-label";
import { PrintTriggerButton } from "../../../products/[id]/label/print-button";
import { A4PrintStyles } from "../../../products/[id]/label/print-styles";

export const metadata: Metadata = { title: "Štítky balíku" };

interface Props {
  params: Promise<{ id: string }>;
}

function parseFirstSize(sizesJson: string): string | null {
  try {
    const arr = JSON.parse(sizesJson);
    if (Array.isArray(arr) && typeof arr[0] === "string") return arr[0];
  } catch {
    /* noop */
  }
  return null;
}

export default async function BundleLabelsPage({ params }: Props) {
  await connection();
  const { id } = await params;

  const db = await getDb();
  const bundle = await db.supplierBundle.findUnique({
    where: { id },
    select: {
      id: true,
      invoiceNumber: true,
      orderDate: true,
      supplier: { select: { name: true } },
      products: {
        where: { sold: false },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          name: true,
          price: true,
          condition: true,
          sizes: true,
        },
      },
    },
  });
  if (!bundle) notFound();

  const baseUrl = getSiteUrl();
  const items: LabelItem[] = bundle.products.map((p) => ({
    id: p.id,
    name: p.name,
    size: parseFirstSize(p.sizes),
    condition: p.condition,
    price: p.price,
    qrUrl: `${baseUrl}/admin/products/${p.id}`,
  }));

  const bundleLabel = bundle.invoiceNumber
    ? bundle.invoiceNumber
    : new Intl.DateTimeFormat("cs-CZ", { timeZone: "Europe/Prague" }).format(bundle.orderDate);

  return (
    <>
      <A4PrintStyles />

      <div className="print:hidden">
        <Link
          href={`/admin/bundles/${id}`}
          className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Zpět na balík
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-heading text-2xl font-bold text-foreground">
              Štítky balíku
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {bundle.supplier.name} — {bundleLabel} · {items.length}{" "}
              neprodaných kusů
            </p>
          </div>
          <PrintTriggerButton />
        </div>

        {items.length === 0 ? (
          <div className="mt-6 rounded-xl border bg-card p-8 text-center shadow-sm">
            <p className="text-sm text-muted-foreground">
              Žádné neprodané kusy v balíku.
            </p>
          </div>
        ) : (
          <p className="mt-6 mb-3 text-xs uppercase tracking-wide text-muted-foreground">
            Náhled (A4 — 3 sloupce, jeden štítek na kus)
          </p>
        )}
      </div>

      {items.length > 0 && (
        <div className="print-area rounded-xl border bg-muted/30 p-6 print:rounded-none print:border-0 print:bg-white print:p-0">
          <div className="a4-grid grid grid-cols-3 gap-[2mm]">
            {items.map((it) => (
              <ThermalLabel key={it.id} item={it} />
            ))}
          </div>
        </div>
      )}
    </>
  );
}
