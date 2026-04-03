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
 * Check rate limit for a given key AND record the attempt.
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

/**
 * Check rate limit WITHOUT recording an attempt.
 * Use with recordRateLimitHit() for cases where only failures should count
 * (e.g. login — successful logins shouldn't consume rate limit tokens).
 */
export function checkRateLimitOnly(
  key: string,
  limit: number,
  windowMs: number,
): RateLimitResult {
  cleanup(windowMs);

  const cutoff = Date.now() - windowMs;

  const entry = store.get(key);
  if (!entry) {
    return { success: true, remaining: limit };
  }

  const valid = entry.timestamps.filter((t) => t > cutoff);
  entry.timestamps = valid;

  if (valid.length >= limit) {
    return { success: false, remaining: 0 };
  }

  return { success: true, remaining: limit - valid.length };
}

/** Record a rate limit hit for a key (call after a failed attempt). */
export function recordRateLimitHit(key: string): void {
  let entry = store.get(key);
  if (!entry) {
    entry = { timestamps: [] };
    store.set(key, entry);
  }
  entry.timestamps.push(Date.now());
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

/**
 * Login: 5 FAILED attempts per 15 minutes per IP.
 * Only checks — does NOT record the attempt. Call recordLoginFailure() after
 * a failed auth so successful logins don't consume rate limit tokens.
 */
export async function rateLimitLogin(): Promise<RateLimitResult> {
  const ip = await getClientIp();
  return checkRateLimitOnly(`login:${ip}`, 5, 15 * MINUTE);
}

/** Record a failed login attempt against the rate limiter. */
export async function recordLoginFailure(): Promise<void> {
  const ip = await getClientIp();
  recordRateLimitHit(`login:${ip}`);
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
