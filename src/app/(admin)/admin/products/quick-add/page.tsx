import Link from "next/link";
import { getDb } from "@/lib/db";
import { connection } from "next/server";

import { QuickAddForm } from "./quick-add-form";
import { quickCreateProduct } from "../actions";
import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Rychlé přidání",
};

export default async function QuickAddPage() {
  await connection();
  const db = await getDb();
  const categories = await db.category.findMany({
    orderBy: { sortOrder: "asc" },
    select: { id: true, name: true, slug: true },
  });

  return (
    <>
      <Link
        href="/admin/products"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Zpět na produkty
      </Link>
      <h1 className="font-heading text-2xl font-bold text-foreground">
        Rychlé přidání
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Foťte a přidávejte z mobilu — jen to nejdůležitější
      </p>

      <div className="mt-6 rounded-xl border bg-card p-4 shadow-sm sm:p-6">
        <QuickAddForm categories={categories} action={quickCreateProduct} />
      </div>
    </>
  );
}
