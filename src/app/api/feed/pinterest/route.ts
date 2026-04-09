import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getImageUrls, parseJsonStringArray } from "@/lib/images";
import {
  SHIPPING_PRICES,
  FREE_SHIPPING_THRESHOLD,
  CONDITION_LABELS,
} from "@/lib/constants";

export const revalidate = 300;

const BASE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://janicka-shop.vercel.app";

/**
 * Map internal condition to Pinterest condition values.
 * Pinterest accepts: new, used, refurbished
 */
const CONDITION_MAP: Record<string, string> = {
  new_with_tags: "new",
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
  "availability",
  "condition",
  "brand",
  "google_product_category",
  "product_type",
  "gender",
  "age_group",
  "color",
  "size",
  "item_group_id",
  "shipping",
] as const;

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
export async function GET() {
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

      // Pinterest price format requires decimal notation: "450.00 CZK"
      const priceStr = `${product.price.toFixed(2)} CZK`;

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

      const row = [
        escapeTsv(product.sku),                                    // id
        escapeTsv(product.name),                                   // title
        escapeTsv(descriptionWithCondition.slice(0, 10000)),       // description
        `${BASE_URL}/products/${product.slug}`,                    // link
        images[0] ?? "",                                           // image_link
        additionalImages,                                          // additional_image_link
        priceStr,                                                  // price
        "in stock",                                                // availability
        CONDITION_MAP[product.condition] ?? "used",                // condition
        escapeTsv(product.brand ?? ""),                            // brand
        googleCategory,                                            // google_product_category
        escapeTsv(`Oblečení > ${product.category.name}`),          // product_type
        "female",                                                  // gender
        "adult",                                                   // age_group
        escapeTsv(colors.join(", ")),                              // color
        escapeTsv(sizes.join(", ")),                               // size
        "",                                                        // item_group_id (no variants for unique items)
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
    console.error("[Pinterest Feed] Failed to generate feed:", error);
    return new NextResponse("", {
      status: 500,
      headers: { "Content-Type": "text/tab-separated-values; charset=utf-8" },
    });
  }
}
