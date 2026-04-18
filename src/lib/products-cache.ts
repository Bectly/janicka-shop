import { getDb } from "@/lib/db";
import {
  cacheAside,
  REDIS_KEY,
  REDIS_TTL,
} from "@/lib/redis";

/**
 * Cache-aside wrappers for hot read paths.
 *
 * These sit beneath the Next.js "use cache" layer: when the framework cache
 * expires, the loader hits Redis instead of Turso. A cold cross-instance read
 * becomes a single Redis GET (~few ms) instead of a full Prisma query over the
 * network to Turso.
 *
 * Invalidation: admin mutations call `invalidateProductCaches()` from
 * `@/lib/redis` after writes. Redis outages fall through to the DB silently.
 */

type CachedProduct = Awaited<ReturnType<typeof loadProductBySlug>>;
type CachedCategory = Awaited<ReturnType<typeof loadCategories>>[number];
type CachedCatalog = Awaited<ReturnType<typeof loadCatalog>>;

async function loadCatalog() {
  const db = await getDb();
  const rows = await db.product.findMany({
    where: { active: true, sold: false },
    include: { category: { select: { slug: true, name: true } } },
    orderBy: { createdAt: "desc" },
    take: 2000,
  });
  // Normalize Date → ISO so JSON round-trip is lossless.
  return rows.map((p) => ({
    ...p,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
    reservedUntil: p.reservedUntil?.toISOString() ?? null,
  }));
}

async function loadCategories() {
  const db = await getDb();
  const rows = await db.category.findMany({
    orderBy: { sortOrder: "asc" },
    include: {
      _count: {
        select: { products: { where: { active: true, sold: false } } },
      },
    },
  });
  return rows;
}

async function loadProductBySlug(slug: string) {
  const db = await getDb();
  const p = await db.product.findUnique({
    where: { slug, active: true },
    include: { category: true },
  });
  if (!p) return null;
  return {
    ...p,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
    reservedUntil: p.reservedUntil?.toISOString() ?? null,
    category: {
      ...p.category,
      createdAt: p.category.createdAt.toISOString(),
      updatedAt: p.category.updatedAt.toISOString(),
    },
  };
}

export async function getProducts(): Promise<CachedCatalog> {
  return cacheAside(
    REDIS_KEY.productsList("catalog"),
    REDIS_TTL.productsList,
    loadCatalog,
  );
}

export async function getCategories(): Promise<CachedCategory[]> {
  return cacheAside(
    REDIS_KEY.categoriesList(),
    REDIS_TTL.category,
    loadCategories,
  );
}

export async function getProductBySlug(
  slug: string,
): Promise<CachedProduct | null> {
  if (!slug || typeof slug !== "string" || slug.length > 250) return null;
  return cacheAside(
    REDIS_KEY.product(slug),
    REDIS_TTL.product,
    () => loadProductBySlug(slug),
  );
}

export type { CachedCatalog, CachedCategory, CachedProduct };
