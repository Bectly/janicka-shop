/**
 * Vinted Cleanup Pass 3 — remaining issues from pass 1+2
 *
 * Fixes:
 * 1. Deactivate 7 more non-target items (porcelain, crystal, baby gear, motorcycle boots)
 * 2. Fill 23 NULL brands where extractable from name
 * 3. Clean remaining emoji/special chars from names
 * 4. Clean remaining special chars (⬆/⭐) from descriptions
 * 5. Fix "Sweat Shaper" brand (was in normalization map but brand is null)
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const EMOJI_PATTERN =
  /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F000}-\u{1FFFF}\u{200D}\u{20E3}\u{E0020}-\u{E007F}\u{2B50}\u{2B06}\u{2764}]+/gu;

// Items to deactivate — non-clothing or non-target audience
const DEACTIVATE_IDS = [
  "cmnrb8mkf001lijq0drk4xfoq", // Spací pytel pro miminko Helios
  "cmnrb8mkv001pijq0xh0ywzjs", // Motorkářské boty Highway 1
  "cmnrb8rew00z5ijq02o6avdsl", // Set – černé hodinky + peněženka
  "cmnrb8rfn00z9ijq0ujxukjwi", // Porcelánové figurky
  "cmnrb8rxt011xijq0bq9vsrcm", // Porcelánový čínský šálek
  "cmnrb8ryl0121ijq0xwfki60k", // Exkluzivní krystal UPU
  "cmnrb8rz80125ijq0jjz3evro", // Dekorativní porcelánová váza
];

// Brand assignments for NULL-brand products (extracted from name/description)
const BRAND_FIXES: Record<string, string> = {
  "cmnrb8mfv000dijq06trp1dq2": "Sweat Shaper", // Sweat Shaper legíny
  "cmnrb8mol002hijq046te956j": "Jack Daniels", // Jack Daniels mikina
  "cmnrb8p3500jhijq0zyd4364a": "Merino", // 100% merino vlna kabátek (no brand, use material)
};

// These NULL-brand products are genuinely unbranded — leave null or set "Bez značky"
// for display purposes
const UNBRANDED_IDS = [
  "cmnrb8mq8002tijq0inysn0c1", // Černé sportovní kalhoty
  "cmnrb8ni5008tijq0bpgaw03u", // Dámské tílko s vzorem
  "cmnrb8nvd00bdijq0r8mvm1ve", // Jednoduché triko
  "cmnrb8ond00glijq0hthysp8b", // Dámská vzorovaná halenka
  "cmnrb8p3n00jlijq0ufo125qb", // Dámský svetr copánkový
  "cmnrb8qin00tlijq0lxfhd23f", // Lehké šedé kalhoty
  "cmnrb8qj800tpijq0tgbf8e7t", // Tmavě modrý šátek
  "cmnrb8ql300u1ijq0a8t024kl", // Lehké volné tričko
  "cmnrb8qng00uhijq0996kias4", // Pohodlný delší kousek s kapucí
  "cmnrb8qxx00wlijq0aayef013", // Pohodlný delší top
  "cmnrb8rha00zhijq0u2oizpy2", // Podprsenka s krajkou
  "cmnrb8rlc0101ijq0zvz3ao1m", // Sada náhrdelníku a náramku
  "cmnrb8rt80119ijq01nw4z4sd", // Lehké letní šaty
  "cmnrb8s010129ijq04iop0n3l", // Černá šála
  "cmnrb8s0u012dijq00qaxp7j3", // Černo-bílá kostkovaná šála
  "cmnrb8s2x012pijq0pfqf2co7", // Stříbrný řetízek
];

async function main() {
  console.log("=== Vinted Cleanup Pass 3 ===\n");

  let stats = {
    deactivated: 0,
    brandsFixed: 0,
    brandSetUnbranded: 0,
    namesCleaned: 0,
    descsCleaned: 0,
  };

  // --- Step 1: Deactivate non-target products ---
  console.log("Step 1: Deactivating remaining non-target items...");
  for (const id of DEACTIVATE_IDS) {
    try {
      await prisma.product.update({
        where: { id },
        data: { active: false },
      });
      stats.deactivated++;
    } catch (e) {
      console.log(`  SKIP ${id} (not found or already inactive)`);
    }
  }
  console.log(`  Deactivated: ${stats.deactivated}\n`);

  // --- Step 2: Fix NULL brands ---
  console.log("Step 2: Fixing NULL brands...");

  // Set known brands
  for (const [id, brand] of Object.entries(BRAND_FIXES)) {
    await prisma.product.update({
      where: { id },
      data: { brand },
    });
    stats.brandsFixed++;
    console.log(`  Set brand: ${brand}`);
  }

  // Set unbranded items to "Bez značky"
  for (const id of UNBRANDED_IDS) {
    const product = await prisma.product.findUnique({
      where: { id },
      select: { brand: true, active: true },
    });
    if (product && product.active && product.brand === null) {
      await prisma.product.update({
        where: { id },
        data: { brand: "Bez značky" },
      });
      stats.brandSetUnbranded++;
    }
  }
  console.log(`  Brands set: ${stats.brandsFixed}`);
  console.log(`  Set to 'Bez značky': ${stats.brandSetUnbranded}\n`);

  // --- Step 3: Clean names (remaining emojis) ---
  console.log("Step 3: Cleaning remaining emojis from names...");
  const allActive = await prisma.product.findMany({
    where: { active: true },
    select: { id: true, name: true, description: true },
  });

  for (const product of allActive) {
    const updates: Record<string, string> = {};

    // Clean name
    const cleanedName = product.name
      .replace(EMOJI_PATTERN, "")
      .replace(/\s{2,}/g, " ")
      .trim();
    if (cleanedName !== product.name) {
      updates.name = cleanedName;
      stats.namesCleaned++;
    }

    // Clean description — remaining special chars
    const cleanedDesc = product.description
      .replace(EMOJI_PATTERN, "")
      .replace(/[\uD800-\uDFFF]/g, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
    if (cleanedDesc !== product.description) {
      updates.description = cleanedDesc;
      stats.descsCleaned++;
    }

    if (Object.keys(updates).length > 0) {
      await prisma.product.update({
        where: { id: product.id },
        data: updates,
      });
    }
  }

  console.log(`  Names cleaned: ${stats.namesCleaned}`);
  console.log(`  Descriptions cleaned: ${stats.descsCleaned}\n`);

  // --- Step 4: Final verification ---
  console.log("=== Final Verification ===");

  const totalActive = await prisma.product.count({ where: { active: true } });
  const totalInactive = await prisma.product.count({ where: { active: false } });
  const nullBrands = await prisma.product.count({
    where: { active: true, brand: null },
  });

  const catDist = await prisma.product.groupBy({
    by: ["categoryId"],
    where: { active: true },
    _count: { id: true },
  });
  const categories = await prisma.category.findMany();
  const catMap = Object.fromEntries(categories.map((c) => [c.id, c.name]));

  console.log(`Active: ${totalActive}, Inactive: ${totalInactive}`);
  console.log(`NULL brands remaining: ${nullBrands}`);

  console.log("\nCategory distribution:");
  for (const c of catDist) {
    console.log(`  ${catMap[c.categoryId] || c.categoryId}: ${c._count.id}`);
  }

  // Check for remaining Vinted refs
  const vintedRefs = await prisma.product.count({
    where: {
      active: true,
      OR: [
        { description: { contains: "profil" } },
        { description: { contains: "Vinted" } },
        { description: { contains: "#" } },
        { description: { contains: "Zásilkovn" } },
      ],
    },
  });
  console.log(`Remaining Vinted references: ${vintedRefs}`);

  // Check remaining emojis in names
  const withEmoji = allActive.filter((p) =>
    EMOJI_PATTERN.test(p.name)
  );
  console.log(`Names with emojis: ${withEmoji.length}`);

  console.log("\n=== Summary ===");
  console.log(`  Deactivated: ${stats.deactivated}`);
  console.log(`  Brands fixed: ${stats.brandsFixed}`);
  console.log(`  Brands set 'Bez značky': ${stats.brandSetUnbranded}`);
  console.log(`  Names cleaned: ${stats.namesCleaned}`);
  console.log(`  Descriptions cleaned: ${stats.descsCleaned}`);
  console.log("\nPass 3 complete!");
}

main()
  .catch((e) => {
    console.error("Error:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
