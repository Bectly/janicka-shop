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
 * Map internal condition to Google Merchant Center condition values.
 * Accepted: new, refurbished, used
 */
const CONDITION_MAP: Record<string, string> = {
  new_with_tags: "new",
  excellent: "used",
  good: "used",
  visible_wear: "used",
};

/**
 * Map internal category slugs to Google Product Category IDs.
 * Taxonomy: https://support.google.com/merchants/answer/6324436
 */
const GOOGLE_CATEGORY_MAP: Record<string, string> = {
  saty: "2271",             // Apparel & Accessories > Clothing > Dresses
  "topy-halenky": "212",    // Apparel & Accessories > Clothing > Shirts & Tops
  "kalhoty-sukne": "204",   // Apparel & Accessories > Clothing > Pants
  "bundy-kabaty": "5598",   // Apparel & Accessories > Clothing > Outerwear > Coats & Jackets
  doplnky: "167",           // Apparel & Accessories
};

const FALLBACK_CATEGORY = "166"; // Apparel & Accessories > Clothing

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Google Merchant Center Product Feed — RSS 2.0 / Atom format
 *
 * Used for:
 * - Google Shopping free listings (organic)
 * - Google AI Overviews product citations
 * - ChatGPT Shopping recommendations (via structured data)
 *
 * Spec: https://support.google.com/merchants/answer/7052112
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

    // Cheapest shipping for the feed
    const cheapestShipping = Math.min(
      SHIPPING_PRICES.packeta_pickup,
      SHIPPING_PRICES.packeta_home,
      SHIPPING_PRICES.czech_post,
    );

    let xml = '<?xml version="1.0" encoding="utf-8"?>\n';
    xml += '<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">\n';
    xml += "<channel>\n";
    xml += `  <title>Janička — Second Hand Oblečení</title>\n`;
    xml += `  <link>${escapeXml(BASE_URL)}</link>\n`;
    xml += `  <description>Unikátní second hand oblečení pro moderní ženy. Ověřená kvalita, rychlé doručení.</description>\n`;

    for (const product of products) {
      const images = getImageUrls(product.images);
      const sizes = parseJsonStringArray(product.sizes);
      const colors = parseJsonStringArray(product.colors);
      const googleCategory =
        GOOGLE_CATEGORY_MAP[product.category.slug] ?? FALLBACK_CATEGORY;
      const condition = CONDITION_MAP[product.condition] ?? "used";
      const conditionLabel = CONDITION_LABELS[product.condition] ?? "";

      // Shipping: free above threshold, otherwise cheapest option
      const shippingPrice =
        product.price >= FREE_SHIPPING_THRESHOLD ? 0 : cheapestShipping;

      xml += "  <item>\n";

      // Required attributes
      xml += `    <g:id>${escapeXml(product.sku)}</g:id>\n`;
      xml += `    <g:title>${escapeXml(product.name)}</g:title>\n`;

      // Description — include condition label for richer context
      const desc = conditionLabel
        ? `${conditionLabel}. ${product.description}`
        : product.description;
      xml += `    <g:description><![CDATA[${desc.replace(/]]>/g, "]]]]><![CDATA[>")}]]></g:description>\n`;

      xml += `    <g:link>${escapeXml(`${BASE_URL}/products/${product.slug}`)}</g:link>\n`;

      // Images (primary + additional up to 10)
      if (images.length > 0) {
        xml += `    <g:image_link>${escapeXml(images[0])}</g:image_link>\n`;
        for (let i = 1; i < Math.min(images.length, 11); i++) {
          xml += `    <g:additional_image_link>${escapeXml(images[i])}</g:additional_image_link>\n`;
        }
      }

      // Price — when on sale, g:price must be the regular price (compareAt) and
      // g:sale_price the discounted price; Google uses this to show "was X, now Y"
      if (product.compareAt && product.compareAt > product.price) {
        xml += `    <g:price>${product.compareAt.toFixed(2)} CZK</g:price>\n`;
        xml += `    <g:sale_price>${product.price.toFixed(2)} CZK</g:sale_price>\n`;
      } else {
        xml += `    <g:price>${product.price.toFixed(2)} CZK</g:price>\n`;
      }

      xml += `    <g:availability>in_stock</g:availability>\n`;
      xml += `    <g:condition>${condition}</g:condition>\n`;

      // Brand
      if (product.brand) {
        xml += `    <g:brand>${escapeXml(product.brand)}</g:brand>\n`;
      }

      // Google product category
      xml += `    <g:google_product_category>${googleCategory}</g:google_product_category>\n`;
      xml += `    <g:product_type>${escapeXml(`Oblečení > ${product.category.name}`)}</g:product_type>\n`;

      // Apparel-specific attributes
      xml += `    <g:gender>female</g:gender>\n`;
      xml += `    <g:age_group>adult</g:age_group>\n`;

      if (colors.length > 0) {
        xml += `    <g:color>${escapeXml(colors.join("/"))}</g:color>\n`;
      }

      if (sizes.length > 0) {
        xml += `    <g:size>${escapeXml(sizes.join(", "))}</g:size>\n`;
      }

      // Shipping
      xml += "    <g:shipping>\n";
      xml += "      <g:country>CZ</g:country>\n";
      xml += `      <g:price>${shippingPrice.toFixed(2)} CZK</g:price>\n`;
      xml += "    </g:shipping>\n";

      // Video URL — enriches Google Shopping listing
      if (product.videoUrl && /^https?:\/\//.test(product.videoUrl)) {
        xml += `    <g:video_link>${escapeXml(product.videoUrl)}</g:video_link>\n`;
      }

      // Identifier exists (no GTIN for second-hand unique items)
      xml += `    <g:identifier_exists>false</g:identifier_exists>\n`;

      xml += "  </item>\n";
    }

    xml += "</channel>\n";
    xml += "</rss>";

    return new NextResponse(xml, {
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=1800",
      },
    });
  } catch (error) {
    console.error("[Google Merchant Feed] Failed to generate feed:", error);
    return new NextResponse(
      '<?xml version="1.0" encoding="utf-8"?>\n<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0"><channel></channel></rss>',
      {
        status: 500,
        headers: { "Content-Type": "application/xml; charset=utf-8" },
      },
    );
  }
}
