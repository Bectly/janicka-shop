/**
 * Garment SVG icon mapping for measurement sections on PDP.
 *
 * Icons live in /public/icons/garment/ as monoline SVGs (currentColor stroke,
 * 80×80 viewBox). They visually identify the garment type next to the
 * measurements table.
 */

export const garmentIconMap: Record<string, string> = {
  // Single-keyword aliases (for substring matching)
  saty: "/icons/garment/dress.svg",
  top: "/icons/garment/top.svg",
  halenky: "/icons/garment/top.svg",
  kalhoty: "/icons/garment/pants.svg",
  sukne: "/icons/garment/skirt.svg",
  bunda: "/icons/garment/jacket.svg",
  bundy: "/icons/garment/jacket.svg",
  kabat: "/icons/garment/coat.svg",
  kabaty: "/icons/garment/coat.svg",
  overal: "/icons/garment/jumpsuit.svg",
  doplnky: "/icons/garment/accessory.svg",
};

// Exact slug overrides — for compound category slugs in production schema.
const slugOverrides: Record<string, string> = {
  "topy-halenky": "/icons/garment/top.svg",
  "kalhoty-sukne": "/icons/garment/pants.svg",
  "bundy-kabaty": "/icons/garment/jacket.svg",
};

/**
 * Resolve an icon path for a category. Accepts the category slug
 * (e.g. "saty", "kalhoty-sukne") or a free-form name.
 *
 * Returns null when no mapping matches — caller renders no icon (never breaks).
 */
export function getGarmentIcon(category?: string | null): string | null {
  if (!category) return null;
  const key = category.toLowerCase().trim();
  if (slugOverrides[key]) return slugOverrides[key];
  if (garmentIconMap[key]) return garmentIconMap[key];
  // Substring fallback (catches "Šaty letní", "letní bunda", etc.)
  for (const [token, path] of Object.entries(garmentIconMap)) {
    if (key.includes(token)) return path;
  }
  return null;
}
