/**
 * Second pass cleanup — remaining Vinted text & hashtags
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const EMOJI_PATTERN = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F000}-\u{1FFFF}\u{200D}\u{20E3}\u{E0020}-\u{E007F}]+/gu;

function deepClean(desc: string): string {
  let cleaned = desc;

  // Remove hashtag blocks (typically at the end) — everything from first # onwards
  // Hashtags like #vintedcz #sale #outfit etc.
  cleaned = cleaned.replace(/\n\s*#[a-zA-Zá-žÁ-Ž0-9_]+(\s+#[a-zA-Zá-žÁ-Ž0-9_]+)*\.?\s*$/g, "");

  // Remove "Mrkni" lines with all variations
  cleaned = cleaned.replace(/^.*[Mm]rkni.*profil.*$/gm, "");
  cleaned = cleaned.replace(/^.*[Mm]rkni.*věci.*$/gm, "");
  cleaned = cleaned.replace(/^.*[Mm]rkni.*kousky.*$/gm, "");

  // Remove "podívej se na" profile references
  cleaned = cleaned.replace(/^.*[Pp]odívej\s+se\s+na\s+m[ůu]j\s+profil.*$/gm, "");
  cleaned = cleaned.replace(/^.*[Pp]odívej\s+se\s+na\s+další.*profil.*$/gm, "");

  // Remove "%/sleva" lines (Vinted bundle discounts)
  cleaned = cleaned.replace(/^.*\d+\s*%.*při\s+nákupu.*profil.*$/gim, "");
  cleaned = cleaned.replace(/^.*\d+\s*%.*slev.*více\s+kus.*$/gim, "");
  cleaned = cleaned.replace(/^.*slev.*více\s+kus.*profil.*$/gim, "");
  cleaned = cleaned.replace(/^.*slev.*nákup.*profil.*$/gim, "");

  // Remove "z mého profilu" type references
  cleaned = cleaned.replace(/^.*z\s+mého\s+profilu.*$/gm, "");
  cleaned = cleaned.replace(/^.*v\s+mém\s+profilu.*$/gm, "");
  cleaned = cleaned.replace(/^.*na\s+mém\s+profilu.*$/gm, "");
  cleaned = cleaned.replace(/^.*u\s+mě\s+na\s+profilu.*$/gm, "");
  cleaned = cleaned.replace(/^.*mám\s+víc\s+věcí.*$/gm, "");
  cleaned = cleaned.replace(/^.*mám\s+tu\s+hodně.*$/gm, "");
  cleaned = cleaned.replace(/^.*mám\s+spoustu.*$/gm, "");

  // Remove Vinted-specific references
  cleaned = cleaned.replace(/^.*vintedcz.*$/gim, "");
  cleaned = cleaned.replace(/^.*Vinted.*$/gm, "");
  cleaned = cleaned.replace(/^.*#vinted\b.*$/gim, "");

  // Remove shipping method mentions
  cleaned = cleaned.replace(/^.*[Oo]deslání\s+do\s+\d.*$/gm, "");
  cleaned = cleaned.replace(/^.*[Oo]desl[áa]n[íi]\s+z.*$/gm, "");
  cleaned = cleaned.replace(/^.*[Rr]ychlé\s+odeslání.*$/gm, "");
  cleaned = cleaned.replace(/^.*[Pp]osílám\s+přes.*$/gm, "");
  cleaned = cleaned.replace(/^.*Zásilkovn.*$/gm, "");

  // Remove "Sleva na sety" lines
  cleaned = cleaned.replace(/^.*[Ss]leva\s+na\s+set.*$/gm, "");

  // Remove remaining emojis
  cleaned = cleaned.replace(EMOJI_PATTERN, "");

  // Remove "Značka:" lines (redundant)
  cleaned = cleaned.replace(/^.*[Zz]načka:?\s+\S+.*$/gm, "");

  // Clean up punctuation artifacts
  cleaned = cleaned.replace(/^\s*[•·–—]\s*$/gm, ""); // lone bullet points
  cleaned = cleaned.replace(/^\s*[-–]\s*$/gm, ""); // lone dashes

  // Collapse multiple newlines
  cleaned = cleaned.replace(/\n{3,}/g, "\n\n");

  // Remove lone surrogates
  cleaned = cleaned.replace(/[\uD800-\uDFFF]/g, "");

  // Trim
  cleaned = cleaned.trim();

  return cleaned;
}

async function main() {
  console.log("=== Vinted Cleanup Pass 2 ===\n");

  const products = await prisma.product.findMany({
    select: { id: true, description: true },
  });

  let updated = 0;
  let hashtagsRemoved = 0;

  for (const product of products) {
    const cleaned = deepClean(product.description);
    if (cleaned !== product.description) {
      await prisma.product.update({
        where: { id: product.id },
        data: { description: cleaned },
      });
      updated++;

      // Track hashtag removal specifically
      if (product.description.includes("#") && !cleaned.includes("#")) {
        hashtagsRemoved++;
      }
    }
  }

  console.log(`Descriptions updated: ${updated}`);
  console.log(`Hashtags removed: ${hashtagsRemoved}`);

  // Verify remaining issues
  const remaining = await prisma.product.count({
    where: {
      active: true,
      OR: [
        { description: { contains: "profil" } },
        { description: { contains: "Mrkni" } },
        { description: { contains: "#vinted" } },
        { description: { contains: "Zásilkovn" } },
      ],
    },
  });

  console.log(`\nRemaining Vinted references: ${remaining}`);
  console.log("\n Pass 2 complete!");
}

main()
  .catch((e) => {
    console.error("Error:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
