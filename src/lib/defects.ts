/**
 * Product defect/flaw utilities.
 * Second-hand items often have minor imperfections — we document them
 * transparently so customers know exactly what to expect.
 */

export type DefectType =
  | "stain"
  | "pilling"
  | "scuff"
  | "faded"
  | "small_hole"
  | "missing_button"
  | "damaged_zipper"
  | "loose_seam"
  | "yellowing"
  | "other";

export type DefectSeverity = "minor" | "moderate";

export interface ProductDefect {
  type: DefectType;
  description?: string;
  severity: DefectSeverity;
  imageIndex?: number;
}

export const DEFECT_LABELS: Record<DefectType, string> = {
  stain: "Skvrna",
  pilling: "Žmolky",
  scuff: "Odření",
  faded: "Vybledlá barva",
  small_hole: "Drobná díra",
  missing_button: "Chybějící knoflík",
  damaged_zipper: "Poškozený zip",
  loose_seam: "Uvolněný šev",
  yellowing: "Zažloutnutí",
  other: "Jiné",
};

export const DEFECT_TYPES: DefectType[] = [
  "stain",
  "pilling",
  "scuff",
  "faded",
  "small_hole",
  "missing_button",
  "damaged_zipper",
  "loose_seam",
  "yellowing",
  "other",
];

const VALID_TYPES = new Set<string>(DEFECT_TYPES);
const VALID_SEVERITIES = new Set<string>(["minor", "moderate"]);

export function parseDefects(json: string | null | undefined): ProductDefect[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item: unknown): ProductDefect | null => {
        if (!item || typeof item !== "object") return null;
        const raw = item as Record<string, unknown>;
        if (typeof raw.type !== "string" || !VALID_TYPES.has(raw.type)) return null;
        const severity =
          typeof raw.severity === "string" && VALID_SEVERITIES.has(raw.severity)
            ? (raw.severity as DefectSeverity)
            : "minor";
        const result: ProductDefect = {
          type: raw.type as DefectType,
          severity,
        };
        if (typeof raw.description === "string" && raw.description.trim()) {
          result.description = raw.description.trim().slice(0, 300);
        }
        if (typeof raw.imageIndex === "number" && Number.isInteger(raw.imageIndex) && raw.imageIndex >= 0) {
          result.imageIndex = raw.imageIndex;
        }
        return result;
      })
      .filter((d): d is ProductDefect => d !== null)
      .slice(0, 20);
  } catch {
    return [];
  }
}

/** Serialize an already-validated defect list to JSON for storage. */
export function serializeDefects(defects: ProductDefect[]): string {
  return JSON.stringify(defects.slice(0, 20));
}
