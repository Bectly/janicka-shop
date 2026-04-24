import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { ArrowLeft, ArrowRight, PackageX } from "lucide-react";
import { getDb } from "@/lib/db";
import { ProductCard } from "@/components/shop/product-card";
import { Button } from "@/components/ui/button";
import { getLowestPrices30d } from "@/lib/price-history";

async function ProductNotFoundContent() {
  await connection();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let latestProducts: any[] = [];
  let lowestPricesMap = new Map<string, number>();

  try {
    const db = await getDb();
    latestProducts = await db.product.findMany({
      where: { active: true, sold: false },
      include: { category: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 6,
    });

    lowestPricesMap = await getLowestPrices30d(
      latestProducts.map((p: { id: string }) => p.id),
    );
  } catch {
    // DB unavailable — render without suggestions
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-lg text-center">
        <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-muted">
          <PackageX className="size-7 text-muted-foreground" />
        </div>
        <h1 className="font-heading text-2xl font-bold text-foreground sm:text-3xl">
          Tenhle kousek už není k mání
        </h1>
        <p className="mt-3 text-muted-foreground">
          Možná už má novou majitelku, nebo byl stažen z nabídky.
          Koukněte na další kousky, které právě přibyly.
        </p>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button size="lg" render={<Link href="/products" />} className="gap-2">
            Zobrazit všechny kousky
            <ArrowRight className="size-4" />
          </Button>
          <Button
            size="lg"
            variant="outline"
            render={<Link href="/" />}
            className="gap-2"
          >
            <ArrowLeft className="size-4" />
            Zpět na hlavní
          </Button>
        </div>
      </div>

      {latestProducts.length > 0 && (
        <section className="mt-16">
          <div className="flex items-end justify-between">
            <h2 className="font-heading text-xl font-bold text-foreground">
              Nově přidané
            </h2>
            <Link
              href="/products"
              className="hidden text-sm font-medium text-primary hover:underline sm:block"
            >
              Zobrazit vše
              <ArrowRight className="ml-1 inline size-3.5" />
            </Link>
          </div>
          <div className="mt-6 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-3">
            {latestProducts.map((product) => (
              <ProductCard
                key={product.id}
                id={product.id}
                name={product.name}
                slug={product.slug}
                price={product.price}
                compareAt={product.compareAt}
                images={product.images}
                categoryName={product.category.name}
                brand={product.brand}
                condition={product.condition}
                sizes={product.sizes}
                colors={product.colors}
                stock={product.stock}
                createdAt={product.createdAt.toISOString()}
                lowestPrice30d={lowestPricesMap.get(product.id) ?? null}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

export default function ProductNotFound() {
  return (
    <Suspense>
      <ProductNotFoundContent />
    </Suspense>
  );
}
