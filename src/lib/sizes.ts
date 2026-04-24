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

export const WAIST_TO_LETTER: Record<PantsWaistSize, ClothingLetterSize> = {
  W26: "XS",
  W27: "XS",
  W28: "S",
  W29: "S",
  W30: "M",
  W31: "M",
  W32: "L",
  W33: "L",
  W34: "XL",
  W36: "XXL",
  W38: "XXXL",
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
  const keys: SizeGroupKey[] =
    (categorySlug ? CATEGORY_SIZE_GROUPS[categorySlug] : null) ?? DEFAULT_GROUPS;
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
 * Reduce a list of equivalent size notations to ONE canonical entry.
 *
 * Priority: letter > bra > (shoe, if category=doplnky) > waist→letter > EU→letter.
 * Examples: ["M","38"] → ["M"]; ["4XL","48"] → ["4XL"]; ["W32"] → ["L"];
 * ["50"] (clothing) → ["5XL"]; ["37"] (doplnky) → ["37"]; ["75B"] → ["75B"].
 */
export function collapseToPrimary(
  sizes: string[],
  categorySlug: string | null | undefined,
): string[] {
  if (sizes.length === 0) return ["Univerzální"];

  const letters = CLOTHING_LETTER_SIZES as readonly string[];
  const letter = sizes.find((s) => letters.includes(s));
  if (letter) return [letter];

  const bras = BRA_SIZES as readonly string[];
  const bra = sizes.find((s) => bras.includes(s));
  if (bra) return [bra];

  if (categorySlug === "doplnky") {
    const shoes = SHOE_SIZES as readonly string[];
    const shoe = sizes.find((s) => shoes.includes(s));
    if (shoe) return [shoe];
  }

  const waist = sizes.find((s) => s in WAIST_TO_LETTER);
  if (waist) return [WAIST_TO_LETTER[waist as PantsWaistSize]];

  const eu = sizes.find((s) => s in EU_TO_LETTER);
  if (eu) return [EU_TO_LETTER[eu as ClothingEuSize]];

  const one = sizes.find((s) => s === "Univerzální");
  if (one) return [one];

  return [sizes[0]];
}

/**
 * Given a raw sizes array (free text from legacy data) + the product category,
 * returns a single-entry canonical array. Multiple equivalent notations
 * (e.g. ["M","38"]) collapse to their primary letter size. Invalid values are
 * dropped and reported.
 */
export function normalizeSizesForCategory(
  raw: string[],
  categorySlug: string | null | undefined,
): { sizes: string[]; dropped: string[] } {
  const allowed = new Set(getSizesForCategory(categorySlug));
  const valid: string[] = [];
  const dropped: string[] = [];

  for (const entry of raw) {
    const normalized = normalizeSize(entry);
    if (normalized && allowed.has(normalized)) {
      if (!valid.includes(normalized)) valid.push(normalized);
    } else {
      dropped.push(entry);
    }
  }

  const sizes = collapseToPrimary(valid, categorySlug);
  return { sizes, dropped };
}
