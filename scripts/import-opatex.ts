/**
 * OPATEX .ods → DB importer (J6 / task #778).
 *
 * Reads every .ods file in docs/suppliers/opatex/, parses the OASIS table via
 * node-stream-zip + xml2js (no browser deps), and upserts:
 *   - Supplier "OPATEX"  (idempotent on name)
 *   - SupplierPricelist  (idempotent on supplierId+effectiveDate)
 *     - SupplierPricelistItem  (idempotent on pricelistId+code)
 *   - SupplierBundle     (idempotent on supplierId+sourceFile)
 *     - SupplierBundleLine     (idempotent on bundleId+code)
 *
 * File naming:
 *   "OBJEDNÁVKOVÝ FORMULÁŘ OPATEX 2025 - <month>.ods" → SupplierPricelist (kg=0 for all rows)
 *   "OBJEDNÁVKA OPATEX - Janička.ods"                  → SupplierBundle (only rows with kg>0 become lines)
 *
 * Run:
 *   npm run import:opatex
 *   npm run import:opatex -- --dir custom/path --dry
 */
import StreamZip from "node-stream-zip";
import { parseStringPromise } from "xml2js";
import path from "node:path";
import fs from "node:fs/promises";
import { PrismaClient } from "@prisma/client";

const SUPPLIER_NAME = "OPATEX";

const CZECH_MONTHS: Record<string, number> = {
  leden: 1, únor: 2, "březen": 3, duben: 4,
  "květen": 5, "červen": 6, "červenec": 7, srpen: 8,
  "září": 9, "říjen": 10, listopad: 11, prosinec: 12,
};

export interface ParsedRow {
  code: string;
  name: string;
  pricePerKg: number;
  kg: number;
  total: number;
}

export interface ParsedOds {
  totalKg: number;
  totalPriceWithVat: number;
  totalPriceWithoutVat: number;
  rows: ParsedRow[];
}

/** Walk one OASIS table-row, expanding number-columns-repeated, returning text/value of each cell. */
function readRow(row: Record<string, unknown>): Array<{ text: string; value: string | null }> {
  const rawCells = row["table:table-cell"] as unknown[] | undefined;
  if (!rawCells) return [];
  const cells: Array<{ text: string; value: string | null }> = [];
  for (const c of rawCells) {
    const cell = c as Record<string, unknown>;
    const attrs = (cell.$ ?? {}) as Record<string, string>;
    const repeat = parseInt(attrs["table:number-columns-repeated"] ?? "1", 10);
    const value = attrs["office:value"] ?? null;
    let text = "";
    const ps = cell["text:p"];
    if (Array.isArray(ps)) {
      for (const p of ps) {
        if (typeof p === "string") text += p;
        else if (p && typeof p === "object") text += extractText(p as Record<string, unknown>);
      }
    } else if (typeof ps === "string") {
      text = ps;
    } else if (ps && typeof ps === "object") {
      text = extractText(ps as Record<string, unknown>);
    }
    for (let i = 0; i < Math.min(repeat, 256); i++) cells.push({ text, value });
  }
  return cells;
}

function extractText(obj: Record<string, unknown>): string {
  let out = "";
  if (typeof obj._ === "string") out += obj._;
  for (const [k, v] of Object.entries(obj)) {
    if (k === "$" || k === "_") continue;
    if (Array.isArray(v)) {
      for (const inner of v) {
        if (typeof inner === "string") out += inner;
        else if (inner && typeof inner === "object") out += extractText(inner as Record<string, unknown>);
      }
    } else if (typeof v === "string") {
      out += v;
    } else if (v && typeof v === "object") {
      out += extractText(v as Record<string, unknown>);
    }
  }
  return out;
}

export async function parseOdsFile(filePath: string): Promise<ParsedOds> {
  const zip = new StreamZip.async({ file: filePath });
  let xml: string;
  try {
    const buf = await zip.entryData("content.xml");
    xml = buf.toString("utf-8");
  } finally {
    await zip.close();
  }
  const parsed = await parseStringPromise(xml, { explicitArray: true, explicitCharkey: false });
  const body = parsed["office:document-content"]?.["office:body"]?.[0];
  const spreadsheet = body?.["office:spreadsheet"]?.[0];
  const tables = spreadsheet?.["table:table"] as unknown[] | undefined;
  if (!tables || !tables.length) throw new Error(`No table found in ${filePath}`);

  const table = tables[0] as Record<string, unknown>;
  const rawRows = (table["table:table-row"] ?? []) as unknown[];

  const out: ParsedOds = { totalKg: 0, totalPriceWithVat: 0, totalPriceWithoutVat: 0, rows: [] };
  let inItems = false;

  for (const r of rawRows) {
    const cells = readRow(r as Record<string, unknown>);
    if (!cells.length) continue;
    const labels = cells.map((c) => c.text.trim()).join("|");

    if (!inItems) {
      // Header rows up to "Kód|Název|cena/kg|kg|Celkem"
      if (/Kg celkem/i.test(labels)) {
        const total = cells.find((c) => c.value !== null && c.value !== "")?.value;
        if (total) out.totalKg = Number(total);
      } else if (/Cena vč\. DPH/i.test(labels)) {
        const total = cells.find((c) => c.value !== null && c.value !== "")?.value;
        if (total) out.totalPriceWithVat = Number(total);
      } else if (/^Cena$/i.test(labels.replace(/^\|+/, "").split("|")[0]) || /\bCena\b/i.test(labels) && !/DPH/i.test(labels)) {
        const total = cells.find((c) => c.value !== null && c.value !== "")?.value;
        if (total && !out.totalPriceWithoutVat) out.totalPriceWithoutVat = Number(total);
      }
      if (/Kód/.test(labels) && /Název/.test(labels)) {
        inItems = true;
      }
      continue;
    }

    // Item rows: column 1 = code, 2 = name, 3 = price/kg, 4 = kg, 5 = total
    const code = (cells[1]?.value ?? cells[1]?.text ?? "").toString().trim();
    const name = (cells[2]?.text ?? "").trim();
    if (!/^\d+$/.test(code) || !name) continue;
    const pricePerKg = Number(cells[3]?.value ?? 0) || 0;
    const kg = Number(cells[4]?.value ?? 0) || 0;
    const total = Number(cells[5]?.value ?? 0) || 0;
    out.rows.push({ code, name, pricePerKg, kg, total });
  }

  return out;
}

function pricelistDateFromFilename(filename: string): Date | null {
  // "OBJEDNÁVKOVÝ FORMULÁŘ OPATEX 2025 - leden.ods"
  const m = filename.match(/(\d{4}).*?-\s*([a-záčďéěíňóřšťúůýž]+)\.ods$/i);
  if (!m) return null;
  const year = parseInt(m[1], 10);
  const monthName = m[2].toLowerCase();
  const month = CZECH_MONTHS[monthName];
  if (!month) return null;
  return new Date(Date.UTC(year, month - 1, 1));
}

function isPricelistFile(filename: string): boolean {
  return /OBJEDN[ÁA]VKOV[ÝY] FORMUL[ÁA][ŘR]/i.test(filename);
}

function isBundleFile(filename: string): boolean {
  return /^OBJEDN[ÁA]VKA /i.test(filename);
}

interface ImportResult {
  supplierId: string;
  pricelistsUpserted: number;
  pricelistItemsUpserted: number;
  bundlesUpserted: number;
  bundleLinesUpserted: number;
}

export async function importOpatex(opts: {
  dir: string;
  prisma: PrismaClient;
  dry?: boolean;
  log?: (msg: string) => void;
}): Promise<ImportResult> {
  const { dir, prisma } = opts;
  const log = opts.log ?? (() => {});
  const dry = opts.dry ?? false;

  const entries = await fs.readdir(dir);
  const odsFiles = entries
    .filter((f) => f.toLowerCase().endsWith(".ods"))
    .map((f) => path.join(dir, f))
    .sort();

  const supplier = dry
    ? { id: "DRY-OPATEX" }
    : await prisma.supplier.upsert({
        where: { name: SUPPLIER_NAME },
        update: {},
        create: { name: SUPPLIER_NAME, url: "https://opatex.cz", active: true },
      });

  let pricelistsUpserted = 0;
  let pricelistItemsUpserted = 0;
  let bundlesUpserted = 0;
  let bundleLinesUpserted = 0;

  for (const filePath of odsFiles) {
    const filename = path.basename(filePath);
    log(`→ ${filename}`);
    const parsed = await parseOdsFile(filePath);

    if (isPricelistFile(filename)) {
      const effectiveDate = pricelistDateFromFilename(filename);
      if (!effectiveDate) {
        log(`  skip: cannot derive date from ${filename}`);
        continue;
      }
      log(`  pricelist effectiveDate=${effectiveDate.toISOString().slice(0, 10)} rows=${parsed.rows.length}`);
      if (dry) {
        pricelistsUpserted++;
        pricelistItemsUpserted += parsed.rows.length;
        continue;
      }
      const pricelist = await prisma.supplierPricelist.upsert({
        where: { supplierId_effectiveDate: { supplierId: supplier.id, effectiveDate } },
        update: { sourceFile: filePath, scrapedAt: new Date() },
        create: {
          supplierId: supplier.id,
          effectiveDate,
          sourceFile: filePath,
          scrapedAt: new Date(),
        },
      });
      pricelistsUpserted++;
      for (const row of parsed.rows) {
        await prisma.supplierPricelistItem.upsert({
          where: { pricelistId_code: { pricelistId: pricelist.id, code: row.code } },
          update: { name: row.name, pricePerKg: row.pricePerKg },
          create: {
            pricelistId: pricelist.id,
            code: row.code,
            name: row.name,
            pricePerKg: row.pricePerKg,
          },
        });
        pricelistItemsUpserted++;
      }
    } else if (isBundleFile(filename)) {
      const lines = parsed.rows.filter((r) => r.kg > 0);
      const stat = await fs.stat(filePath);
      const orderDate = stat.mtime;
      log(
        `  bundle totalKg=${parsed.totalKg} totalPrice=${parsed.totalPriceWithVat} lines=${lines.length} orderDate=${orderDate.toISOString().slice(0, 10)}`,
      );
      if (dry) {
        bundlesUpserted++;
        bundleLinesUpserted += lines.length;
        continue;
      }
      const bundle = await prisma.supplierBundle.upsert({
        where: { supplierId_sourceFile: { supplierId: supplier.id, sourceFile: filePath } },
        update: {
          totalKg: parsed.totalKg,
          totalPrice: parsed.totalPriceWithVat,
          orderDate,
        },
        create: {
          supplierId: supplier.id,
          sourceFile: filePath,
          totalKg: parsed.totalKg,
          totalPrice: parsed.totalPriceWithVat,
          orderDate,
          status: "ordered",
        },
      });
      bundlesUpserted++;
      for (const row of lines) {
        await prisma.supplierBundleLine.upsert({
          where: { bundleId_code: { bundleId: bundle.id, code: row.code } },
          update: {
            name: row.name,
            kg: row.kg,
            pricePerKg: row.pricePerKg,
            totalPrice: row.total,
          },
          create: {
            bundleId: bundle.id,
            code: row.code,
            name: row.name,
            kg: row.kg,
            pricePerKg: row.pricePerKg,
            totalPrice: row.total,
          },
        });
        bundleLinesUpserted++;
      }
    } else {
      log(`  skip: unknown file pattern`);
    }
  }

  return {
    supplierId: supplier.id,
    pricelistsUpserted,
    pricelistItemsUpserted,
    bundlesUpserted,
    bundleLinesUpserted,
  };
}

async function main() {
  const argv = process.argv.slice(2);
  const dry = argv.includes("--dry");
  const dirIdx = argv.indexOf("--dir");
  const dir = dirIdx >= 0 ? argv[dirIdx + 1]! : path.join(process.cwd(), "docs/suppliers/opatex");

  const prisma = new PrismaClient();
  try {
    const result = await importOpatex({
      dir,
      prisma,
      dry,
      log: (m) => console.log(m),
    });
    console.log("");
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

const isMain =
  typeof process !== "undefined" &&
  Array.isArray(process.argv) &&
  process.argv[1] &&
  /import-opatex\.ts$/.test(process.argv[1]);
if (isMain) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
