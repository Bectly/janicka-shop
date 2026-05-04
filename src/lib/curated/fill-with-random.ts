/**
 * Soft-minimum + deterministic random fill for curated listing sections.
 *
 * Listing sections that pull from algorithmic / curated pools (Doporučujeme,
 * Mohlo by se vám líbit, Výprodej, …) can return 1–3 products in a small or
 * early-stage catalog. A single lonely card in a 4-column grid looks like a
 * bug. This module helps callers either (a) top the section up with extras
 * to reach a comfortable minimum, or (b) hide the section entirely when even
 * the topup can't cover it.
 *
 * Determinism: the shuffle is seeded so the same cache window / session
 * reliably picks the same fillers — no flicker on refresh.
 */

export const MIN_VISIBLE_PRODUCTS = 4;

function fnv1a(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffleStable<T>(arr: readonly T[], seed: string): T[] {
  const rand = mulberry32(fnv1a(seed));
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** UTC daily seed — identical for all visitors within a UTC day. */
export function dailySeed(salt = ""): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${d.getUTCMonth() + 1}-${d.getUTCDate()}-${salt}`;
}

/**
 * Merge a curated list with a filler pool, deduplicate by id, deterministically
 * shuffle the fillers, and slice to `targetCount`. Returns an empty array when
 * the merged size is below `minVisible` — caller must hide the section.
 *
 * Curated items always come first; only the filler portion is shuffled, so
 * algorithmic ranking is preserved.
 */
export function mergeWithFillers<T extends { id: string }>(
  curated: readonly T[],
  fillerPool: readonly T[],
  options: { seed: string; minVisible?: number; targetCount: number },
): T[] {
  const min = options.minVisible ?? MIN_VISIBLE_PRODUCTS;

  if (curated.length >= options.targetCount) {
    return curated.slice(0, options.targetCount);
  }

  const curatedIds = new Set(curated.map((p) => p.id));
  const dedupedFillers = fillerPool.filter((p) => !curatedIds.has(p.id));
  const shuffled = shuffleStable(dedupedFillers, options.seed);
  const needed = options.targetCount - curated.length;
  const merged = [...curated, ...shuffled.slice(0, needed)];

  if (merged.length < min) return [];
  return merged;
}
