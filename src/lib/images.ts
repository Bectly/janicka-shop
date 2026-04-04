/**
 * Product image utilities — backward-compatible parsing for both
 * old format (string[]) and new format ({url, alt}[]).
 */

export interface ProductImage {
  url: string;
  alt: string;
}

/**
 * Parse product images JSON into structured format.
 * Handles both legacy string[] and new {url, alt}[] shapes.
 */
export function parseProductImages(imagesJson: string): ProductImage[] {
  try {
    const parsed = JSON.parse(imagesJson);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((item: string | { url: string; alt?: string }) => {
      if (typeof item === "string") return { url: item, alt: "" };
      if (item && typeof item.url === "string") {
        return { url: item.url, alt: item.alt || "" };
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

/** Measurements in centimeters */
export interface ProductMeasurements {
  chest?: number;
  waist?: number;
  hips?: number;
  length?: number;
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
    return result;
  } catch {
    return {};
  }
}

/** Check if measurements object has any actual values */
export function hasMeasurements(m: ProductMeasurements): boolean {
  return !!(m.chest || m.waist || m.hips || m.length);
}
