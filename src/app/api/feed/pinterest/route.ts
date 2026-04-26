import { NextRequest, NextResponse, connection } from "next/server";
import { getDb } from "@/lib/db";
import { getImageUrls, parseJsonStringArray } from "@/lib/images";
import { validateFeedToken } from "@/lib/feed-auth";
import {
  SHIPPING_PRICES,
  FREE_SHIPPING_THRESHOLD,
  CONDITION_LABELS,
} from "@/lib/constants";

import { logger } from "@/lib/logger";
import { getSiteUrl } from "@/lib/site-url";

const BASE_URL = getSiteUrl();

/**
 * Map internal condition to Pinterest condition values.
 * Pinterest accepts: new, used, refurbished
 */
const CONDITION_MAP: Record<string, string> = {
  new_with_tags: "new",
  new_without_tags: "new",
  excellent: "used",
  good: "used",
  visible_wear: "used",
};

/**
 * Map internal category slugs to Google Product Category IDs.
 * Pinterest uses Google's taxonomy: https://support.google.com/merchants/answer/6324436
 * Women's Clothing category tree IDs.
 */
const GOOGLE_CATEGORY_MAP: Record<string, string> = {
  saty: "2271",          // Apparel & Accessories > Clothing > Dresses
  "topy-halenky": "212", // Apparel & Accessories > Clothing > Shirts & Tops
  "kalhoty-sukne": "204", // Apparel & Accessories > Clothing > Pants
  "bundy-kabaty": "5598", // Apparel & Accessories > Clothing > Outerwear > Coats & Jackets
  boty: "187",           // Apparel & Accessories > Shoes
  doplnky: "167",        // Apparel & Accessories
};

const FALLBACK_CATEGORY = "166"; // Apparel & Accessories > Clothing

/** Pinterest Catalog Feed columns (TSV format) */
const COLUMNS = [
  "id",
  "title",
  "description",
  "link",
  "image_link",
  "additional_image_link",
  "price",
  "sale_price",
  "availability",
  "condition",
  "brand",
  "google_product_category",
  "product_type",
  "gender",
  "age_group",
  "color",
  "size",
  "material",
  "item_group_id",
  "shipping",
] as const;

export const PINTEREST_FEED_COLUMNS = COLUMNS;

/**
 * Detect primary material from Czech product description.
 * Returns first matching material string in canonical form, or "" if none found.
 * Pinterest accepts free-text; used for filtering and richer Rich Pins.
 */
const MATERIAL_PATTERNS: Array<[RegExp, string]> = [
  [/\bbavln[aěy]\b/i, "bavlna"],
  [/\bpolyester\w*/i, "polyester"],
  [/\bvisk[oó]z\w*/i, "viskóza"],
  [/\bvln[aěy]\b|\bmerino\b/i, "vlna"],
  [/\bhedv[aá]b\w*/i, "hedvábí"],
  [/\bl[eě]n\w*/i, "len"],
  [/\bka[šs]m[ií]r\w*/i, "kašmír"],
  [/\bk[oů]že\b|\bk[oů]žen\w*/i, "kůže"],
  [/\bakryl\w*/i, "akryl"],
  [/\belasta[nm]\w*/i, "elastan"],
  [/\bden(im|y)\b/i, "denim"],
  [/\btw[ie]ed\b/i, "tvíd"],
];

export function detectMaterial(text: string | null | undefined): string {
  if (!text) return "";
  for (const [re, label] of MATERIAL_PATTERNS) {
    if (re.test(text)) return label;
  }
  return "";
}

function escapeTsv(value: string): string {
  // TSV fields: escape tabs, newlines, and wrap in quotes if needed
  const cleaned = value.replace(/[\t\r\n]/g, " ").trim();
  return cleaned;
}

/**
 * Pinterest Catalog Feed — TSV format
 *
 * Pinterest Shopping Catalog accepts TSV with specific column headers.
 * Feed is used for:
 * - Pinterest Shopping Pins (organic)
 * - Rich Pins (automatic from product data)
 * - Pinterest Ads product catalog
 *
 * Docs: https://help.pinterest.com/en/business/article/data-source-ingestion
 */
export async function GET(req: NextRequest) {
  await connection();
  const tokenError = validateFeedToken(req);
  if (tokenError) return tokenError;

  try {
    const db = await getDb();
    const products = await db.product.findMany({
      where: { active: true, sold: false },
      include: { category: { select: { slug: true, name: true } } },
      orderBy: { createdAt: "desc" },
      take: 10000,
    });

    // Header row
    const rows: string[] = [COLUMNS.join("\t")];

    // Cheapest shipping for Pinterest shipping field: "CZ:::69 CZK"
    const cheapestShipping = Math.min(
      SHIPPING_PRICES.packeta_pickup,
      SHIPPING_PRICES.packeta_home,
      SHIPPING_PRICES.czech_post,
    );

    for (const product of products) {
      const images = getImageUrls(product.images);
      const sizes = parseJsonStringArray(product.sizes);
      const colors = parseJsonStringArray(product.colors);

      const googleCategory =
        GOOGLE_CATEGORY_MAP[product.category.slug] ?? FALLBACK_CATEGORY;

      // Pinterest price format requires decimal notation: "450.00 CZK".
      // When compareAt > price the original is "price" and current is "sale_price"
      // (Pinterest convention for sale signal in Rich Pins).
      const hasSale =
        typeof product.compareAt === "number" &&
        product.compareAt > product.price;
      const priceStr = `${(hasSale ? product.compareAt! : product.price).toFixed(2)} CZK`;
      const salePriceStr = hasSale ? `${product.price.toFixed(2)} CZK` : "";

      // Shipping: free above threshold, otherwise cheapest option
      const shippingStr =
        product.price >= FREE_SHIPPING_THRESHOLD
          ? "CZ:::0 CZK"
          : `CZ:::${cheapestShipping} CZK`;

      // Additional images (up to 10, pipe-separated)
      const additionalImages = images.slice(1, 11).join(",");

      // Condition description for richer product info
      const conditionLabel = CONDITION_LABELS[product.condition] ?? "";
      const descriptionWithCondition = conditionLabel
        ? `${conditionLabel}. ${product.description}`
        : product.description;

      const material = detectMaterial(product.description);

      const row = [
        escapeTsv(product.sku),                                    // id
        escapeTsv(product.name),                                   // title
        escapeTsv(descriptionWithCondition.slice(0, 10000)),       // description
        `${BASE_URL}/products/${product.slug}`,                    // link
        images[0] ?? "",                                           // image_link
        additionalImages,                                          // additional_image_link
        priceStr,                                                  // price
        salePriceStr,                                              // sale_price
        "in stock",                                                // availability
        CONDITION_MAP[product.condition] ?? "used",                // condition
        escapeTsv(product.brand ?? ""),                            // brand
        googleCategory,                                            // google_product_category
        escapeTsv(`Oblečení > ${product.category.name}`),          // product_type
        "female",                                                  // gender
        "adult",                                                   // age_group
        escapeTsv(colors.join(", ")),                              // color
        escapeTsv(sizes.join(", ")),                               // size
        escapeTsv(material),                                       // material
        escapeTsv(product.sku),                                    // item_group_id (unique item = own group)
        shippingStr,                                               // shipping
      ];

      rows.push(row.join("\t"));
    }

    const tsv = rows.join("\n");

    return new NextResponse(tsv, {
      headers: {
        "Content-Type": "text/tab-separated-values; charset=utf-8",
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=1800",
      },
    });
  } catch (error) {
    logger.error("[Pinterest Feed] Failed to generate feed:", error);
    return new NextResponse("", {
      status: 500,
      headers: { "Content-Type": "text/tab-separated-values; charset=utf-8" },
    });
  }
}
