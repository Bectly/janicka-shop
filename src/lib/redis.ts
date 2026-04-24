import type { Redis as RedisType } from "ioredis";
import { logger } from "@/lib/logger";

/**
 * Redis singleton with graceful fallback.
 *
 * If REDIS_URL is unset or the connection fails, all cache ops return null
 * (get) or resolve silently (set/del) so the app keeps working against the
 * DB. Never let a Redis outage take the shop down.
 *
 * Key scheme: "janicka:<domain>:<identifier>:v1"
 *   - janicka:products:list:v1
 *   - janicka:category:<slug>:v1
 *   - janicka:product:<id>:v1
 *
 * TTLs (seconds):
 *   - products list: 300  (5 min)
 *   - categories:    3600 (1 h)
 *   - single product: 600 (10 min)
 */

const globalForRedis = globalThis as unknown as {
  redisClient: RedisType | null | undefined;
  redisInit: Promise<RedisType | null> | undefined;
  redisWarnedDown: boolean | undefined;
};

export const REDIS_TTL = {
  productsList: 300,
  category: 3600,
  product: 600,
} as const;

export const REDIS_KEY = {
  productsList: (suffix = "default") => `janicka:products:list:v1:${suffix}`,
  categoriesList: () => `janicka:categories:list:v1`,
  category: (slug: string) => `janicka:category:${slug}:v1`,
  product: (idOrSlug: string) => `janicka:product:${idOrSlug}:v1`,
  productsListPrefix: () => `janicka:products:list:v1:*`,
} as const;

async function createClient(): Promise<RedisType | null> {
  const url = process.env.REDIS_URL;
  if (!url) return null;

  try {
    const { default: Redis } = await import("ioredis");
    const client = new Redis(url, {
      lazyConnect: false,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      connectTimeout: 2000,
      commandTimeout: 1500,
      // Don't spam logs on each reconnect attempt
      retryStrategy(times) {
        if (times > 5) return null;
        return Math.min(times * 200, 2000);
      },
    });

    client.on("error", (err) => {
      if (!globalForRedis.redisWarnedDown) {
        logger.warn("[redis] connection error — falling back to DB:", err.message);
        globalForRedis.redisWarnedDown = true;
      }
    });
    client.on("ready", () => {
      if (globalForRedis.redisWarnedDown) {
        logger.info("[redis] reconnected");
        globalForRedis.redisWarnedDown = false;
      }
    });

    return client;
  } catch (err) {
    logger.warn("[redis] init failed:", err instanceof Error ? err.message : err);
    return null;
  }
}

async function getClient(): Promise<RedisType | null> {
  if (globalForRedis.redisClient !== undefined) return globalForRedis.redisClient;
  if (!globalForRedis.redisInit) {
    globalForRedis.redisInit = createClient().then((c) => {
      globalForRedis.redisClient = c;
      return c;
    });
  }
  return globalForRedis.redisInit;
}

function isClientHealthy(client: RedisType | null): client is RedisType {
  if (!client) return false;
  // ioredis status: "ready" is the only state where commands execute immediately.
  return client.status === "ready";
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  const client = await getClient();
  if (!isClientHealthy(client)) return null;
  try {
    const raw = await client.get(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function cacheSet(
  key: string,
  value: unknown,
  ttlSeconds: number,
): Promise<void> {
  const client = await getClient();
  if (!isClientHealthy(client)) return;
  try {
    await client.set(key, JSON.stringify(value), "EX", ttlSeconds);
  } catch {
    /* swallow — cache write is best-effort */
  }
}

export async function cacheDel(...keys: string[]): Promise<void> {
  if (keys.length === 0) return;
  const client = await getClient();
  if (!isClientHealthy(client)) return;
  try {
    await client.del(...keys);
  } catch {
    /* swallow */
  }
}

/**
 * Delete all keys matching a glob pattern (e.g. "janicka:products:list:v1:*").
 * Uses SCAN + batched DEL; safe to call on mutations.
 */
export async function cacheDelPattern(pattern: string): Promise<void> {
  const client = await getClient();
  if (!isClientHealthy(client)) return;
  try {
    const stream = client.scanStream({ match: pattern, count: 100 });
    const toDelete: string[] = [];
    await new Promise<void>((resolve, reject) => {
      stream.on("data", (keys: string[]) => {
        if (keys.length) toDelete.push(...keys);
      });
      stream.on("end", () => resolve());
      stream.on("error", reject);
    });
    if (toDelete.length) await client.del(...toDelete);
  } catch {
    /* swallow */
  }
}

/**
 * Cache-aside helper: tries Redis first, falls back to loader, then writes
 * back. Loader exceptions propagate — only Redis errors are swallowed.
 */
export async function cacheAside<T>(
  key: string,
  ttlSeconds: number,
  loader: () => Promise<T>,
): Promise<T> {
  const cached = await cacheGet<T>(key);
  if (cached !== null) return cached;
  const fresh = await loader();
  // Don't cache null/undefined so transient misses don't stick.
  if (fresh !== null && fresh !== undefined) {
    await cacheSet(key, fresh, ttlSeconds);
  }
  return fresh;
}

/** Invalidate all product/category cache keys (used by admin mutations). */
export async function invalidateProductCaches(opts?: {
  slug?: string;
  id?: string;
}): Promise<void> {
  const keys: string[] = [REDIS_KEY.categoriesList()];
  if (opts?.slug) keys.push(REDIS_KEY.product(opts.slug));
  if (opts?.id) keys.push(REDIS_KEY.product(opts.id));
  await Promise.all([cacheDel(...keys), cacheDelPattern(REDIS_KEY.productsListPrefix())]);
}
