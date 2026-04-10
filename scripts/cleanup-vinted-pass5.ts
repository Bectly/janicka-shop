/**
 * Vinted Cleanup Pass 5 — Final description polish
 *
 * Remaining Vinted-style language patterns in 52 active product descriptions:
 * 1. "viz foto" / "viz. foto" references (11 items) → remove or rephrase
 * 2. "Barva odpovídá poslední/detailní fotce" (4 items) → remove
 * 3. "Stav moc hezký" (3 items) → rephrase professionally
 * 4. "Sety vítány" / "Sleva při koupi více" (9+2 items) → remove (Vinted seller talk)
 * 5. "Baleno s péčí" (6 items) → remove
 * 6. "klidně napiš" / "V případě zájmu" / "ptejte se" (4+1 items) → remove
 * 7. ℹ emoji → replace with plain text or remove
 * 8. "odpovídá spíše" sizing → keep size info, remove personal tone
 * 9. "Původní cena: cca X Kč" → remove (compareAt handles this)
 * 10. "nevím" → rephrase uncertainty professionally
 * 11. "prodávám jako" → remove personal selling language
 * 12. "Materiál viz štítek" → "Materiál: viz štítek na výrobku"
 * 13. Brand "1803" → "Bez značky"
 * 14. "Kousek z řady" → keep brand info, remove Vinted style
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Regex replacements: pattern → replacement
// Order matters — more specific patterns first
const DESC_REPLACEMENTS: Array<[RegExp, string]> = [
  // Remove "Barva odpovídá ..." photo reference lines
  [/\n?\s*Barva odpovídá[^.\n]*\.?\s*/gi, ""],

  // Remove seller interaction phrases
  [/\n?\s*V případě zájmu klidně napiš\.?\s*/gi, ""],
  [/\n?\s*klidně (napiš|se ptejte|napište)\.?\s*/gi, ""],
  [/\s*–?\s*klidně napiš\.?\s*/gi, ""],
  [/\n?\s*prosím ověřte rozměry\.?\s*/gi, " – doporučujeme ověřit rozměry."],

  // Remove "Sety vítány" / "Sleva při koupi"
  [/\n?\s*Sety vítány\s*–?\s*/gi, ""],
  [/\n?\s*Sleva (při|za|až \d+\s*% při) (koupi?|nákupu) více\b.*$/gim, ""],

  // Remove "Baleno s péčí"
  [/\n?\s*Baleno s péčí\.?\s*/gi, ""],

  // Remove "Původní cena" lines (compareAt field handles this)
  [/\n?\s*Původní cena:?\s*(?:cca\s*)?\d[\d\s.,]*\s*(?:Kč|CZK|€|EUR|\$|USD).*$/gim, ""],

  // Clean "Stav moc hezký" → professional phrasing
  [/Stav moc hezký[.,]?\s*(nošen[éá] minimálně\.?)?/gi, "Ve velmi pěkném stavu."],

  // Replace "viz foto" with professional phrasing
  [/\(viz\.?\s*foto\)/gi, "(patrné na fotkách)"],
  [/viz\.?\s*foto/gi, "patrné na fotkách"],

  // Clean "nevím, zda" → professional uncertainty
  [/nevím,?\s*zda\s*/gi, "není jisté, zda "],

  // Clean "prodávám jako" → remove personal language
  [/prodávám (jako|ve stavu)/gi, "stav:"],

  // Clean "odpovídá spíše" sizing — keep info, remove personal tone
  [/ale odpovídá spíše (menší|větší)\s*–?\s*(řiď se prosím rozměry|doporučuji řídit se rozměry)\.?/gi,
    "ale reálně odpovídá spíše $1 — doporučujeme ověřit rozměry."],
  [/ale odpovídá spíše\s*([\w–]+)\s*–?\s*(řiďte se|řiď se|prosím ověřte) (prosím )?rozměry\.?/gi,
    "ale reálně odpovídá spíše $1 — doporučujeme ověřit rozměry."],
  [/reálně odpovídá spíš ([\w–\/]+)\s*–?\s*prosím ověřte rozměry\.?/gi,
    "reálně odpovídá spíše $1 — doporučujeme ověřit rozměry."],
  [/řiď se prosím rozměry/gi, "doporučujeme ověřit rozměry"],
  [/řiďte se rozměry/gi, "doporučujeme ověřit rozměry"],
  [/doporučuji řídit se rozměry\.?/gi, "doporučujeme ověřit rozměry."],

  // Replace ℹ emoji with proper text
  [/ℹ\s*(Stav & poznámka|Poznámka ke stavu|Poznámka|Materiál|Cedulka)/gi, "$1"],
  [/ℹ\s*/g, ""],

  // Clean "Materiál viz štítek"
  [/Materiál viz štítek\.?/gi, "Materiál: viz štítek na výrobku."],

  // Remove personal seller language
  [/nezkoušel[a]? jsem odstranit,?\s*/gi, ""],
  [/nelze zaručit,? že půjd[eou] vyčistit/gi, "nelze zaručit, zda půjde vyčistit"],

  // Remove "Kousek z řady DIVIDED" etc. — keep brand reference simpler
  [/Kousek z řady (\w+)\s*–\s*/gi, "Řada $1. "],

  // Clean "na fotkách" personal references
  [/na detailní fotce/gi, "na fotkách"],
  [/na poslední fotce/gi, "na fotkách"],
  [/na posledních fotkách/gi, "na fotkách"],

  // Clean trailing whitespace/newlines
  [/\n{3,}/g, "\n\n"],
  [/\s+$/g, ""],
];

// Brand fix
const BRAND_FIXES: Record<string, string> = {
  "cmnrb8qjr00ttijq0129xq19o": "Bez značky", // Brand "1803" is not a real brand
};

async function main() {
  console.log("=== Vinted Cleanup Pass 5 — Description Polish ===\n");

  let descFixed = 0;
  let brandFixed = 0;

  // 1. Fix descriptions
  const activeProducts = await prisma.product.findMany({
    where: { active: true },
    select: { id: true, name: true, description: true, brand: true },
  });

  console.log(`Checking ${activeProducts.length} active products...\n`);

  for (const product of activeProducts) {
    let newDesc = product.description;

    for (const [pattern, replacement] of DESC_REPLACEMENTS) {
      newDesc = newDesc.replace(pattern, replacement);
    }

    // Trim and clean
    newDesc = newDesc.trim();

    if (newDesc !== product.description) {
      await prisma.product.update({
        where: { id: product.id },
        data: { description: newDesc, updatedAt: new Date() },
      });
      console.log(`✓ DESC: ${product.name}`);
      descFixed++;
    }
  }

  // 2. Fix brand "1803"
  for (const [id, brand] of Object.entries(BRAND_FIXES)) {
    const product = await prisma.product.findUnique({
      where: { id },
      select: { name: true, brand: true },
    });
    if (product && product.brand !== brand) {
      await prisma.product.update({
        where: { id },
        data: { brand, updatedAt: new Date() },
      });
      console.log(`✓ BRAND: "${product.name}" — "${product.brand}" → "${brand}"`);
      brandFixed++;
    }
  }

  console.log(`\n=== Summary ===`);
  console.log(`Descriptions cleaned: ${descFixed}`);
  console.log(`Brands fixed: ${brandFixed}`);

  // 3. Verify — recount remaining patterns
  const remaining = await prisma.product.findMany({
    where: {
      active: true,
      OR: [
        { description: { contains: "viz foto" } },
        { description: { contains: "Barva odpovídá" } },
        { description: { contains: "Sety vítány" } },
        { description: { contains: "sety vítány" } },
        { description: { contains: "Sleva při koupi" } },
        { description: { contains: "Sleva za koupi" } },
        { description: { contains: "Baleno s péčí" } },
        { description: { contains: "klidně napiš" } },
        { description: { contains: "V případě zájmu" } },
        { description: { contains: "Původní cena" } },
        { description: { contains: "prodávám jako" } },
        { description: { contains: "ℹ" } },
        { description: { contains: "Stav moc hezký" } },
        { brand: { equals: "1803" } },
      ],
    },
    select: { id: true, name: true },
  });

  if (remaining.length > 0) {
    console.log(`\n⚠ ${remaining.length} items still have patterns:`);
    for (const p of remaining) {
      console.log(`  - ${p.name} (${p.id})`);
    }
  } else {
    console.log(`\n✅ All Vinted-style patterns cleaned!`);
  }

  // 4. Final stats
  const stats = await prisma.product.aggregate({
    _count: { id: true },
    where: { active: true },
  });
  const inactiveCount = await prisma.product.count({ where: { active: false } });
  const nullBrands = await prisma.product.count({
    where: { active: true, OR: [{ brand: null }, { brand: "" }] },
  });

  console.log(`\nFinal: ${stats._count.id} active, ${inactiveCount} inactive, ${nullBrands} NULL/empty brands`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
