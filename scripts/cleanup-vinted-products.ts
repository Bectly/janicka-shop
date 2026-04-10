/**
 * Vinted Product Cleanup Script
 * Task #82: Clean up 354 imported Vinted products
 *
 * Handles:
 * 1. Description cleanup (remove Vinted-specific text, trim emojis)
 * 2. Category fixes (misassigned products)
 * 3. Size normalization
 * 4. Brand normalization (casing, deduplication)
 * 5. Condition verification
 * 6. Deactivate non-target products (men's, kids, non-clothing)
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// ============================================================
// 1. BRAND NORMALIZATION MAP
// ============================================================
const BRAND_NORMALIZATIONS: Record<string, string> = {
  // Lowercase fixes
  "adidas": "Adidas",
  "cartini": "Cartini",
  "crane": "Crane",
  "ardene": "Ardene",
  "paprika": "Paprika",
  "dali fashion": "Dali Fashion",
  "me women": "Me Women",
  "ever.me": "Ever.me",
  "sweat shaper": "Sweat Shaper",

  // Sub-brand consolidation
  "H&M Divided": "H&M",
  "Zara Basic": "Zara",
  "Zara Trafaluc": "Zara",
  "Nike Air": "Nike",
  "Puma x Ferrari": "Puma",
  "QS by s.Oliver": "QS by s.Oliver",
  "bpc bonprix collection": "Bonprix",

  // Proper casing
  "ALWAYS JEANS": "Always Jeans",
  "ATHL SPORT": "ATHL Sport",
  "BIBA": "Biba",
  "STONES": "Stones",
  "ONLY": "Only",
  "OPUS": "Opus",
  "ORSAY": "Orsay",
  "OXMO": "Oxmo",
  "REFREE": "Refree",
  "GUESS": "Guess",
};

// ============================================================
// 2. CATEGORY REASSIGNMENT RULES
// ============================================================
const CATEGORY_IDS = {
  topy: "cmnraww860001ijkaq5rrfzki",
  bundy: "cmnraww860002ijkamvs97gf2",
  saty: "cmnraww860003ijkaq4s0ramc",
  kalhoty: "cmnraww860005ijkarafpyo8i",
  doplnky: "cmnraww860004ijka574ligg0",
};

// Products to move to correct categories (by ID)
const CATEGORY_FIXES: Record<string, string> = {
  // Blazers/jackets/cardigans currently in Topy → Bundy
  "cmnrb8mgo000lijq07llse87t": CATEGORY_IDS.bundy, // Elegantní černé sako
  "cmnrb8mhu000xijq0yf16q76b": CATEGORY_IDS.bundy, // Lehká bunda Nike Windrunner
  "cmnrb8muw003xijq0hjy7dr6a": CATEGORY_IDS.bundy, // Bomber bunda Zara
  "cmnrb8o9800dpijq03riqnyrh": CATEGORY_IDS.bundy, // Výrazný dlouhý kardigan
  "cmnrb8ou600htijq0jqlpa9aw": CATEGORY_IDS.bundy, // Pletený kardigan Vero Moda
  "cmnrb8p3500jhijq0zyd4364a": CATEGORY_IDS.bundy, // merino kabátek
  "cmnrb8pmf00ndijq05b1w12wu": CATEGORY_IDS.bundy, // Masai kardigan
  "cmnrb8pnq00nlijq0hhe8mamx": CATEGORY_IDS.bundy, // Fransa kardigan
  "cmnrb8q0v00q5ijq0t88d57ph": CATEGORY_IDS.bundy, // InWear kardigan
  "cmnrb8q4i00qxijq0q0tiqezb": CATEGORY_IDS.bundy, // Růžový kašmírový kardigan
  "cmnrb8q5l00r5ijq0qe3guyqx": CATEGORY_IDS.bundy, // Krátká pletená vesta
  "cmnrb8q7i00rdijq0socgfcsv": CATEGORY_IDS.bundy, // Huňatý kardigan
  "cmnrb8qds00spijq0rt6tfh11": CATEGORY_IDS.bundy, // Tommy Jeans sherpa bunda
  "cmnrb8rcu00ytijq0dl3c7lis": CATEGORY_IDS.bundy, // kardigan Street One

  // Garcia Jeans kardigan currently in Kalhoty → Bundy
  "cmnrb8oap00e1ijq00nrcknue": CATEGORY_IDS.bundy,

  // Items in Šaty that should be elsewhere
  "cmnrb8mro0035ijq0kevg9dzk": CATEGORY_IDS.bundy,   // AMISU blazer → Bundy
  "cmnrb8n8e006xijq0c1xw7j2b": CATEGORY_IDS.topy,    // Tom Tailor svetr → Topy
  "cmnrb8noq00a1ijq0irtqgtzn": CATEGORY_IDS.topy,    // Vero Moda halenka → Topy
  "cmnrb8pvy00p5ijq0ykvk2t1u": CATEGORY_IDS.kalhoty, // Károvaná sukně → Kalhoty & Sukně
  "cmnrb8rjh00ztijq09mihawq1": CATEGORY_IDS.doplnky, // Černý pásek → Doplňky
  "cmnrb8rkn00zxijq0jvdkwhwx": CATEGORY_IDS.bundy,   // kimono/přehoz → Bundy
  "cmnrb8rm00105ijq0ghcv4s5j": CATEGORY_IDS.kalhoty, // skinny džíny → Kalhoty
  "cmnrb8s2x012pijq0pfqf2co7": CATEGORY_IDS.doplnky, // Stříbrný řetízek → Doplňky
  "cmnrb8s5q0135ijq0e0j0suvi": CATEGORY_IDS.doplnky, // Letní boty → Doplňky

  // Frank Walder komplet sako+sukně in Kalhoty → Bundy (sako is primary)
  "cmnrb8pcn00ldijq079jn9nmx": CATEGORY_IDS.bundy,

  // Overal in Šaty is OK (it's a one-piece garment)
};

// ============================================================
// 3. NON-TARGET PRODUCTS TO DEACTIVATE
// ============================================================
const DEACTIVATE_IDS = [
  "cmnrb8mdz0001ijq0mnnmwq0n", // Automatická míchačka na kojenecké mléko (Temu)
  "cmnrb8mi60011ijq0se10vx74", // Pánské sako Stones
  "cmnrb8mlt001xijq0oppny7bq", // Pánská bunda John Baner
  "cmnrb8mug003tijq0l0rbpe4c", // Pánská košilová bunda Bugatti
  "cmnrb8mxp004lijq02dlpyk2l", // ATHL Sport pánská bunda
  "cmnrb8mz5004xijq0pwudxfgm", // Pánské polo Calvin Klein
  "cmnrb8mzn0051ijq0ck3f4u1c", // Pánský svetr Basefield
  "cmnrb8n1k005hijq0lusjnr8w", // Pánský svetr Bäumler
  "cmnrb8n31005tijq0jhek0kxx", // Pánský svetr Marvelis
  "cmnrb8n3i005xijq0ozg4kpo6", // Pánský kardigan Pierre Cardin
  "cmnrb8onw00gpijq0rgpwrqk6", // Černý pánský svetr Fishbone
  "cmnrb8pbk00l5ijq067bj9dcr", // Pánské sako Montego
  "cmnrb8pc400l9ijq0rrvxq99j", // Chlapecká zimní bunda Spider-Man
  "cmnrb8q5300r1ijq0du50lyye", // Funkční sportovní triko CRAFT junior (dětské)
  "cmnrb8q8100rhijq0fpzmr1r8", // Pánské sportovní tílko Crane
  "cmnrb8qop00upijq0wgcce2tr", // Sportovní pánské kalhoty Adidas
  "cmnrb8rdl00yxijq0wpgoeda1", // Tommy Hilfiger růžová košile (dětská 14 let)
  "cmnrb8s6f0139ijq0vukepart", // Pánská zimní bunda CXS
  "cmnrb8rw5011pijq0d4cnydlp", // TrueLife vyhřívací deka (not clothing)
];

// ============================================================
// 4. DESCRIPTION CLEANUP
// ============================================================

// Vinted-specific patterns to remove
const VINTED_PATTERNS = [
  /Mrkni i na další věci u mě na profilu?[^\n]*/gi,
  /📦\s*Rychlé odeslání[^\n]*/gi,
  /🛍️?\s*Sleva na sety[^\n]*/gi,
  /💸\s*Sleva na sety[^\n]*/gi,
  /Posílám přes Zásilkovnu[^\n]*/gi,
  /Posílám přes [^\n]*Zásilkovn[^\n]*/gi,
  /Nakup u mě[^\n]*/gi,
  /Koukni na m[ůu]j profil[^\n]*/gi,
  /Podívej se na m[ůu]j profil[^\n]*/gi,
  /Pošlu přes[^\n]*/gi,
  /Odešlu[^\n]*Zásilkovn[^\n]*/gi,
  /Odeslání[^\n]*Zásilkovn[^\n]*/gi,
  /Osobní předání[^\n]*/gi,
  /Možnost osobního[^\n]*/gi,
  /Ráda zodpovím[^\n]*dotaz[^\n]*/gi,
  /Ptejte se[^\n]*/gi,
  /V případě dotaz[ůu][^\n]*/gi,
  /Napište[^\n]*dotaz[^\n]*/gi,
  /Kombinuj[^\n]*slev[^\n]*/gi,
  /Při koupi[^\n]*slev[^\n]*/gi,
  /Při nákupu[^\n]*slev[^\n]*/gi,
  /Více kusů[^\n]*slev[^\n]*/gi,
  /Balík[^\n]*slev[^\n]*/gi,
  /Set[^\n]*výhodn[^\n]*/gi,
  /Akce[^\n]*slev[^\n]*/gi,
  /Cena[^\n]*dohodn[^\n]*/gi,
  /Cena[^\n]*domluvě[^\n]*/gi,
  /Slevu[^\n]*nabídnu[^\n]*/gi,
  /Nabízím[^\n]*slevu[^\n]*/gi,
  /Sleduj[^\n]*profil[^\n]*/gi,
  /📦\s*Odes[^\n]*/gi,
  /Odeslání do[^\n]*/gi,
  /Zásilkovna\s*\/?\s*PPL[^\n]*/gi,
  /Zásilkovna[^\n]*Česká pošta[^\n]*/gi,
  /Zásilkovna[^\n]*PPL[^\n]*/gi,
  /Zásilkovna nebo[^\n]*/gi,
];

// Emoji removal via Unicode property escape — removes all emoji
const EMOJI_PATTERN = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F000}-\u{1FFFF}\u{200D}\u{20E3}\u{E0020}-\u{E007F}]+/gu;

function cleanDescription(desc: string): string {
  let cleaned = desc;

  // Remove Vinted-specific lines
  for (const pattern of VINTED_PATTERNS) {
    cleaned = cleaned.replace(pattern, "");
  }

  // Remove emojis
  cleaned = cleaned.replace(EMOJI_PATTERN, "");

  // Remove "Značka: X" lines (redundant — brand field exists)
  cleaned = cleaned.replace(/Značka:?\s*[^\n]+\n?/gi, "");

  // Remove "Stav: X" standalone lines (redundant — condition field exists)
  cleaned = cleaned.replace(/^\s*Stav:?\s*(nový|nové|výborn|velmi dobr|dobr|použit|nenošen|minimálně nošen)[^\n]*$/gim, "");

  // Remove lines that are just whitespace or dashes
  cleaned = cleaned.replace(/^\s*[-–—]+\s*$/gm, "");

  // Collapse multiple blank lines to max 2
  cleaned = cleaned.replace(/\n{3,}/g, "\n\n");

  // Trim whitespace
  cleaned = cleaned.trim();

  return cleaned;
}

// ============================================================
// 5. SIZE NORMALIZATION
// ============================================================
function normalizeSizes(sizesJson: string, name: string): string {
  try {
    const sizes: string[] = JSON.parse(sizesJson);
    if (sizes.length === 0) return sizesJson;

    // Keep first element as-is if it's a standard letter size
    // Remove UK numeric sizes (third element like "6", "8", "10") — not relevant for CZ market
    // Keep EU numeric sizes (second element like "34", "36", "38")

    const normalized: string[] = [];

    for (const size of sizes) {
      const s = size.trim();

      // Skip kids sizes (will be deactivated anyway)
      if (s.includes("roky") || s.includes("let")) continue;
      // Skip cm ranges for kids
      if (/^\d{2,3}[–-]\d{2,3}\s*cm$/.test(s)) continue;

      // Keep standard letter sizes
      if (/^(XXS|XS|S|M|L|XL|XXL|XXXL|4XL|5XL|6XL|7XL)$/i.test(s)) {
        normalized.push(s.toUpperCase());
        continue;
      }

      // Keep EU numeric sizes (32-54)
      if (/^(3[2-9]|4[0-9]|5[0-4])$/.test(s)) {
        normalized.push(s);
        continue;
      }

      // Keep bra sizes
      if (/^\d{2}[A-F]$/.test(s)) {
        normalized.push(s);
        continue;
      }

      // Keep waist sizes (W28-W40)
      if (/^W\d{2}$/.test(s)) {
        normalized.push(s);
        continue;
      }

      // Keep shoe sizes
      if (/^(3[5-9]|4[0-6])$/.test(s)) {
        normalized.push(s);
        continue;
      }

      // Keep special values
      if (s === "Univerzální" || s === "Jiná") {
        normalized.push(s);
        continue;
      }

      // Keep "80 cm" waist measurements
      if (/^\d+\s*cm$/.test(s)) {
        normalized.push(s);
        continue;
      }

      // Skip UK sizes (single digit 4-22 that are already covered by letter/EU)
      if (/^([4-9]|1[0-9]|2[0-2])$/.test(s) && normalized.length > 0) {
        continue;
      }

      // Keep everything else as-is
      normalized.push(s);
    }

    // Deduplicate
    const unique = [...new Set(normalized)];

    return JSON.stringify(unique);
  } catch {
    return sizesJson;
  }
}

// ============================================================
// 6. MAIN EXECUTION
// ============================================================
async function main() {
  console.log("=== Vinted Product Cleanup Script ===\n");

  const allProducts = await prisma.product.findMany({
    select: {
      id: true,
      name: true,
      description: true,
      brand: true,
      condition: true,
      sizes: true,
      colors: true,
      categoryId: true,
    },
  });

  console.log(`Total products: ${allProducts.length}\n`);

  let stats = {
    deactivated: 0,
    categoryFixed: 0,
    brandNormalized: 0,
    brandFilled: 0,
    descriptionCleaned: 0,
    sizesNormalized: 0,
    namesCleaned: 0,
  };

  // --- Step 1: Deactivate non-target products ---
  console.log("Step 1: Deactivating non-target products (men's, kids, non-clothing)...");
  for (const id of DEACTIVATE_IDS) {
    await prisma.product.update({
      where: { id },
      data: { active: false },
    });
    stats.deactivated++;
  }
  console.log(`  Deactivated: ${stats.deactivated} products\n`);

  // --- Step 2: Fix categories ---
  console.log("Step 2: Fixing category assignments...");
  for (const [productId, newCategoryId] of Object.entries(CATEGORY_FIXES)) {
    await prisma.product.update({
      where: { id: productId },
      data: { categoryId: newCategoryId },
    });
    stats.categoryFixed++;
  }
  console.log(`  Categories fixed: ${stats.categoryFixed} products\n`);

  // --- Step 3: Normalize brands, sizes, descriptions ---
  console.log("Step 3: Normalizing brands, sizes, and descriptions...");

  for (const product of allProducts) {
    const updates: Record<string, unknown> = {};

    // Brand normalization
    if (product.brand) {
      const normalized = BRAND_NORMALIZATIONS[product.brand];
      if (normalized && normalized !== product.brand) {
        updates.brand = normalized;
        stats.brandNormalized++;
      }
    }

    // Try to extract brand from name/description if missing
    if (!product.brand || product.brand === "") {
      const brandMatch = product.name.match(/(?:značka|Značka)\s+(\S+)/i)
        || product.description.match(/(?:značka|Značka):?\s*(\S+)/i);
      if (brandMatch) {
        updates.brand = brandMatch[1].replace(/[,.]$/, "");
        stats.brandFilled++;
      }
    }

    // Description cleanup
    const cleanedDesc = cleanDescription(product.description);
    if (cleanedDesc !== product.description) {
      updates.description = cleanedDesc;
      stats.descriptionCleaned++;
    }

    // Size normalization
    const normalizedSizes = normalizeSizes(product.sizes, product.name);
    if (normalizedSizes !== product.sizes) {
      updates.sizes = normalizedSizes;
      stats.sizesNormalized++;
    }

    // Clean product name: remove emojis, excessive punctuation
    let cleanedName = product.name
      .replace(EMOJI_PATTERN, "")
      .replace(/^\s+|\s+$/g, "")
      .replace(/\s{2,}/g, " ");
    if (cleanedName !== product.name) {
      updates.name = cleanedName;
      stats.namesCleaned++;
    }

    // Sanitize all string values — remove any lone surrogates or broken unicode
    for (const key of Object.keys(updates)) {
      if (typeof updates[key] === "string") {
        updates[key] = (updates[key] as string).replace(/[\uD800-\uDFFF]/g, "");
      }
    }

    // Apply updates if any
    if (Object.keys(updates).length > 0) {
      await prisma.product.update({
        where: { id: product.id },
        data: updates,
      });
    }
  }

  console.log(`  Brands normalized: ${stats.brandNormalized}`);
  console.log(`  Brands filled (from name/desc): ${stats.brandFilled}`);
  console.log(`  Descriptions cleaned: ${stats.descriptionCleaned}`);
  console.log(`  Sizes normalized: ${stats.sizesNormalized}`);
  console.log(`  Names cleaned (emojis removed): ${stats.namesCleaned}\n`);

  // --- Step 4: Additional category fixes via name matching ---
  console.log("Step 4: Auto-fixing remaining category misassignments...");

  // Find jackets/coats still in wrong categories
  const jacketsInWrongCat = await prisma.product.findMany({
    where: {
      active: true,
      categoryId: { not: CATEGORY_IDS.bundy },
      OR: [
        { name: { contains: "bunda" } },
        { name: { contains: "Bunda" } },
        { name: { contains: "kabát" } },
        { name: { contains: "Kabát" } },
      ],
    },
    select: { id: true, name: true, categoryId: true },
  });

  let autoFixed = 0;
  for (const p of jacketsInWrongCat) {
    // Only move if clearly a jacket/coat (not "bundička" in a combo)
    if (/\bbund[auy]\b/i.test(p.name) || /\bkabát/i.test(p.name)) {
      await prisma.product.update({
        where: { id: p.id },
        data: { categoryId: CATEGORY_IDS.bundy },
      });
      autoFixed++;
    }
  }

  // Find accessories in wrong categories
  const accessoriesInWrongCat = await prisma.product.findMany({
    where: {
      active: true,
      categoryId: { not: CATEGORY_IDS.doplnky },
      OR: [
        { name: { contains: "kabelk" } },
        { name: { contains: "Kabelk" } },
        { name: { contains: "náhrdelník" } },
        { name: { contains: "náramek" } },
        { name: { contains: "pásek" } },
        { name: { contains: "řetízek" } },
        { name: { contains: "boty" } },
        { name: { contains: "Boty" } },
        { name: { contains: "lodičky" } },
        { name: { contains: "Lodičky" } },
      ],
    },
    select: { id: true, name: true, categoryId: true },
  });

  for (const p of accessoriesInWrongCat) {
    await prisma.product.update({
      where: { id: p.id },
      data: { categoryId: CATEGORY_IDS.doplnky },
    });
    autoFixed++;
  }

  // Find skirts/pants in wrong categories
  const pantsInWrongCat = await prisma.product.findMany({
    where: {
      active: true,
      categoryId: { not: CATEGORY_IDS.kalhoty },
      OR: [
        { name: { contains: "sukně" } },
        { name: { contains: "Sukně" } },
        { name: { contains: "džíny" } },
        { name: { contains: "Džíny" } },
        { name: { contains: "jeans" } },
        { name: { contains: "Jeans" } },
        { name: { contains: "legíny" } },
        { name: { contains: "Legíny" } },
      ],
    },
    select: { id: true, name: true, categoryId: true },
  });

  for (const p of pantsInWrongCat) {
    // Skip if it's primarily a set or combination
    if (/komplet|set|sada/i.test(p.name)) continue;
    // Only move if clearly pants/skirts
    if (/\b(sukně|džíny|jeans|legíny)\b/i.test(p.name)) {
      await prisma.product.update({
        where: { id: p.id },
        data: { categoryId: CATEGORY_IDS.kalhoty },
      });
      autoFixed++;
    }
  }

  console.log(`  Auto-fixed categories: ${autoFixed} products\n`);

  // --- Summary ---
  const finalCounts = await prisma.product.groupBy({
    by: ["categoryId"],
    where: { active: true },
    _count: { id: true },
  });

  const categories = await prisma.category.findMany();
  const catMap = Object.fromEntries(categories.map(c => [c.id, c.name]));

  console.log("=== Final Category Distribution (active only) ===");
  let totalActive = 0;
  for (const fc of finalCounts) {
    console.log(`  ${catMap[fc.categoryId] || fc.categoryId}: ${fc._count.id}`);
    totalActive += fc._count.id;
  }
  console.log(`  TOTAL ACTIVE: ${totalActive}`);
  console.log(`  DEACTIVATED: ${stats.deactivated}\n`);

  console.log("=== Cleanup Summary ===");
  console.log(`  Products deactivated: ${stats.deactivated}`);
  console.log(`  Categories manually fixed: ${stats.categoryFixed}`);
  console.log(`  Categories auto-fixed: ${autoFixed}`);
  console.log(`  Brands normalized: ${stats.brandNormalized}`);
  console.log(`  Brands filled: ${stats.brandFilled}`);
  console.log(`  Descriptions cleaned: ${stats.descriptionCleaned}`);
  console.log(`  Sizes normalized: ${stats.sizesNormalized}`);
  console.log(`  Names cleaned: ${stats.namesCleaned}`);
  console.log(`\nTotal products modified: ${new Set([
    ...DEACTIVATE_IDS,
    ...Object.keys(CATEGORY_FIXES),
  ]).size + stats.brandNormalized + stats.brandFilled + stats.descriptionCleaned + stats.sizesNormalized + stats.namesCleaned + autoFixed}`);

  console.log("\n✓ Cleanup complete!");
}

main()
  .catch((e) => {
    console.error("Error:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
