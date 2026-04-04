import Link from "next/link";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";
import { ProductForm } from "@/components/admin/product-form";
import { createProduct } from "../actions";
import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Nový produkt",
};

export default async function NewProductPage() {
  const db = await getDb();
  const categories = await db.category.findMany({
    orderBy: { sortOrder: "asc" },
    select: { id: true, name: true },
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
        Nový produkt
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Přidejte nový kousek do nabídky
      </p>

      <div className="mt-6 rounded-xl border bg-card p-6 shadow-sm">
        <ProductForm categories={categories} action={createProduct} />
      </div>
    </>
  );
}
