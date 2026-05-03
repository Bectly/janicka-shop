import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { connection } from "next/server";

import { ProductForm } from "@/components/admin/product-form";
import { updateProduct } from "../../actions";
import { ArrowLeft, BookOpen, Printer, Bell } from "lucide-react";
import type { Metadata } from "next";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const db = await getDb();
  const { id } = await params;
  const product = await db.product.findUnique({
    where: { id },
    select: { name: true },
  });
  return { title: product ? `Upravit: ${product.name}` : "Produkt nenalezen" };
}

export default async function EditProductPage({ params }: Props) {
  await connection();
  const db = await getDb();
  const { id } = await params;

  const [product, categories, priceWatchers] = await Promise.all([
    db.product.findUnique({ where: { id } }),
    db.category.findMany({
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true, slug: true },
    }),
    db.priceWatch.findMany({
      where: { productId: id },
      select: { email: true, currentPrice: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  if (!product) notFound();

  const watcherCount = priceWatchers.length;
  const watcherAvgPrice =
    watcherCount > 0
      ? Math.round(
          priceWatchers.reduce((sum, w) => sum + w.currentPrice, 0) /
            watcherCount,
        )
      : 0;

  let sizes: string[] = [];
  let colors: string[] = [];
  try { sizes = JSON.parse(product.sizes); } catch { /* corrupted data fallback */ }
  try { colors = JSON.parse(product.colors); } catch { /* corrupted data fallback */ }

  const productData = {
    id: product.id,
    name: product.name,
    description: product.description,
    price: product.price,
    compareAt: product.compareAt,
    sku: product.sku,
    categoryId: product.categoryId,
    brand: product.brand,
    condition: product.condition,
    sizes: sizes.join(", "),
    colors: colors.join(", "),
    featured: product.featured,
    active: product.active,
    images: product.images,
    measurements: product.measurements,
    measurementsCm: product.measurementsCm,
    defectsNote: product.defectsNote,
    defectImages: product.defectImages ?? undefined,
    fitNote: product.fitNote,
    videoUrl: product.videoUrl,
    metaTitle: product.metaTitle,
    metaDescription: product.metaDescription,
    internalNote: product.internalNote,
  };

  async function action(formData: FormData) {
    "use server";
    await updateProduct(id, formData);
  }

  return (
    <>
      <Link
        href="/admin/products"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Zpět na produkty
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground">
            Upravit produkt
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{product.name}</p>
        </div>
        <Link
          href={`/admin/products/${id}/label`}
          target="_blank"
          rel="noopener"
          className="inline-flex items-center gap-2 rounded-lg border bg-card px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
        >
          <Printer className="size-4" />
          Tisk štítku
        </Link>
      </div>

      {product.originalDescription && (
        <details className="mt-6 rounded-xl border border-amber-200 bg-amber-50/60 dark:border-amber-900/50 dark:bg-amber-950/20">
          <summary className="flex cursor-pointer select-none items-center gap-2 px-5 py-3.5 text-sm font-medium text-amber-800 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/30 rounded-xl transition-colors">
            <BookOpen className="size-4 shrink-0" />
            Původní popis z Vinted
            <span className="ml-auto text-xs font-normal text-amber-600/70 dark:text-amber-400/70">
              klikni pro zobrazení
            </span>
          </summary>
          <div className="border-t border-amber-200/70 dark:border-amber-900/40 px-5 py-4">
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-amber-900/80 dark:text-amber-200/80">
              {product.originalDescription}
            </p>
          </div>
        </details>
      )}

      {watcherCount > 0 && (
        <section
          id="price-watchers"
          className="mt-6 rounded-xl border border-amber-200 bg-amber-50/60 p-5 dark:border-amber-900/50 dark:bg-amber-950/20"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="flex items-center gap-2 font-heading text-base font-semibold text-amber-900 dark:text-amber-200">
              <Bell className="size-4" />
              Zájem o slevu
            </h2>
            <p className="text-xs text-amber-800/80 dark:text-amber-300/70">
              Email se odešle, jakmile snížíš cenu pod{" "}
              <strong>{watcherAvgPrice} Kč</strong> (průměr opt-in cen).
            </p>
          </div>
          <p className="mt-1 text-sm text-amber-900 dark:text-amber-200">
            <strong>{watcherCount}</strong>{" "}
            {watcherCount === 1
              ? "zákazník sleduje cenu"
              : watcherCount >= 2 && watcherCount <= 4
                ? "zákazníci sledují cenu"
                : "zákazníků sleduje cenu"}{" "}
            tohoto kusu.
          </p>
          <ul className="mt-3 space-y-1 text-sm">
            {priceWatchers.slice(0, 25).map((w) => (
              <li
                key={`${w.email}-${w.createdAt.toISOString()}`}
                className="flex flex-wrap items-baseline justify-between gap-2 rounded-md bg-white/60 px-3 py-1.5 dark:bg-amber-950/30"
              >
                <span className="font-mono text-xs text-amber-900 dark:text-amber-200">
                  {w.email}
                </span>
                <span className="text-xs text-amber-800/80 dark:text-amber-300/70">
                  opt-in {w.currentPrice} Kč ·{" "}
                  {w.createdAt.toLocaleDateString("cs-CZ")}
                </span>
              </li>
            ))}
          </ul>
          {watcherCount > 25 && (
            <p className="mt-2 text-xs text-amber-800/80 dark:text-amber-300/70">
              … a dalších {watcherCount - 25}.
            </p>
          )}
        </section>
      )}

      <div className="mt-6 rounded-xl border bg-card p-6 shadow-sm">
        <ProductForm
          categories={categories}
          product={productData}
          action={action}
        />
      </div>
    </>
  );
}
