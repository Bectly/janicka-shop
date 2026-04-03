import Link from "next/link";
import { formatPrice } from "@/lib/format";

interface ProductCardProps {
  name: string;
  slug: string;
  price: number;
  compareAt?: number | null;
  images: string;
  categoryName: string;
}

export function ProductCard({
  name,
  slug,
  price,
  compareAt,
  categoryName,
}: ProductCardProps) {
  const hasDiscount = compareAt && compareAt > price;

  return (
    <Link href={`/products/${slug}`} className="group block">
      <div className="relative aspect-[3/4] overflow-hidden rounded-xl bg-muted">
        {/* Placeholder — real images will be added later */}
        <div className="flex size-full items-center justify-center bg-gradient-to-br from-muted to-muted/50 transition-transform duration-300 group-hover:scale-105">
          <span className="text-3xl text-muted-foreground/30">
            {name.charAt(0)}
          </span>
        </div>
        {hasDiscount && (
          <span className="absolute top-2 left-2 rounded-md bg-destructive/90 px-2 py-0.5 text-xs font-semibold text-white">
            Sleva
          </span>
        )}
      </div>
      <div className="mt-3 space-y-1">
        <p className="text-xs text-muted-foreground">{categoryName}</p>
        <h3 className="text-sm font-medium leading-snug text-foreground group-hover:text-primary transition-colors">
          {name}
        </h3>
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">{formatPrice(price)}</span>
          {hasDiscount && (
            <span className="text-xs text-muted-foreground line-through">
              {formatPrice(compareAt)}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
