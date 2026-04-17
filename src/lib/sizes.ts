/**
 * Fixed size enums for second-hand clothing.
 *
 * ALL sizes entered in admin and filtered in shop MUST come from these lists.
 * No free text. If a new size is needed, add it here first.
 */

export const CLOTHING_LETTER_SIZES = [
  "XXS",
  "XS",
  "S",
  "M",
  "L",
  "XL",
  "XXL",
  "XXXL",
  "4XL",
  "5XL",
  "6XL",
  "7XL",
] as const;
export type ClothingLetterSize = (typeof CLOTHING_LETTER_SIZES)[number];

export const CLOTHING_EU_SIZES = [
  "32",
  "34",
  "36",
  "38",
  "40",
  "42",
  "44",
  "46",
  "48",
  "50",
  "52",
  "54",
] as const;
export type ClothingEuSize = (typeof CLOTHING_EU_SIZES)[number];

export const PANTS_WAIST_SIZES = [
  "W26",
  "W27",
  "W28",
  "W29",
  "W30",
  "W31",
  "W32",
  "W33",
  "W34",
  "W36",
  "W38",
] as const;
export type PantsWaistSize = (typeof PANTS_WAIST_SIZES)[number];

export const SHOE_SIZES = [
  "35",
  "36",
  "37",
  "38",
  "39",
  "40",
  "41",
  "42",
  "43",
] as const;
export type ShoeSize = (typeof SHOE_SIZES)[number];

export const BRA_SIZES = [
  "65A",
  "65B",
  "65C",
  "70A",
  "70B",
  "70C",
  "70D",
  "75A",
  "75B",
  "75C",
  "75D",
  "80A",
  "80B",
  "80C",
  "80D",
  "85A",
  "85B",
  "85C",
  "85D",
] as const;
export type BraSize = (typeof BRA_SIZES)[number];

export const ONE_SIZE = ["Univerzální"] as const;
export type OneSize = (typeof ONE_SIZE)[number];

/** Every allowed size value across all systems. Use for validation. */
export const ALL_SIZES = [
  ...CLOTHING_LETTER_SIZES,
  ...CLOTHING_EU_SIZES,
  ...PANTS_WAIST_SIZES,
  ...SHOE_SIZES,
  ...BRA_SIZES,
  ...ONE_SIZE,
] as const;
export type AnySize = (typeof ALL_SIZES)[number];

const ALL_SIZES_SET: ReadonlySet<string> = new Set(ALL_SIZES);

export function isValidSize(value: string): value is AnySize {
  return ALL_SIZES_SET.has(value);
}

/** Letter ↔ EU equivalence for clothing sizes. */
export const LETTER_TO_EU: Record<ClothingLetterSize, ClothingEuSize> = {
  XXS: "32",
  XS: "34",
  S: "36",
  M: "38",
  L: "40",
  XL: "42",
  XXL: "44",
  XXXL: "46",
  "4XL": "48",
  "5XL": "50",
  "6XL": "52",
  "7XL": "54",
};

export const EU_TO_LETTER: Record<ClothingEuSize, ClothingLetterSize> = {
  "32": "XXS",
  "34": "XS",
  "36": "S",
  "38": "M",
  "40": "L",
  "42": "XL",
  "44": "XXL",
  "46": "XXXL",
  "48": "4XL",
  "50": "5XL",
  "52": "6XL",
  "54": "7XL",
};

// ---------------------------------------------------------------------------
// Category → allowed size groups
// ---------------------------------------------------------------------------

export type SizeGroupKey =
  | "clothing_letter"
  | "clothing_eu"
  | "pants_waist"
  | "shoe"
  | "bra"
  | "one_size";

export interface SizeGroup {
  key: SizeGroupKey;
  label: string;
  sizes: readonly string[];
}

export const SIZE_GROUPS: Record<SizeGroupKey, SizeGroup> = {
  clothing_letter: {
    key: "clothing_letter",
    label: "Velikost (písmena)",
    sizes: CLOTHING_LETTER_SIZES,
  },
  clothing_eu: {
    key: "clothing_eu",
    label: "Velikost EU",
    sizes: CLOTHING_EU_SIZES,
  },
  pants_waist: {
    key: "pants_waist",
    label: "Pas (W)",
    sizes: PANTS_WAIST_SIZES,
  },
  shoe: {
    key: "shoe",
    label: "Velikost bot",
    sizes: SHOE_SIZES,
  },
  bra: {
    key: "bra",
    label: "Podprsenka",
    sizes: BRA_SIZES,
  },
  one_size: {
    key: "one_size",
    label: "Univerzální",
    sizes: ONE_SIZE,
  },
};

/** Map category slug → allowed size groups, in UI order. */
const CATEGORY_SIZE_GROUPS: Record<string, SizeGroupKey[]> = {
  saty: ["clothing_letter", "clothing_eu", "one_size"],
  "topy-halenky": ["clothing_letter", "clothing_eu", "bra", "one_size"],
  "kalhoty-sukne": [
    "clothing_letter",
    "clothing_eu",
    "pants_waist",
    "one_size",
  ],
  "bundy-kabaty": ["clothing_letter", "clothing_eu", "one_size"],
  doplnky: ["shoe", "one_size"],
};

const DEFAULT_GROUPS: SizeGroupKey[] = [
  "clothing_letter",
  "clothing_eu",
  "one_size",
];

export function getSizeGroupsForCategory(
  categorySlug: string | null | undefined,
): SizeGroup[] {
  const keys =
    (categorySlug && CATEGORY_SIZE_GROUPS[categorySlug]) ?? DEFAULT_GROUPS;
  return keys.map((k) => SIZE_GROUPS[k]);
}

/** Flat list of sizes allowed for a category (all groups combined). */
export function getSizesForCategory(
  categorySlug: string | null | undefined,
): string[] {
  return getSizeGroupsForCategory(categorySlug).flatMap((g) => [...g.sizes]);
}

/**
 * Normalize an arbitrary size string to its canonical enum value, or `null`
 * if it cannot be mapped. Used by the migration script and any legacy import.
 */
export function normalizeSize(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (isValidSize(trimmed)) return trimmed;

  const lower = trimmed.toLowerCase();
  if (
    lower === "univerzální" ||
    lower === "univerzalni" ||
    lower === "univ" ||
    lower === "one size" ||
    lower === "onesize" ||
    lower === "jiná" ||
    lower === "jina" ||
    lower === "other"
  ) {
    return "Univerzální";
  }

  // Uppercase variants for letter sizes
  const upper = trimmed.toUpperCase();
  if (isValidSize(upper)) return upper;

  // Pants waist without W prefix: "32" with category hint → handled by caller
  if (/^w\d{2}$/i.test(trimmed)) {
    const canonical = "W" + trimmed.slice(1);
    if (isValidSize(canonical)) return canonical;
  }

  return null;
}

/**
 * Given a raw sizes array (free text from legacy data) + the product category,
 * returns a normalized array with only enum-valid values. Invalid values are
 * dropped and reported.
 */
export function normalizeSizesForCategory(
  raw: string[],
  categorySlug: string | null | undefined,
): { sizes: string[]; dropped: string[] } {
  const allowed = new Set(getSizesForCategory(categorySlug));
  const out: string[] = [];
  const dropped: string[] = [];

  for (const entry of raw) {
    const normalized = normalizeSize(entry);
    if (normalized && allowed.has(normalized)) {
      if (!out.includes(normalized)) out.push(normalized);
    } else {
      dropped.push(entry);
    }
  }

  if (out.length === 0) out.push("Univerzální");
  return { sizes: out, dropped };
}
