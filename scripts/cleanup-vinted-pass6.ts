/**
 * Vinted Cleanup Pass 6 — Remove remaining seller discount/bundle text
 *
 * Patterns still in DB:
 * - "Možnost slevy při nákupu více kusů" (26 products, 5 variations)
 * - "Slevy při koupi/nákupu více věcí / sety" (up to 22)
 * - Trailing whitespace / blank lines left by previous passes
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Line-level patterns to remove entirely
const REMOVE_LINE_PATTERNS: RegExp[] = [
  // "Možnost slevy při nákupu více kusů" — all variations
  /^\s*Možnost slevy při nákupu více kusů[^\n]*$/gm,
  // "Možnost množstevní slevy při koupi více"
  /^\s*Možnost množstevní slevy při koupi více[^\n]*$/gm,
  // "Slevy při koupi/nákupu více věcí / sety"
  /^\s*Slevy při (?:koupi|nákupu) více (?:kusů|věcí|kousků)[^\n]*$/gm,
  // Any remaining line with "slevy při" + "více" (catch-all)
  /^[^\n]*slev\w*\s+při\s+(?:koupi|nákupu)\s+více[^\n]*$/gim,
  // Any remaining line with "více kusů" + discount context
  /^[^\n]*více\s+(?:kusů|věcí|kousků)[^\n]*(?:slev|%)[^\n]*$/gim,
  // Standalone "Podívej se i na další věci u mě"
  /^\s*Podívej se i na (?:další věci u mě|moje další položky)[^\n]*$/gm,
  // "více" standalone promotional line
  /^\s*\.\.\.\s*více\s*$/gm,
];

function cleanDescription(desc: string): string {
  let cleaned = desc;

  for (const pattern of REMOVE_LINE_PATTERNS) {
    // Reset lastIndex for global regex
    pattern.lastIndex = 0;
    cleaned = cleaned.replace(pattern, "");
  }

  // Collapse 3+ newlines to 2
  cleaned = cleaned.replace(/\n{3,}/g, "\n\n");

  // Remove trailing whitespace on each line
  cleaned = cleaned.replace(/[ \t]+$/gm, "");

  // Trim start/end
  cleaned = cleaned.trim();

  return cleaned;
}

async function main() {
  console.log("=== Vinted Cleanup Pass 6 — Discount/Bundle Text ===\n");

  const products = await prisma.product.findMany({
    where: { active: true },
    select: { id: true, name: true, description: true },
  });

  console.log(`Checking ${products.length} active products...\n`);

  let updated = 0;

  for (const product of products) {
    const cleaned = cleanDescription(product.description);

    if (cleaned !== product.description) {
      await prisma.product.update({
        where: { id: product.id },
        data: { description: cleaned },
      });
      console.log(`  Fixed: ${product.name}`);
      updated++;
    }
  }

  console.log(`\nDescriptions cleaned: ${updated}`);

  // Verify
  const remaining = await prisma.product.count({
    where: {
      active: true,
      OR: [
        { description: { contains: "Možnost slevy" } },
        { description: { contains: "Slevy při" } },
        { description: { contains: "více kusů" } },
        { description: { contains: "více věcí" } },
        { description: { contains: "Podívej se" } },
      ],
    },
  });

  console.log(`Remaining Vinted patterns: ${remaining}`);
  if (remaining === 0) {
    console.log("\nAll Vinted seller text cleaned!");
  } else {
    // Show what's left
    const leftovers = await prisma.product.findMany({
      where: {
        active: true,
        OR: [
          { description: { contains: "Možnost slevy" } },
          { description: { contains: "Slevy při" } },
          { description: { contains: "více kusů" } },
          { description: { contains: "více věcí" } },
          { description: { contains: "Podívej se" } },
        ],
      },
      select: { id: true, name: true, description: true },
    });

    console.log(`\nRemaining items:`);
    for (const p of leftovers) {
      const snippet = p.description.slice(
        Math.max(0, p.description.search(/Možnost|Slevy|více|Podívej/) - 10),
        p.description.search(/Možnost|Slevy|více|Podívej/) + 60
      );
      console.log(`  ${p.name}: "...${snippet}..."`);
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
