import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";

import { getDb } from "@/lib/db";
import { getSiteUrl } from "@/lib/site-url";
import { ThermalLabel, type LabelItem } from "@/components/admin/print-label";
import { PrintTriggerButton } from "./print-button";
import { ThermalPrintStyles, A4PrintStyles } from "./print-styles";

export const metadata: Metadata = { title: "Štítek produktu" };

type Format = "thermal" | "a4";

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ format?: string }>;
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

export default async function ProductLabelPage({ params, searchParams }: Props) {
  await connection();
  const { id } = await params;
  const sp = await searchParams;
  const format: Format = sp.format === "a4" ? "a4" : "thermal";

  const db = await getDb();
  const product = await db.product.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      price: true,
      condition: true,
      sizes: true,
    },
  });
  if (!product) notFound();

  const baseUrl = getSiteUrl();
  const item: LabelItem = {
    id: product.id,
    name: product.name,
    size: parseFirstSize(product.sizes),
    condition: product.condition,
    price: product.price,
    qrUrl: `${baseUrl}/admin/products/${product.id}`,
  };

  const a4Copies: LabelItem[] = format === "a4" ? Array.from({ length: 21 }, () => item) : [];

  return (
    <>
      {format === "thermal" ? <ThermalPrintStyles /> : <A4PrintStyles />}

      <div className="print:hidden">
        <Link
          href={`/admin/products/${product.id}/edit`}
          className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Zpět na produkt
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-heading text-2xl font-bold text-foreground">
              Štítek produktu
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">{product.name}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex gap-1">
              <Link
                href={`/admin/products/${product.id}/label?format=thermal`}
                className={`inline-flex items-center rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${format === "thermal" ? "bg-foreground text-background border-foreground" : "bg-card text-foreground hover:bg-muted"}`}
              >
                Termo 50×30
              </Link>
              <Link
                href={`/admin/products/${product.id}/label?format=a4`}
                className={`inline-flex items-center rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${format === "a4" ? "bg-foreground text-background border-foreground" : "bg-card text-foreground hover:bg-muted"}`}
              >
                A4 sheet
              </Link>
            </div>
            <PrintTriggerButton />
          </div>
        </div>

        <p className="mt-6 mb-3 text-xs uppercase tracking-wide text-muted-foreground">
          Náhled ({format === "thermal" ? "termo 50×30 mm" : "A4 — 3×7 = 21 ks"})
        </p>
      </div>

      <div className="print-area rounded-xl border bg-muted/30 p-6 print:rounded-none print:border-0 print:bg-white print:p-0">
        {format === "thermal" ? (
          <div className="inline-block">
            <ThermalLabel item={item} />
          </div>
        ) : (
          <div className="a4-grid grid grid-cols-3 gap-[2mm]">
            {a4Copies.map((it, idx) => (
              <ThermalLabel key={`${it.id}-${idx}`} item={it} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
