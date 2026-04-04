import Link from "next/link";
import Image from "next/image";
import { formatPrice, formatRelativeTime } from "@/lib/format";

interface SoldProduct {
  name: string;
  slug: string;
  price: number;
  images: string;
  categoryName: string;
  brand: string | null;
  updatedAt: Date;
}

interface RecentlySoldFeedProps {
  products: SoldProduct[];
}

export function RecentlySoldFeed({ products }: RecentlySoldFeedProps) {
  if (products.length === 0) return null;

  return (
    <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="text-center">
        <h2 className="font-heading text-2xl font-bold text-foreground">
          Právě prodáno
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Tyto kousky už mají novou majitelku
        </p>
      </div>
      <div className="mt-8 flex gap-4 overflow-x-auto pb-4 scrollbar-none sm:grid sm:grid-cols-4 sm:overflow-visible sm:pb-0 lg:grid-cols-8">
        {products.map((product) => {
          let images: string[] = [];
          try {
            const parsed = JSON.parse(product.images);
            if (Array.isArray(parsed)) {
              images = parsed.map((item: string | { url: string }) =>
                typeof item === "string" ? item : item.url,
              );
            }
          } catch {
            /* fallback */
          }

          return (
            <Link
              key={product.slug}
              href={`/products/${product.slug}`}
              className="group flex shrink-0 flex-col items-center gap-2 sm:shrink"
              style={{ width: "clamp(100px, 20vw, 140px)" }}
            >
              <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-muted">
                {images[0] ? (
                  <Image
                    src={images[0]}
                    alt={product.name}
                    fill
                    className="object-cover opacity-60 grayscale transition-all duration-300 group-hover:opacity-80 group-hover:grayscale-0"
                    sizes="140px"
                  />
                ) : (
                  <div className="flex size-full items-center justify-center opacity-60 grayscale">
                    <span className="text-2xl text-muted-foreground/30">
                      {product.name.charAt(0)}
                    </span>
                  </div>
                )}
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="rounded-full bg-foreground/70 px-2 py-0.5 text-[10px] font-semibold text-background">
                    Prodáno
                  </span>
                </div>
              </div>
              <div className="w-full text-center">
                <p className="truncate text-xs font-medium text-foreground">
                  {product.name}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {formatPrice(product.price)}
                </p>
                <p className="text-[10px] text-muted-foreground/70">
                  {formatRelativeTime(product.updatedAt)}
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
