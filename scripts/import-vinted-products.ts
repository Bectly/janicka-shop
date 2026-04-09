/**
 * Vinted → Janička Shop Product Importer
 *
 * Reads scraped Vinted products (from scrape-vinted.ts output)
 * and imports them into the Janička Shop database.
 *
 * Steps:
 * 1. Read scripts/vinted-data/products.json
 * 2. Upload photos to UploadThing
 * 3. Map Vinted fields → Prisma Product model
 * 4. Create products in database (draft/hidden by default)
 *
 * Usage:
 *   npx tsx scripts/import-vinted-products.ts [--dry-run] [--publish]
 *
 * Flags:
 *   --dry-run   Preview import without writing to DB
 *   --publish   Set products as active (default: hidden/draft)
 */

import * as fs from "fs";
import * as path from "path";

const PRODUCTS_FILE = path.join(__dirname, "vinted-data", "products.json");

// Condition mapping: Vinted CZ → Janička Shop
const CONDITION_MAP: Record<string, string> = {
  "Nové s visačkou": "new_with_tags",
  "Nové bez visačky": "new_without_tags",
  "Velmi dobré": "excellent",
  "Dobré": "good",
  "Uspokojivé": "fair",
  // Fallbacks
  "new with tags": "new_with_tags",
  "new without tags": "new_without_tags",
  "very good": "excellent",
  "good": "good",
  "satisfactory": "fair",
};

// Category mapping: Vinted categories → Janička categories
const CATEGORY_MAP: Record<string, string> = {
  "Šaty": "saty",
  "Topy a tílka": "topy-halenky",
  "Halenky": "topy-halenky",
  "Trička": "topy-halenky",
  "Svetry": "topy-halenky",
  "Kalhoty": "kalhoty-sukne",
  "Džíny": "kalhoty-sukne",
  "Sukně": "kalhoty-sukne",
  "Bundy a kabáty": "bundy-kabaty",
  "Kabáty": "bundy-kabaty",
  "Bundy": "bundy-kabaty",
  "Doplňky": "doplnky",
  "Kabelky": "doplnky",
  "Šperky": "doplnky",
  "Šátky": "doplnky",
};

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

function generateSKU(brand: string, index: number): string {
  const brandCode = brand
    ? brand.slice(0, 3).toUpperCase().replace(/[^A-Z]/g, "X")
    : "GEN";
  return `VNT-${brandCode}-${String(index).padStart(4, "0")}`;
}

function mapCondition(vintedCondition: string): string {
  // Try exact match first
  if (CONDITION_MAP[vintedCondition]) return CONDITION_MAP[vintedCondition];

  // Try case-insensitive partial match
  const lower = vintedCondition.toLowerCase();
  for (const [key, value] of Object.entries(CONDITION_MAP)) {
    if (lower.includes(key.toLowerCase())) return value;
  }

  return "good"; // Default
}

function mapCategory(vintedCategory: string): string {
  // Try each part of the category path
  const parts = vintedCategory.split(" > ");
  for (const part of parts) {
    if (CATEGORY_MAP[part]) return CATEGORY_MAP[part];
  }

  // Partial match
  const lower = vintedCategory.toLowerCase();
  for (const [key, value] of Object.entries(CATEGORY_MAP)) {
    if (lower.includes(key.toLowerCase())) return value;
  }

  return ""; // Unknown — will need manual categorization
}

async function main() {
  const isDryRun = process.argv.includes("--dry-run");
  const isPublish = process.argv.includes("--publish");

  if (!fs.existsSync(PRODUCTS_FILE)) {
    console.error(`Products file not found: ${PRODUCTS_FILE}`);
    console.error("Run scrape-vinted.ts first!");
    process.exit(1);
  }

  const products = JSON.parse(fs.readFileSync(PRODUCTS_FILE, "utf-8"));
  console.log(`=== Vinted → Janička Shop Importer ===`);
  console.log(`Products to import: ${products.length}`);
  console.log(`Mode: ${isDryRun ? "DRY RUN" : "LIVE"}`);
  console.log(`Publish: ${isPublish ? "YES (active)" : "NO (draft)"}`);
  console.log();

  const importData = products.map((p: any, i: number) => ({
    // Core fields
    name: p.title,
    slug: slugify(p.title) + `-${p.vintedId}`,
    sku: generateSKU(p.brand, i + 1),
    description: p.description,
    price: p.price,
    originalPrice: p.originalPrice || Math.round(p.price * 1.8), // Estimate 80% discount
    condition: mapCondition(p.condition),
    brand: p.brand,
    size: p.size,
    color: p.color.length > 0 ? p.color[0] : "",
    material: p.material,

    // Category (needs manual review for unmapped)
    categorySlug: mapCategory(p.category),
    vintedCategory: p.category, // Keep original for reference

    // Images (local paths — need upload to UploadThing)
    localPhotos: p.photos,
    photoUrls: p.photoUrls,

    // Metadata
    vintedId: p.vintedId,
    vintedUrl: p.url,
    vintedViews: p.views,
    vintedFavorites: p.favorites,

    // Status
    active: isPublish,
    quantity: 1, // Always 1 for second-hand
  }));

  // Print summary
  const brands = new Map<string, number>();
  const categories = new Map<string, number>();
  const conditions = new Map<string, number>();
  let unmappedCategories = 0;

  for (const item of importData) {
    brands.set(item.brand || "(unknown)", (brands.get(item.brand || "(unknown)") || 0) + 1);
    categories.set(
      item.categorySlug || "(unmapped)",
      (categories.get(item.categorySlug || "(unmapped)") || 0) + 1
    );
    conditions.set(item.condition, (conditions.get(item.condition) || 0) + 1);
    if (!item.categorySlug) unmappedCategories++;
  }

  console.log("--- Brands ---");
  [...brands.entries()]
    .sort((a, b) => b[1] - a[1])
    .forEach(([b, c]) => console.log(`  ${b}: ${c}`));

  console.log("\n--- Categories ---");
  [...categories.entries()]
    .sort((a, b) => b[1] - a[1])
    .forEach(([c, n]) => console.log(`  ${c}: ${n}`));

  console.log("\n--- Conditions ---");
  [...conditions.entries()].forEach(([c, n]) => console.log(`  ${c}: ${n}`));

  console.log(
    `\nTotal photos: ${importData.reduce(
      (sum: number, p: any) => sum + p.localPhotos.length,
      0
    )}`
  );
  if (unmappedCategories > 0) {
    console.log(`\n!! ${unmappedCategories} products have unmapped categories — need manual review`);
  }

  if (isDryRun) {
    console.log("\n[DRY RUN] No changes made. Remove --dry-run to import.");
    // Write preview
    fs.writeFileSync(
      path.join(__dirname, "vinted-data", "import-preview.json"),
      JSON.stringify(importData, null, 2)
    );
    console.log(`Preview saved to: vinted-data/import-preview.json`);
    return;
  }

  // TODO: Bolt implements the actual DB import + UploadThing upload
  // 1. For each product:
  //    a. Upload local photos to UploadThing → get URLs
  //    b. Map categorySlug to actual Category.id from DB
  //    c. Create Product record with all fields
  //    d. Create PriceHistory entry (30-day price compliance)
  // 2. Handle duplicates (check by vintedId or slug)
  // 3. Log import results

  console.log("\n!! DB import not yet implemented — Bolt will handle this.");
  console.log("Run with --dry-run to see the preview data.");
}

main().catch(console.error);
