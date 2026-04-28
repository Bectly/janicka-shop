// J12-D1: per-category default weight estimates (grams) for bundle cost distribution.
// Match by lowercased substring of category name → first hit wins.
export const CATEGORY_WEIGHT_RULES: ReadonlyArray<{
  match: ReadonlyArray<string>;
  weightG: number;
}> = [
  { match: ["bunda", "kabát", "kabat"], weightG: 800 },
  { match: ["mikina", "svetr"], weightG: 400 },
  { match: ["kalhoty", "džíny", "dziny", "jeans"], weightG: 600 },
  { match: ["šaty", "saty", "sukně", "sukne"], weightG: 250 },
  { match: ["tričko", "tricko", "top", "halenka", "košile", "kosile"], weightG: 150 },
];

export const FALLBACK_WEIGHT_G = 300;

export function estimateWeightG(categoryName: string | null | undefined): number {
  if (!categoryName) return FALLBACK_WEIGHT_G;
  const haystack = categoryName.toLowerCase();
  for (const rule of CATEGORY_WEIGHT_RULES) {
    if (rule.match.some((needle) => haystack.includes(needle))) {
      return rule.weightG;
    }
  }
  return FALLBACK_WEIGHT_G;
}
