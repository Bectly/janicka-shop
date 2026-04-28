import { calcBundleROI, type BundleROI, type LineAgg } from "@/lib/bundles/roi";
import { getSiteSetting, setSiteSetting } from "@/lib/site-settings";

const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

export type BundleRecommendation = {
  bundleId: string;
  generatedAt: string;
  topLine: { name: string; sellThroughPct: number; avgSellDays: number } | null;
  worstLine: {
    name: string;
    sellThroughPct: number;
    sold: number;
    pieces: number;
  } | null;
  medianSellDays: number | null;
  nextOrderSuggestion: string;
  insights: string[];
};

type CachedReco = BundleRecommendation & { _cachedAt: number };

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

function pickTopLine(lines: LineAgg[]): LineAgg | null {
  const eligible = lines.filter((l) => l.pieces >= 2);
  if (eligible.length === 0) return null;
  const sorted = [...eligible].sort((a, b) => {
    if (b.sellThroughPct !== a.sellThroughPct)
      return b.sellThroughPct - a.sellThroughPct;
    const ad = a.avgSellDays || Number.POSITIVE_INFINITY;
    const bd = b.avgSellDays || Number.POSITIVE_INFINITY;
    return ad - bd;
  });
  return sorted[0] ?? null;
}

function pickWorstLine(lines: LineAgg[]): LineAgg | null {
  const eligible = lines.filter((l) => l.pieces >= 2);
  if (eligible.length === 0) return null;
  const sorted = [...eligible].sort((a, b) => {
    if (a.sellThroughPct !== b.sellThroughPct)
      return a.sellThroughPct - b.sellThroughPct;
    return b.pieces - a.pieces;
  });
  return sorted[0] ?? null;
}

export function buildRecommendation(roi: BundleROI): BundleRecommendation {
  const topLine = pickTopLine(roi.byLine);
  const worstLine = pickWorstLine(roi.byLine);

  // Median sell days uses bestSellers' daysToSell as a proxy when full data
  // isn't exposed; fall back to avgSellDays from ROI.
  const sellDays = roi.bestSellers
    .map((p) => p.daysToSell)
    .filter((d): d is number => typeof d === "number" && d >= 0);
  const medianSellDays = median(sellDays) ?? (roi.avgSellDays || null);

  const insights: string[] = [];

  if (roi.status === "done_profit") {
    insights.push(
      `Balík se vyplatil — ROI ${roi.roi.toFixed(0)} %, marže ${roi.margin.toFixed(0)} %.`,
    );
  } else if (roi.status === "done_loss") {
    insights.push(
      `Balík vyprodán se ztrátou ${(roi.investment - roi.revenue).toFixed(0)} Kč. Příště méně podobného sortimentu.`,
    );
  } else if (roi.status === "profit") {
    insights.push(
      `Investice už se vrátila — ROI ${roi.roi.toFixed(0)} %. Zbývá doprodat ${roi.pieceCount - roi.soldCount} kusů.`,
    );
  } else if (roi.status === "pending") {
    const remaining = roi.investment - roi.revenue;
    insights.push(
      `Do break-even chybí ${remaining.toFixed(0)} Kč (${roi.sellThrough.toFixed(0)} % prodáno).`,
    );
  } else {
    insights.push(
      `Balík ještě nevydělal — sell-through ${roi.sellThrough.toFixed(0)} % po ${roi.daysOld} dnech.`,
    );
  }

  if (topLine) {
    insights.push(
      `Nejlépe se prodává „${topLine.name}" (${topLine.sellThroughPct.toFixed(0)} % sell-through${
        topLine.avgSellDays > 0 ? `, Ø ${topLine.avgSellDays.toFixed(0)} d` : ""
      }).`,
    );
  }
  if (worstLine && worstLine.id !== topLine?.id) {
    insights.push(
      `Nejhorší prodej: „${worstLine.name}" — ${worstLine.sold}/${worstLine.pieces} ks.`,
    );
  }
  if (roi.stale.length > 0) {
    insights.push(
      `${roi.stale.length} ${roi.stale.length === 1 ? "kus stojí" : "kusů stojí"} ve skladu déle než 30 dní — zvaž slevu.`,
    );
  }

  let nextOrderSuggestion: string;
  if (roi.pieceCount === 0) {
    nextOrderSuggestion = "Balík ještě neobsahuje žádné kusy.";
  } else if (topLine && roi.status !== "loss") {
    nextOrderSuggestion = `Příště objednej více „${topLine.name}" — ${topLine.sellThroughPct.toFixed(0)} % sell-through je nad průměrem balíku (${roi.sellThrough.toFixed(0)} %).`;
  } else if (worstLine && (roi.status === "loss" || roi.status === "pending")) {
    nextOrderSuggestion = `Před další objednávkou doprodej „${worstLine.name}" — drží kapitál (${worstLine.pieces - worstLine.sold} kusů na skladě).`;
  } else {
    nextOrderSuggestion = `Sleduj rychlost prodeje (Ø ${roi.avgSellDays.toFixed(0)} d) a uprav mix při další objednávce.`;
  }

  return {
    bundleId: roi.bundleId,
    generatedAt: new Date().toISOString(),
    topLine: topLine
      ? {
          name: topLine.name,
          sellThroughPct: topLine.sellThroughPct,
          avgSellDays: topLine.avgSellDays,
        }
      : null,
    worstLine: worstLine
      ? {
          name: worstLine.name,
          sellThroughPct: worstLine.sellThroughPct,
          sold: worstLine.sold,
          pieces: worstLine.pieces,
        }
      : null,
    medianSellDays,
    nextOrderSuggestion,
    insights,
  };
}

export async function getCachedRecommendation(
  bundleId: string,
  opts: { force?: boolean } = {},
): Promise<BundleRecommendation | null> {
  const cacheKey = `bundleReco:${bundleId}`;
  if (!opts.force) {
    const raw = await getSiteSetting(cacheKey);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as CachedReco;
        if (
          typeof parsed._cachedAt === "number" &&
          Date.now() - parsed._cachedAt < CACHE_TTL_MS
        ) {
          const { _cachedAt: _ignored, ...rest } = parsed;
          void _ignored;
          return rest;
        }
      } catch {
        /* fall through and recompute */
      }
    }
  }

  const roi = await calcBundleROI(bundleId);
  if (!roi) return null;
  const reco = buildRecommendation(roi);
  const payload: CachedReco = { ...reco, _cachedAt: Date.now() };
  await setSiteSetting(cacheKey, JSON.stringify(payload));
  return reco;
}
