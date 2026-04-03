"use server";

import { headers } from "next/headers";

/**
 * In-memory sliding window rate limiter.
 * Works per-instance (suitable for single-instance / low-traffic deployments).
 * For high-traffic production, swap for Upstash Redis or Vercel KV.
 */

interface RateLimitEntry {
  timestamps: number[];
}

const store = new Map<string, RateLimitEntry>();

// Periodic cleanup to prevent memory leaks
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
let lastCleanup = Date.now();

function cleanup(windowMs: number) {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;
  const cutoff = now - windowMs;
  for (const [key, entry] of store) {
    entry.timestamps = entry.timestamps.filter((t) => t > cutoff);
    if (entry.timestamps.length === 0) store.delete(key);
  }
}

export interface RateLimitResult {
  success: boolean;
  remaining: number;
}

/**
 * Check rate limit for a given key.
 * Returns { success: true } if under limit, { success: false } if exceeded.
 */
export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): RateLimitResult {
  cleanup(windowMs);

  const now = Date.now();
  const cutoff = now - windowMs;

  let entry = store.get(key);
  if (!entry) {
    entry = { timestamps: [] };
    store.set(key, entry);
  }

  // Remove expired timestamps
  entry.timestamps = entry.timestamps.filter((t) => t > cutoff);

  if (entry.timestamps.length >= limit) {
    return { success: false, remaining: 0 };
  }

  entry.timestamps.push(now);
  return { success: true, remaining: limit - entry.timestamps.length };
}

/** Extract client IP from request headers (works on Vercel + standard proxies). */
export async function getClientIp(): Promise<string> {
  const h = await headers();
  return (
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    h.get("x-real-ip") ??
    "unknown"
  );
}

// --- Preconfigured limiters for common endpoints ---

const MINUTE = 60 * 1000;

/** Login: 5 attempts per 15 minutes per IP */
export async function rateLimitLogin(): Promise<RateLimitResult> {
  const ip = await getClientIp();
  return checkRateLimit(`login:${ip}`, 5, 15 * MINUTE);
}

/** Checkout: 5 orders per 5 minutes per IP */
export async function rateLimitCheckout(): Promise<RateLimitResult> {
  const ip = await getClientIp();
  return checkRateLimit(`checkout:${ip}`, 5, 5 * MINUTE);
}

/** Newsletter: 3 subscriptions per minute per IP */
export async function rateLimitNewsletter(): Promise<RateLimitResult> {
  const ip = await getClientIp();
  return checkRateLimit(`newsletter:${ip}`, 3, MINUTE);
}

/** Search: 30 requests per minute per IP */
export async function rateLimitSearch(): Promise<RateLimitResult> {
  const ip = await getClientIp();
  return checkRateLimit(`search:${ip}`, 30, MINUTE);
}
