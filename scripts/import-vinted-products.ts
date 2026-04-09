/**
 * Vinted → Janička Shop Product Importer
 *
 * Reads scraped Vinted products (from scrape-vinted.ts output)
 * and imports them into the Janička Shop database.
 *
 * Steps:
 * 1. Read scripts/vinted-data/products.json
 * 2. Map Vinted fields → Prisma Product model
 * 3. Use Vinted photo URLs directly (Next.js remotePatterns configured)
 * 4. Create products in database (hidden/draft by default)
 * 5. Create PriceHistory entries for 30-day price compliance
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
import { PrismaClient } from "@prisma/client";

const PRODUCTS_FILE = path.join(__dirname, "vinted-data", "products.json");

// Condition mapping: Vinted CZ → Janička Shop
// NOTE: Vinted CZ uses masculine adjective forms ("Nový") NOT neuter ("Nové").
// Both forms are listed to be safe.
const CONDITION_MAP: Record<string, string> = {
  // Masculine forms (actual Vinted CZ output)
  "Nový s visačkou": "new_with_tags",
  "Nový bez visačky": "new_with_tags",
  // Neuter forms (fallback)
  "Nové s visačkou": "new_with_tags",
  "Nové bez visačky": "new_with_tags",
  // Masculine forms
  "Velmi dobrý": "excellent",
  "Dobrý": "good",
  "Uspokojivý": "visible_wear",
  // Neuter forms
  "Velmi dobré": "excellent",
  "Dobré": "good",
  "Uspokojivé": "visible_wear",
  // Fallback English terms
  "new with tags": "new_with_tags",
  "new without tags": "new_with_tags",
  "very good": "excellent",
  good: "good",
  satisfactory: "visible_wear",
};

// Category keyword mapping: Vinted categories → Janička category slugs
const CATEGORY_KEYWORDS: [string[], string][] = [
  [["šaty", "dress", "šat"], "saty"],
  [["top", "tílko", "halenk", "tričk", "svetr", "mikina", "blůz", "košil", "rolák", "cardigan", "polokošile", "triko", "vesta", "crop"], "topy-halenky"],
  [["kalhot", "sukn", "džín", "jeans", "legín", "šortk", "kraťas", "bermudy"], "kalhoty-sukne"],
  [["bund", "kabát", "sako", "blejzr", "pláštěnk", "vesta", "parka", "coat", "jacket", "blazer"], "bundy-kabaty"],
  [["kabelk", "šátek", "šátk", "šperky", "náušnic", "náhrdelník", "prsten", "hodinky", "pásek", "čepic", "klobouk", "brýle", "peněženk", "batoh", "tašk", "doplň",
    // Footwear — no dedicated shoe category, Doplňky is closest
    "boty", "lodičk", "tenisky", "sandál", "espadryl", "skor", "střevíc", "pantofle", "kozačk", "baleríny", "pumpy", "sneaker", "loafer"], "doplnky"],
];

interface CategoryInfo {
  id: string;
  name: string;
  slug: string;
}

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
    ? brand
        .slice(0, 3)
        .toUpperCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^A-Z]/g, "X")
    : "GEN";
  return `VNT-${brandCode}-${String(index).padStart(4, "0")}`;
}

function mapCondition(vintedCondition: string): string {
  if (!vintedCondition) return "good";

  // Exact match
  if (CONDITION_MAP[vintedCondition]) return CONDITION_MAP[vintedCondition];

  // Case-insensitive partial match
  const lower = vintedCondition.toLowerCase();
  for (const [key, value] of Object.entries(CONDITION_MAP)) {
    if (lower.includes(key.toLowerCase())) return value;
  }

  return "good";
}

function mapCategory(
  vintedCategory: string,
  title: string,
  description: string,
  categories: CategoryInfo[]
): string {
  const searchText = `${vintedCategory} ${title} ${description}`.toLowerCase();

  for (const [keywords, slug] of CATEGORY_KEYWORDS) {
    for (const keyword of keywords) {
      if (searchText.includes(keyword)) {
        const cat = categories.find((c) => c.slug === slug);
        if (cat) return cat.id;
      }
    }
  }

  // Default to "Topy & Halenky" as the largest category
  const defaultCat = categories.find((c) => c.slug === "topy-halenky");
  return defaultCat?.id || categories[0]?.id || "";
}

/**
 * Convert Vinted photo URLs to full-resolution URLs.
 * Vinted URLs: https://images1.vinted.net/t/{hash}/{size}/{id}.webp?s=...
 * We want f1600x1600 for quality but also the URL without query params
 * for cleaner storage (the query string is a signature that may expire).
 */
function normalizePhotoUrl(url: string): string {
  // Upgrade resolution to f800x800 (good quality, reasonable size)
  // f1600x1600 may not be available for all images
  return url.replace(/\/(?:f?\d+x\d+)\//, "/f800x800/");
}

async function main() {
  const isDryRun = process.argv.includes("--dry-run");
  const isPublish = process.argv.includes("--publish");

  if (!fs.existsSync(PRODUCTS_FILE)) {
    console.error(`Products file not found: ${PRODUCTS_FILE}`);
    console.error("Run scrape-vinted.ts first!");
    process.exit(1);
  }

  const rawProducts = JSON.parse(fs.readFileSync(PRODUCTS_FILE, "utf-8"));
  console.log(`=== Vinted → Janička Shop Importer ===`);
  console.log(`Products to import: ${rawProducts.length}`);
  console.log(`Mode: ${isDryRun ? "DRY RUN" : "LIVE"}`);
  console.log(`Publish: ${isPublish ? "YES (active)" : "NO (draft)"}`);
  console.log();

  // Filter out products with no title or price
  const products = rawProducts.filter(
    (p: any) => p.title && p.title.length > 2 && p.price > 0
  );
  console.log(`Valid products (with title + price): ${products.length}`);
  console.log(
    `Skipped (no title/price): ${rawProducts.length - products.length}`
  );

  const db = new PrismaClient();

  try {
    // Get all categories
    const categories = await db.category.findMany({
      select: { id: true, name: true, slug: true },
    });
    console.log(
      `Categories in DB: ${categories.map((c) => c.slug).join(", ")}`
    );

    // Check for existing products (skip duplicates)
    const existingProducts = await db.product.findMany({
      select: { slug: true, sku: true },
    });
    const existingSlugs = new Set(existingProducts.map((p) => p.slug));
    const existingSKUs = new Set(existingProducts.map((p) => p.sku));

    // Prepare import data
    const importData = products.map((p: any, i: number) => {
      // Clean up title (remove emojis at start/end for cleaner product names)
      let title = p.title
        .replace(/^\s*[\u{1F300}-\u{1FAFF}\u{2702}-\u{27B0}]+\s*/u, "")
        .replace(/\s*[\u{1F300}-\u{1FAFF}\u{2702}-\u{27B0}]+\s*$/u, "")
        .trim();
      if (!title) title = p.title; // Fallback to original if stripping removed everything

      let slug = slugify(title);
      // Ensure slug uniqueness by appending vintedId
      if (existingSlugs.has(slug)) {
        slug = `${slug}-${p.vintedId}`;
      }

      let sku = generateSKU(p.brand, i + 1);
      let skuAttempt = 0;
      while (existingSKUs.has(sku)) {
        skuAttempt++;
        sku = generateSKU(p.brand, i + 1 + skuAttempt * 1000);
      }

      // Photo URLs — use Vinted CDN directly
      const photoUrls = (p.photoUrls || []).map(normalizePhotoUrl);

      // Parse sizes from the Vinted size string (e.g., "S / 36 / 8")
      const sizeStr = p.size || "";
      const sizes = sizeStr
        ? sizeStr
            .split("/")
            .map((s: string) => s.trim())
            .filter(Boolean)
        : [];

      // Colors
      const colors = Array.isArray(p.color) ? p.color : [];

      const categoryId = mapCategory(
        p.category,
        p.title,
        p.description,
        categories
      );

      return {
        name: title,
        slug,
        description: p.description || `${title} — second hand`,
        price: p.price,
        compareAt: p.originalPrice || null,
        sku,
        categoryId,
        brand: p.brand || null,
        condition: mapCondition(p.condition),
        sizes: JSON.stringify(sizes),
        colors: JSON.stringify(colors),
        images: JSON.stringify(photoUrls),
        stock: 1,
        featured: false,
        active: isPublish,
        sold: false,
        // Metadata for reference
        _vintedId: p.vintedId,
        _vintedUrl: p.url,
        _vintedCategory: p.category,
      };
    });

    // Print summary
    const brandCounts = new Map<string, number>();
    const categoryCounts = new Map<string, number>();
    const conditionCounts = new Map<string, number>();

    for (const item of importData) {
      const brand = item.brand || "(neznámá)";
      brandCounts.set(brand, (brandCounts.get(brand) || 0) + 1);

      const cat = categories.find((c) => c.id === item.categoryId);
      const catName = cat?.name || "(nepřiřazeno)";
      categoryCounts.set(catName, (categoryCounts.get(catName) || 0) + 1);

      conditionCounts.set(
        item.condition,
        (conditionCounts.get(item.condition) || 0) + 1
      );
    }

    console.log("\n--- Značky (top 15) ---");
    [...brandCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .forEach(([b, c]) => console.log(`  ${b}: ${c}`));

    console.log("\n--- Kategorie ---");
    [...categoryCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .forEach(([c, n]) => console.log(`  ${c}: ${n}`));

    console.log("\n--- Stav ---");
    [...conditionCounts.entries()].forEach(([c, n]) =>
      console.log(`  ${c}: ${n}`)
    );

    const totalPhotos = importData.reduce(
      (sum: number, p: any) =>
        sum + JSON.parse(p.images).length,
      0
    );
    console.log(`\nCelkem fotek: ${totalPhotos}`);

    if (isDryRun) {
      console.log("\n[DRY RUN] Žádné změny provedeny. Odstraňte --dry-run pro import.");
      const preview = importData.slice(0, 5).map((p: any) => ({
        name: p.name,
        slug: p.slug,
        price: p.price,
        brand: p.brand,
        condition: p.condition,
        categoryId: p.categoryId,
        sizes: p.sizes,
        colors: p.colors,
        images: `${JSON.parse(p.images).length} fotek`,
      }));
      console.log("\nPrvních 5 produktů:");
      console.log(JSON.stringify(preview, null, 2));
      return;
    }

    // LIVE IMPORT
    console.log("\n--- Importuji do databáze ---");
    let created = 0;
    let skipped = 0;
    let errors = 0;

    for (let i = 0; i < importData.length; i++) {
      const item = importData[i];

      // Skip duplicates
      if (existingSlugs.has(item.slug)) {
        skipped++;
        continue;
      }

      try {
        const product = await db.product.create({
          data: {
            name: item.name,
            slug: item.slug,
            description: item.description,
            price: item.price,
            compareAt: item.compareAt,
            sku: item.sku,
            categoryId: item.categoryId,
            brand: item.brand,
            condition: item.condition,
            sizes: item.sizes,
            colors: item.colors,
            images: item.images,
            stock: item.stock,
            featured: item.featured,
            active: item.active,
            sold: item.sold,
          },
        });

        // Create initial PriceHistory entry (30-day price compliance)
        await db.priceHistory.create({
          data: {
            productId: product.id,
            price: item.price,
          },
        });

        existingSlugs.add(item.slug);
        existingSKUs.add(item.sku);
        created++;

        if (created % 25 === 0) {
          console.log(`  Importováno: ${created}/${importData.length}`);
        }
      } catch (e: any) {
        errors++;
        console.error(
          `  Chyba u "${item.name}" (${item.slug}): ${e.message}`
        );
      }
    }

    console.log("\n=== IMPORT DOKONČEN ===");
    console.log(`Vytvořeno: ${created}`);
    console.log(`Přeskočeno (duplicity): ${skipped}`);
    console.log(`Chyby: ${errors}`);
    console.log(`Stav: ${isPublish ? "AKTIVNÍ (viditelné)" : "SKRYTÉ (draft)"}`);
    if (!isPublish) {
      console.log(
        '\nProdukty jsou skryté. Spusťte s --publish pro aktivaci, nebo aktivujte v adminu.'
      );
    }
  } finally {
    await db.$disconnect();
  }
}

main().catch(console.error);
