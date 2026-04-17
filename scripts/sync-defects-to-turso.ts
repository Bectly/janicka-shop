/**
 * sync-defects-to-turso.ts — Sync defect + Vinted provenance data from dev.db to Turso.
 *
 * Fields copied: defectsNote, defectImages, originalDescription, originalVintedData, vintedId.
 *
 * Delegates to the generic syncProductData helper. Run after restore scripts
 * repopulate these columns locally but production still shows zero defects.
 */

import { syncProductData } from "./sync-product-data-to-turso";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadEnvLocal(): void {
  const envPath = resolve(process.cwd(), ".env.local");
  try {
    const content = readFileSync(envPath, "utf8");
    for (const rawLine of content.split("\n")) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;
      const eq = line.indexOf("=");
      if (eq === -1) continue;
      const key = line.slice(0, eq).trim();
      let value = line.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!(key in process.env)) process.env[key] = value;
    }
  } catch {
    // optional
  }
}

loadEnvLocal();

const dry = process.argv.includes("--dry");

syncProductData({
  fields: [
    "defectsNote",
    "defectImages",
    "originalDescription",
    "originalVintedData",
    "vintedId",
  ],
  dry,
  onlyEmpty: false,
  matchBy: "sku",
}).catch((err) => {
  console.error("✗ sync-defects-to-turso failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
