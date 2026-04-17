export type BulkPriceMode = "absolute" | "percent" | "add";

/** Pure helper — used by both the client preview table and the Server Action. */
export function computeBulkPrice(
  currentPrice: number,
  mode: BulkPriceMode,
  value: number,
): number {
  let next: number;
  if (mode === "absolute") {
    next = value;
  } else if (mode === "percent") {
    next = currentPrice * (1 - value / 100);
  } else {
    next = currentPrice + value;
  }
  next = Math.round(next);
  if (next < 1) next = 1;
  return next;
}
