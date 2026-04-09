import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getImageUrls } from "@/lib/images";

export const revalidate = 3600; // Revalidate every hour
import {
  SHIPPING_PRICES,
  COD_SURCHARGE,
  CONDITION_LABELS,
} from "@/lib/constants";

const BASE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://janicka-shop.vercel.app";

/**
 * Map internal category slugs to Heureka.cz category tree paths.
 * See: https://sluzby.heureka.cz/napoveda/xml-feed/
 */
const HEUREKA_CATEGORIES: Record<string, string> = {
  saty: "Oblečení a móda | Dámské oblečení | Šaty",
  "topy-halenky":
    "Oblečení a móda | Dámské oblečení | Topy, trička a halenky",
  "kalhoty-sukne": "Oblečení a móda | Dámské oblečení | Kalhoty",
  "bundy-kabaty": "Oblečení a móda | Dámské oblečení | Bundy a kabáty",
  doplnky: "Oblečení a móda | Módní doplňky",
};

const FALLBACK_CATEGORY = "Oblečení a móda | Dámské oblečení";

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export async function GET() {
  try {
    const db = await getDb();
    const products = await db.product.findMany({
      where: { active: true, sold: false },
      include: { category: { select: { slug: true, name: true } } },
      orderBy: { createdAt: "desc" },
      take: 10000,
    });

    let xml = '<?xml version="1.0" encoding="utf-8"?>\n<SHOP>\n';

    for (const product of products) {
      const images: string[] = getImageUrls(product.images);
      const sizes: string[] = safeJsonParse(product.sizes);
      const categoryPath =
        HEUREKA_CATEGORIES[product.category.slug] ?? FALLBACK_CATEGORY;

      xml += "  <SHOPITEM>\n";
      xml += `    <ITEM_ID>${escapeXml(product.sku)}</ITEM_ID>\n`;
      xml += `    <PRODUCTNAME>${escapeXml(product.name)}</PRODUCTNAME>\n`;
      xml += `    <DESCRIPTION><![CDATA[${product.description.replace(/]]>/g, "]]]]><![CDATA[>")}]]></DESCRIPTION>\n`;
      xml += `    <URL>${escapeXml(`${BASE_URL}/products/${product.slug}`)}</URL>\n`;

      // Images
      if (images.length > 0) {
        xml += `    <IMGURL>${escapeXml(images[0])}</IMGURL>\n`;
        for (let i = 1; i < images.length; i++) {
          xml += `    <IMGURL_ALTERNATIVE>${escapeXml(images[i])}</IMGURL_ALTERNATIVE>\n`;
        }
      }

      xml += `    <PRICE_VAT>${product.price}</PRICE_VAT>\n`;

      if (product.brand) {
        xml += `    <MANUFACTURER>${escapeXml(product.brand)}</MANUFACTURER>\n`;
      }

      xml += `    <CATEGORYTEXT>${escapeXml(categoryPath)}</CATEGORYTEXT>\n`;
      xml += `    <PRODUCTNO>${escapeXml(product.sku)}</PRODUCTNO>\n`;
      xml += `    <DELIVERY_DATE>5</DELIVERY_DATE>\n`;
      xml += `    <ITEM_TYPE>bazaar</ITEM_TYPE>\n`;

      // Condition parameter
      xml += "    <PARAM>\n";
      xml += "      <PARAM_NAME>Stav</PARAM_NAME>\n";
      xml += `      <VAL>${escapeXml(CONDITION_LABELS[product.condition] ?? product.condition)}</VAL>\n`;
      xml += "    </PARAM>\n";

      // Size parameters
      for (const size of sizes) {
        xml += "    <PARAM>\n";
        xml += "      <PARAM_NAME>Velikost</PARAM_NAME>\n";
        xml += `      <VAL>${escapeXml(size)}</VAL>\n`;
        xml += "    </PARAM>\n";
      }

      // Color parameters — improves Heureka search/filter visibility
      const colors: string[] = safeJsonParse(product.colors);
      for (const color of colors) {
        xml += "    <PARAM>\n";
        xml += "      <PARAM_NAME>Barva</PARAM_NAME>\n";
        xml += `      <VAL>${escapeXml(color)}</VAL>\n`;
        xml += "    </PARAM>\n";
      }

      // Delivery options — Zásilkovna pickup
      xml += "    <DELIVERY>\n";
      xml += "      <DELIVERY_ID>ZASILKOVNA</DELIVERY_ID>\n";
      xml += `      <DELIVERY_PRICE>${SHIPPING_PRICES.packeta_pickup}</DELIVERY_PRICE>\n`;
      xml += `      <DELIVERY_PRICE_COD>${SHIPPING_PRICES.packeta_pickup + COD_SURCHARGE}</DELIVERY_PRICE_COD>\n`;
      xml += "    </DELIVERY>\n";

      // Zásilkovna home delivery
      xml += "    <DELIVERY>\n";
      xml += "      <DELIVERY_ID>ZASILKOVNA_HD</DELIVERY_ID>\n";
      xml += `      <DELIVERY_PRICE>${SHIPPING_PRICES.packeta_home}</DELIVERY_PRICE>\n`;
      xml += `      <DELIVERY_PRICE_COD>${SHIPPING_PRICES.packeta_home + COD_SURCHARGE}</DELIVERY_PRICE_COD>\n`;
      xml += "    </DELIVERY>\n";

      // Česká pošta
      xml += "    <DELIVERY>\n";
      xml += "      <DELIVERY_ID>CESKA_POSTA</DELIVERY_ID>\n";
      xml += `      <DELIVERY_PRICE>${SHIPPING_PRICES.czech_post}</DELIVERY_PRICE>\n`;
      xml += `      <DELIVERY_PRICE_COD>${SHIPPING_PRICES.czech_post + COD_SURCHARGE}</DELIVERY_PRICE_COD>\n`;
      xml += "    </DELIVERY>\n";

      xml += "  </SHOPITEM>\n";
    }

    xml += "</SHOP>";

    return new NextResponse(xml, {
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=1800",
      },
    });
  } catch (error) {
    console.error("[Heureka Feed] Failed to generate feed:", error);
    return new NextResponse(
      '<?xml version="1.0" encoding="utf-8"?>\n<SHOP></SHOP>',
      {
        status: 500,
        headers: { "Content-Type": "application/xml; charset=utf-8" },
      },
    );
  }
}

function safeJsonParse(value: string): string[] {
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === "string");
  } catch {
    return [];
  }
}
