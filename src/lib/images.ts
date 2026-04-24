/**
 * Product image utilities — backward-compatible parsing for both
 * old format (string[]) and new format ({url, alt}[]).
 */

export interface ProductImage {
  url: string;
  alt: string;
  caption?: string;
}

/**
 * Parse product images JSON into structured format.
 * Handles legacy string[] and {url, alt[, caption]}[] shapes.
 */
export function parseProductImages(imagesJson: string): ProductImage[] {
  try {
    const parsed = JSON.parse(imagesJson);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((item: string | { url: string; alt?: string; caption?: string }) => {
      if (typeof item === "string") return { url: item, alt: "" };
      if (item && typeof item.url === "string") {
        const out: ProductImage = { url: item.url, alt: item.alt || "" };
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
