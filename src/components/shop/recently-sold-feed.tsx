import Link from "next/link";
import Image from "next/image";
import { formatPrice, formatRelativeTime } from "@/lib/format";
import { getImageUrls } from "@/lib/images";

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
        <span className="mx-auto flex w-fit items-center gap-2 rounded-full border border-foreground/10 bg-foreground/[0.04] px-3 py-1 text-xs font-medium text-muted-foreground">
          <span className="relative flex size-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand opacity-60" />
            <span className="relative inline-flex size-1.5 rounded-full bg-brand" />
          </span>
          Živý přehled
        </span>
        <h2 className="section-heading mt-3 font-heading text-[1.75rem] font-bold text-foreground sm:text-[2rem]">
          Právě prodáno
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Tyto kousky už mají novou majitelku
        </p>
      </div>
      <div className="mt-8 flex gap-4 overflow-x-auto pb-4 scrollbar-none sm:grid sm:grid-cols-4 sm:overflow-visible sm:pb-0 lg:grid-cols-8">
        {products.map((product) => {
          const images = getImageUrls(product.images);

          return (
            <Link
              key={product.slug}
              href={`/products/${product.slug}`}
              className="group flex w-[clamp(100px,20vw,140px)] shrink-0 flex-col items-center gap-2 sm:shrink"
            >
              <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-muted">
                {images[0] ? (
                  <Image
                    src={images[0]}
                    alt={product.name}
                    fill
                    className="object-cover opacity-60 grayscale transition-all duration-300 group-hover:opacity-80 group-hover:grayscale-0"
                    sizes="140px"
                    unoptimized
                  />
                ) : (
                  <div className="flex size-full items-center justify-center opacity-60 grayscale">
                    <span className="text-2xl text-muted-foreground/30">
                      {product.name.charAt(0)}
                    </span>
                  </div>
                )}
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="rounded-full bg-destructive/75 px-2.5 py-0.5 text-[10px] font-semibold text-white shadow-sm">
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
