/**
 * Product image utilities — backward-compatible parsing for both
 * old format (string[]) and new format ({url, alt}[]).
 */

import { extractR2Key } from "@/lib/r2";

export interface ProductImage {
  url: string;
  alt: string;
  caption?: string;
}

/**
 * Phase 7 cutover: legacy DB rows hold absolute R2 URLs
 * (https://pub-<id>.r2.dev/products/...). When IMAGE_STORAGE_BACKEND=local,
 * rewrite those to ${IMAGE_PUBLIC_URL_BASE}/<key> on the fly so the browser
 * fetches from nginx /uploads/* instead of going round-trip to R2.
 *
 * Defensive: if the URL doesn't match the legacy R2 host, return unchanged.
 * No DB migration required — the source rows stay as-is so a rollback is
 * a single env-flag flip.
 */
function rewriteImageUrl(url: string): string {
  if (!url) return url;
  // Both NEXT_PUBLIC_* (exposed to client bundle) and the server-only env vars
  // are checked so the rewrite fires identically on the server and the client.
  // Without NEXT_PUBLIC_*, client-side renders silently kept the legacy URLs.
  const backend = (
    process.env.NEXT_PUBLIC_IMAGE_STORAGE_BACKEND ??
    process.env.IMAGE_STORAGE_BACKEND ??
    ""
  )
    .trim()
    .toLowerCase();
  if (backend !== "local") return url;
  const key = extractR2Key(url);
  if (!key) return url;
  const base = (
    process.env.NEXT_PUBLIC_IMAGE_PUBLIC_URL_BASE ??
    process.env.IMAGE_PUBLIC_URL_BASE ??
    "/uploads"
  ).replace(/\/+$/, "");
  return `${base}/${key}`;
}

/**
 * Re-serialize a product images JSON string with rewritten URLs. Use on the
 * server when passing the raw `p.images` field into a client component as a
 * prop — without this, the HTML hydration payload still embeds the legacy
 * r2.dev URLs even though the rendered <img> tags are correct.
 */
export function rewriteImagesJson(imagesJson: string): string {
  const parsed = parseProductImages(imagesJson);
  if (!parsed.length) return imagesJson;
  const allEmpty = parsed.every((img) => !img.alt && !img.caption);
  return allEmpty
    ? JSON.stringify(parsed.map((img) => img.url))
    : JSON.stringify(parsed);
}

/**
 * Parse product images JSON into structured format.
 * Handles legacy string[] and {url, alt[, caption]}[] shapes.
 * Rewrites legacy R2 URLs to local /uploads when backend=local.
 */
export function parseProductImages(imagesJson: string): ProductImage[] {
  try {
    const parsed = JSON.parse(imagesJson);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((item: string | { url: string; alt?: string; caption?: string }) => {
      if (typeof item === "string") return { url: rewriteImageUrl(item), alt: "" };
      if (item && typeof item.url === "string") {
        const out: ProductImage = { url: rewriteImageUrl(item.url), alt: item.alt || "" };
        if (item.caption) out.caption = item.caption;
        return out;
      }
      return null;
    }).filter((img): img is ProductImage => img !== null);
  } catch {
    return [];
  }
}

/**
 * Extract just URLs from product images JSON (either format).
 * Use where only URLs are needed (e.g. ProductCard, OG meta).
 */
export function getImageUrls(imagesJson: string): string[] {
  return parseProductImages(imagesJson).map((img) => img.url);
}

/**
 * Parse a JSON field that stores a string array (e.g. sizes, colors).
 * Returns an empty array on parse failure or if the result is not an array of strings.
 * Use this instead of inline JSON.parse + filter in feed/feed-adjacent code
 * so format changes are handled in one place.
 */
export function parseJsonStringArray(json: string): string[] {
  try {
    const parsed = JSON.parse(json);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item: unknown): item is string => typeof item === "string");
  } catch {
    return [];
  }
}

/** Measurements in centimeters */
export interface ProductMeasurements {
  chest?: number;
  waist?: number;
  hips?: number;
  length?: number;
  sleeve?: number;
  inseam?: number;
  shoulders?: number;
}

/** Parse measurements JSON from DB */
export function parseMeasurements(json: string): ProductMeasurements {
  try {
    const parsed = JSON.parse(json);
    if (typeof parsed !== "object" || parsed === null) return {};
    const result: ProductMeasurements = {};
    if (typeof parsed.chest === "number" && parsed.chest > 0) result.chest = parsed.chest;
    if (typeof parsed.waist === "number" && parsed.waist > 0) result.waist = parsed.waist;
    if (typeof parsed.hips === "number" && parsed.hips > 0) result.hips = parsed.hips;
    if (typeof parsed.length === "number" && parsed.length > 0) result.length = parsed.length;
    if (typeof parsed.sleeve === "number" && parsed.sleeve > 0) result.sleeve = parsed.sleeve;
    if (typeof parsed.inseam === "number" && parsed.inseam > 0) result.inseam = parsed.inseam;
    if (typeof parsed.shoulders === "number" && parsed.shoulders > 0) result.shoulders = parsed.shoulders;
    return result;
  } catch {
    return {};
  }
}

/** Check if measurements object has any actual values */
export function hasMeasurements(m: ProductMeasurements): boolean {
  return !!(m.chest || m.waist || m.hips || m.length || m.sleeve || m.inseam || m.shoulders);
}
