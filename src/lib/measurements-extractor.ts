/**
 * Extract structured flat measurements (chest/waist/hips/length in cm) from
 * Vinted-style Czech descriptions.
 *
 * Vinted sellers typically disclose flat measurements under a "📏 Rozměry:"
 * block, e.g.:
 *
 *   📏 Rozměry:
 *   šířka přes prsa cca 36 cm (pružné)
 *   délka cca 127 cm
 *   pas cca 34 cm
 *   boky: 35 cm
 *
 * Used by both `scripts/extract-measurements-from-descriptions.ts` (terminal
 * dry-run + apply) and the admin Server Action that backfills production Turso
 * without terminal access.
 */

export type MeasurementField = "chest" | "waist" | "hips" | "length";

export type ExtractedMeasurements = Partial<Record<MeasurementField, number>>;

interface FieldRule {
  field: MeasurementField;
  patterns: RegExp[];
}

// Accept decimal comma or dot, integer or one-decimal. Allow "cca" and
// punctuation between label and value. Capture 2..3 digits, optional .,5.
const NUM = String.raw`(\d{2,3}(?:[.,]\d)?)`;
const CM = String.raw`\s*(?:cm|centimetr\w*)\b`;

const RULES: FieldRule[] = [
  {
    field: "chest",
    patterns: [
      new RegExp(String.raw`\b(?:sirka\s+(?:pres\s+)?prsa|hrudnik|prsa)\b[^0-9\n]{0,30}${NUM}${CM}`, "u"),
    ],
  },
  {
    field: "waist",
    patterns: [
      new RegExp(String.raw`\b(?:sirka\s+pas|obvod\s+pas\w*|v\s+pas\w*|pas\w*)\b[^0-9\n]{0,30}${NUM}${CM}`, "u"),
    ],
  },
  {
    field: "hips",
    patterns: [
      new RegExp(String.raw`\b(?:sirka\s+bok\w*|obvod\s+bok\w*|bok\w*)\b[^0-9\n]{0,30}${NUM}${CM}`, "u"),
    ],
  },
  {
    field: "length",
    patterns: [
      // Avoid "délka rukávu" (sleeve length) which sits in a different range.
      new RegExp(String.raw`\b(?:celkova\s+delka|delka\s+od\s+ramen|delka)\b(?![^0-9\n]{0,30}\brukav)[^0-9\n]{0,30}${NUM}${CM}`, "u"),
    ],
  },
];

const RANGES: Record<MeasurementField, { min: number; max: number }> = {
  chest: { min: 25, max: 130 },
  waist: { min: 25, max: 130 },
  hips: { min: 25, max: 140 },
  length: { min: 20, max: 200 },
};

function stripDiacritics(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function normalizeForMatch(s: string): string {
  return stripDiacritics(s).toLowerCase();
}

function parseNumber(raw: string): number | null {
  const v = Number(raw.replace(",", "."));
  if (!Number.isFinite(v)) return null;
  return v;
}

export function extractMeasurements(desc: string): ExtractedMeasurements {
  const norm = normalizeForMatch(desc);
  const out: ExtractedMeasurements = {};

  for (const rule of RULES) {
    for (const p of rule.patterns) {
      const m = p.exec(norm);
      if (!m) continue;
      const n = parseNumber(m[1]);
      if (n === null) continue;
      const { min, max } = RANGES[rule.field];
      if (n < min || n > max) continue;
      out[rule.field] = Number.isInteger(n) ? n : Math.round(n * 10) / 10;
      break;
    }
  }

  return out;
}

export function hasAnyMeasurement(m: ExtractedMeasurements): boolean {
  return (
    m.chest !== undefined ||
    m.waist !== undefined ||
    m.hips !== undefined ||
    m.length !== undefined
  );
}

export function parseExistingMeasurements(
  raw: string | null | undefined,
): ExtractedMeasurements {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") return parsed as ExtractedMeasurements;
  } catch {
    // ignore malformed
  }
  return {};
}
