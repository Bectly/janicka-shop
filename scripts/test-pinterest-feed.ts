/**
 * Schema validator for Pinterest Catalog feed (task #553).
 *
 * Verifies the TSV output of /api/feed/pinterest matches Pinterest's
 * Catalog spec before we submit the source URL to Pinterest Business.
 *
 * Checks:
 *   1. Header row matches PINTEREST_FEED_COLUMNS exactly.
 *   2. Every row has the same column count as the header.
 *   3. Required Pinterest fields are non-empty on every row:
 *        id, title, description, link, image_link, price,
 *        availability, condition.
 *   4. Enum fields carry Pinterest-accepted values:
 *        availability ∈ { in stock, out of stock, preorder, backorder }
 *        condition    ∈ { new, used, refurbished }
 *        gender       ∈ { male, female, unisex } (when present)
 *        age_group    ∈ { newborn, infant, toddler, kids, adult } (when present)
 *   5. price / sale_price end with " CZK" and parse as positive decimals.
 *   6. link starts with BASE_URL and points at /products/<slug>.
 *   7. image_link is an https URL.
 *   8. google_product_category is numeric (Google taxonomy ID).
 *   9. item_group_id is non-empty (each unique piece is its own group).
 *
 * Usage:
 *   Option A — live server:
 *     npm run dev
 *     FEED_URL="http://localhost:3000/api/feed/pinterest" tsx scripts/test-pinterest-feed.ts
 *
 *   Option B — against production (requires FEED_SECRET):
 *     FEED_URL="https://jvsatnik.cz/api/feed/pinterest?token=$FEED_SECRET" \
 *       tsx scripts/test-pinterest-feed.ts
 *
 * Exits 0 on pass, 1 on any failure.
 */

import { PINTEREST_FEED_COLUMNS } from "../src/app/api/feed/pinterest/route";

const FEED_URL =
  process.env.FEED_URL ?? "http://localhost:3000/api/feed/pinterest";

type Result = { name: string; ok: boolean; detail: string };
const results: Result[] = [];

function record(name: string, ok: boolean, detail: string) {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name} — ${detail}`);
}

const REQUIRED_NON_EMPTY = [
  "id",
  "title",
  "description",
  "link",
  "image_link",
  "price",
  "availability",
  "condition",
  "item_group_id",
] as const;

const ALLOWED_AVAILABILITY = new Set([
  "in stock",
  "out of stock",
  "preorder",
  "backorder",
]);
const ALLOWED_CONDITION = new Set(["new", "used", "refurbished"]);
const ALLOWED_GENDER = new Set(["male", "female", "unisex"]);
const ALLOWED_AGE_GROUP = new Set([
  "newborn",
  "infant",
  "toddler",
  "kids",
  "adult",
]);

function parsePrice(value: string): number | null {
  if (!value) return null;
  const m = /^(\d+(?:\.\d+)?)\s+CZK$/.exec(value);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) && n > 0 ? n : null;
}

async function main() {
  console.log(`[pinterest-feed test] GET ${FEED_URL}`);
  const res = await fetch(FEED_URL, {
    headers: { Accept: "text/tab-separated-values" },
  });
  if (!res.ok) {
    console.error(`[pinterest-feed test] HTTP ${res.status} — aborting`);
    process.exit(1);
  }
  const tsv = await res.text();
  const lines = tsv.split("\n").filter((l) => l.length > 0);
  if (lines.length < 2) {
    console.error("[pinterest-feed test] feed has no data rows — aborting");
    process.exit(1);
  }

  const header = lines[0].split("\t");
  const rows = lines.slice(1).map((l) => l.split("\t"));
  console.log(
    `[pinterest-feed test] header columns=${header.length} data rows=${rows.length}`,
  );

  // 1. Header matches spec
  const expected = [...PINTEREST_FEED_COLUMNS];
  const headerOk =
    header.length === expected.length &&
    header.every((h, i) => h === expected[i]);
  record(
    "header row matches PINTEREST_FEED_COLUMNS",
    headerOk,
    headerOk
      ? `${header.length} columns in order`
      : `got ${header.join(",")} | want ${expected.join(",")}`,
  );

  const col = (row: string[], name: (typeof expected)[number]) =>
    row[expected.indexOf(name)] ?? "";

  // 2. Column-count parity
  const badWidth = rows.findIndex((r) => r.length !== header.length);
  record(
    "all rows have header column count",
    badWidth === -1,
    badWidth === -1
      ? `${rows.length} rows × ${header.length} columns`
      : `row #${badWidth} has ${rows[badWidth].length} cols`,
  );

  // 3. Required non-empty
  const missing: Array<{ row: number; field: string }> = [];
  rows.forEach((r, idx) => {
    for (const field of REQUIRED_NON_EMPTY) {
      if (!col(r, field as (typeof expected)[number])) {
        missing.push({ row: idx, field });
      }
    }
  });
  record(
    "required fields non-empty on every row",
    missing.length === 0,
    missing.length === 0
      ? `checked ${REQUIRED_NON_EMPTY.length} fields × ${rows.length} rows`
      : `${missing.length} empties, first: row ${missing[0].row} field ${missing[0].field}`,
  );

  // 4. Enums
  const enumErrors: string[] = [];
  rows.forEach((r, idx) => {
    const avail = col(r, "availability");
    if (!ALLOWED_AVAILABILITY.has(avail))
      enumErrors.push(`row ${idx} availability="${avail}"`);
    const cond = col(r, "condition");
    if (!ALLOWED_CONDITION.has(cond))
      enumErrors.push(`row ${idx} condition="${cond}"`);
    const gender = col(r, "gender");
    if (gender && !ALLOWED_GENDER.has(gender))
      enumErrors.push(`row ${idx} gender="${gender}"`);
    const age = col(r, "age_group");
    if (age && !ALLOWED_AGE_GROUP.has(age))
      enumErrors.push(`row ${idx} age_group="${age}"`);
  });
  record(
    "enum fields carry Pinterest-accepted values",
    enumErrors.length === 0,
    enumErrors.length === 0
      ? `availability + condition + gender + age_group all valid`
      : `${enumErrors.length} errors, first: ${enumErrors[0]}`,
  );

  // 5. Prices parse
  const priceErrors: string[] = [];
  rows.forEach((r, idx) => {
    if (parsePrice(col(r, "price")) === null)
      priceErrors.push(`row ${idx} price="${col(r, "price")}"`);
    const sale = col(r, "sale_price");
    if (sale && parsePrice(sale) === null)
      priceErrors.push(`row ${idx} sale_price="${sale}"`);
  });
  record(
    "price + sale_price parse as \"<decimal> CZK\"",
    priceErrors.length === 0,
    priceErrors.length === 0
      ? `all prices valid`
      : `${priceErrors.length} errors, first: ${priceErrors[0]}`,
  );

  // 6. Links
  const linkBase = new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://jvsatnik.cz",
  ).origin;
  const linkErrors: string[] = [];
  rows.forEach((r, idx) => {
    const link = col(r, "link");
    if (!link.startsWith(`${linkBase}/products/`))
      linkErrors.push(`row ${idx} link="${link}"`);
  });
  record(
    `link starts with ${linkBase}/products/`,
    linkErrors.length === 0,
    linkErrors.length === 0
      ? `all ${rows.length} rows`
      : `${linkErrors.length} errors, first: ${linkErrors[0]}`,
  );

  // 7. image_link https
  const imgErrors = rows.filter(
    (r) => !/^https:\/\//.test(col(r, "image_link")),
  ).length;
  record(
    "image_link is https URL",
    imgErrors === 0,
    imgErrors === 0 ? `all ${rows.length} rows` : `${imgErrors} non-https`,
  );

  // 8. google_product_category numeric
  const gpcErrors = rows.filter(
    (r) => !/^\d+$/.test(col(r, "google_product_category")),
  ).length;
  record(
    "google_product_category is numeric (Google taxonomy ID)",
    gpcErrors === 0,
    gpcErrors === 0 ? `all ${rows.length} rows` : `${gpcErrors} non-numeric`,
  );

  // 9. item_group_id non-empty already covered in REQUIRED_NON_EMPTY

  const failed = results.filter((r) => !r.ok);
  console.log(
    `\n=== ${results.length - failed.length}/${results.length} passed ===`,
  );
  if (failed.length > 0) {
    console.log(
      `FAILED: ${failed.map((f) => f.name).join(", ")}`,
    );
  }
  process.exit(failed.length === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
