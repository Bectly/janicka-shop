import type { RedisOptions } from "ioredis";

/**
 * Shared BullMQ connection settings.
 *
 * BullMQ requires `maxRetriesPerRequest: null` and blocks indefinitely on
 * brpoplpush, so these settings differ from the cache-layer Redis client
 * (src/lib/redis.ts). Never reuse the cache client for BullMQ — it will fail.
 */

export function getQueueConnection(): RedisOptions & { url?: string } {
  const url = process.env.REDIS_URL;
  if (!url) {
    throw new Error(
      "REDIS_URL is not set — BullMQ requires Redis. Set REDIS_URL in env.",
    );
  }
  return {
    // ioredis accepts either a url string or discrete host/port via options.
    // BullMQ passes the same options to a new Redis(...) instance, so embed
    // url via the connection override below where we pass `{ connection: url }`.
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  };
}

export function getRedisUrl(): string {
  const url = process.env.REDIS_URL;
  if (!url) {
    throw new Error(
      "REDIS_URL is not set — BullMQ requires Redis. Set REDIS_URL in env.",
    );
  }
  return url;
}

export const QUEUE_NAMES = {
  email: "janicka-email",
  invoice: "janicka-invoice",
  packeta: "janicka-packeta",
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];
