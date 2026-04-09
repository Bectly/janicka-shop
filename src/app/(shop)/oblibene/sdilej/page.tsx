import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { Heart, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatPrice } from "@/lib/format";
import { CONDITION_LABELS, CONDITION_COLORS } from "@/lib/constants";
import { getWishlistProducts } from "../actions";
import { getImageUrls } from "@/lib/images";

export const metadata: Metadata = {
  title: "Seznam přání z Janička Shop",
  description:
    "Podívej se na oblíbené kousky z Janička Shop — second hand móda pro moderní ženy.",
  openGraph: {
    title: "Seznam přání z Janička Shop",
    description:
      "Podívej se na oblíbené kousky z Janička Shop — second hand móda pro moderní ženy.",
    type: "website",
  },
};

interface Props {
  searchParams: Promise<{ ids?: string }>;
}

export default async function SharedWishlistPage({ searchParams }: Props) {
  const { ids: idsParam } = await searchParams;

  if (!idsParam) {
    return <EmptyState message="Tento seznam přání je prázdný." />;
  }

  const ids = idsParam
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean)
    .slice(0, 50);

  if (ids.length === 0) {
    return <EmptyState message="Tento seznam přání je prázdný." />;
  }

  const products = await getWishlistProducts(ids);
  const available = products.filter((p) => !p.sold);
  const sold = products.filter((p) => p.sold);

  if (products.length === 0) {
    return <EmptyState message="Žádný z odkazovaných kousků už není dostupný." />;
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6">
        <div className="flex items-center gap-2 text-primary">
          <Heart className="size-5" />
          <span className="text-sm font-medium">Seznam přání</span>
        </div>
        <h1 className="mt-1 font-heading text-3xl font-bold text-foreground">
          Seznam přání z Janička Shop
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {available.length}{" "}
          {available.length === 1
            ? "kousek je dostupný"
            : available.length < 5
              ? "kousky jsou dostupné"
              : "kousků je dostupných"}
          {sold.length > 0 && ` · ${sold.length} již prodáno`}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
        {[...available, ...sold].map((product) => {
          const parsedImages = getImageUrls(product.images);
          const mainImage = parsedImages[0];
          const hasDiscount =
            product.compareAt && product.compareAt > product.price;
          const discountPercent = hasDiscount
            ? Math.round(
                ((product.compareAt! - product.price) / product.compareAt!) *
                  100
              )
            : 0;

          return (
            <div key={product.id} className="group relative">
              <Link href={`/products/${product.slug}`} className="block">
                <div
                  className={`relative aspect-[3/4] overflow-hidden rounded-xl bg-muted ${
                    product.sold ? "opacity-60 grayscale" : ""
                  }`}
                >
                  {mainImage ? (
                    <Image
                      src={mainImage}
                      alt={product.name}
                      fill
                      className="object-cover transition-transform duration-300 group-hover:scale-105"
                      sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                    />
                  ) : (
                    <div className="flex size-full items-center justify-center bg-gradient-to-br from-muted to-muted/50">
                      <span className="text-3xl text-muted-foreground/30">
                        {product.name.charAt(0)}
                      </span>
                    </div>
                  )}
                  {/* Badges */}
                  <div className="absolute top-2 left-2 flex flex-col gap-1">
                    {product.sold && (
                      <span className="rounded-md bg-foreground/80 px-2 py-0.5 text-xs font-semibold text-background">
                        Prodáno
                      </span>
                    )}
                    {hasDiscount && !product.sold && (
                      <span className="rounded-md bg-destructive/90 px-2 py-0.5 text-xs font-semibold text-white">
                        -{discountPercent} %
                      </span>
                    )}
                    {product.condition && !product.sold && (
                      <span
                        className={`rounded-md px-2 py-0.5 text-xs font-medium ${CONDITION_COLORS[product.condition] ?? "bg-muted text-muted-foreground"}`}
                      >
                        {CONDITION_LABELS[product.condition] ?? product.condition}
                      </span>
                    )}
                  </div>
                </div>
                <div className="mt-3 space-y-1">
                  <div className="flex items-center gap-1.5">
                    <p className="text-xs text-muted-foreground">
                      {product.categoryName}
                    </p>
                    {product.brand && (
                      <>
                        <span className="text-xs text-muted-foreground/50">
                          &middot;
                        </span>
                        <p className="text-xs font-medium text-muted-foreground">
                          {product.brand}
                        </p>
                      </>
                    )}
                  </div>
                  <h3
                    className={`text-sm font-medium leading-snug transition-colors ${
                      product.sold
                        ? "text-muted-foreground line-through"
                        : "text-foreground group-hover:text-primary"
                    }`}
                  >
                    {product.name}
                  </h3>
                  {!product.sold && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-primary">
                        Koupit za {formatPrice(product.price)}
                      </span>
                      {hasDiscount && (
                        <span className="text-xs text-muted-foreground line-through">
                          {formatPrice(product.compareAt!)}
                        </span>
                      )}
                    </div>
                  )}
                  {product.sold && (
                    <p className="text-xs text-muted-foreground">
                      Tento kousek už má novou majitelku
                    </p>
                  )}
                </div>
              </Link>
            </div>
          );
        })}
      </div>

      <div className="mt-12 text-center">
        <Button render={<Link href="/products" />}>
          <ShoppingBag className="mr-2 size-4" />
          Prohlédnout celou kolekci
        </Button>
      </div>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="mx-auto max-w-7xl px-4 py-20 text-center sm:px-6 lg:px-8">
      <Heart className="mx-auto size-12 text-muted-foreground/30" />
      <p className="mt-4 text-lg text-muted-foreground">{message}</p>
      <Button className="mt-6" render={<Link href="/products" />}>
        <ShoppingBag className="mr-2 size-4" />
        Prohlédnout kolekci
      </Button>
    </div>
  );
}
