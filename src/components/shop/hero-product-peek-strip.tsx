import Link from "next/link";
import Image from "next/image";
import { cacheLife, cacheTag } from "next/cache";
import { Layers } from "lucide-react";
import { getDb } from "@/lib/db";
import { formatPrice } from "@/lib/format";

async function getHeroPeekProducts() {
  "use cache";
  cacheLife("hours");
  cacheTag("products");
  try {
    const db = await getDb();
    const rows = await db.product.findMany({
      where: { active: true, sold: false },
      orderBy: { createdAt: "desc" },
      take: 4,
      select: {
        id: true,
        slug: true,
        name: true,
        price: true,
        brand: true,
        images: true,
      },
    });
    return rows.map((p) => {
      let firstImage: string | null = null;
      try {
        const arr = JSON.parse(p.images) as unknown;
        if (Array.isArray(arr) && typeof arr[0] === "string") firstImage = arr[0];
      } catch {
        firstImage = null;
      }
      return {
        id: p.id,
        slug: p.slug,
        name: p.name,
        price: p.price,
        brand: p.brand,
        image: firstImage,
      };
    });
  } catch {
    return [];
  }
}

export async function HeroProductPeekStrip() {
  const products = await getHeroPeekProducts();
  if (products.length < 3) return null;

  const visible = products.slice(0, 4);

  return (
    <div className="mt-12 w-full sm:mt-14">
      <div className="mb-3 flex items-center justify-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-brand/10 px-3 py-1 text-[11px] font-semibold tracking-wider text-brand uppercase">
          <Layers className="size-3" aria-hidden="true" />
          Právě naskladněné
          <span aria-hidden="true" className="text-brand/40">·</span>
          <span>{visible.length}</span>
        </span>
      </div>

      <ul className="mx-auto flex max-w-3xl items-stretch justify-center gap-3 sm:gap-4">
        {visible.map((p, i) => (
          <li
            key={p.id}
            className={`${i === 3 ? "hidden sm:block" : "block"} w-[30%] max-w-[180px] sm:w-[24%]`}
          >
            <Link
              href={`/products/${p.slug}`}
              data-track="hero-peek-strip-card"
              data-product-id={p.id}
              className="group flex aspect-[3/4] flex-col overflow-hidden rounded-2xl border border-border/40 bg-card/70 shadow-sm backdrop-blur-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-brand/30 hover:shadow-md"
            >
              <div className="relative aspect-square w-full overflow-hidden bg-muted">
                {p.image ? (
                  <Image
                    src={p.image}
                    alt={p.name}
                    fill
                    sizes="(max-width: 640px) 30vw, 180px"
                    className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                  />
                ) : null}
              </div>
              <div className="flex flex-1 flex-col justify-between gap-0.5 px-2 py-2 text-left">
                {p.brand ? (
                  <span className="line-clamp-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                    {p.brand}
                  </span>
                ) : (
                  <span aria-hidden="true" />
                )}
                <span className="text-xs font-semibold text-foreground sm:text-sm">
                  {formatPrice(p.price)}
                </span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
