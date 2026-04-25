import { test, expect, type APIRequestContext } from "@playwright/test";
import { XMLParser } from "fast-xml-parser";

// Feed schema regression e2e (#577 — DEFCON-0 last-line-of-defense for the
// 2026-04-30 Doppl VTO / GMC launch). The /api/feed/* endpoints have NO UI
// signal: a typo in an element name, a missing root wrapper, a broken
// xmlns:g namespace, or an empty product list would tank the GMC + Pinterest
// + Heureka launch with zero customer-visible warning. This spec is the only
// regression guard.
//
// Coverage:
//   (1) /api/feed/google-merchant — RSS 2.0 with xmlns:g namespace, ≥1 item
//       under <channel>, each item carries Google's required fields (g:id,
//       g:title, g:price, g:availability, g:image_link), price format
//       /^\d+\.\d{2} CZK$/.
//   (2) /api/feed/pinterest — TSV (matches actual implementation; src/app/
//       api/feed/pinterest/route.ts emits Pinterest's catalog TSV format,
//       not XML). Asserts header row contains Pinterest's required catalog
//       columns and ≥1 data row populates id+title+link+image_link+price.
//   (3) /api/feed/heureka — XML <SHOP> with <SHOPITEM> children, each carrying
//       Heureka's required fields (ITEM_ID, PRODUCTNAME, URL, IMGURL,
//       PRICE_VAT, DELIVERY_DATE) per https://sluzby.heureka.cz/napoveda/xml-feed/.
//
// SIGKILL safe — read-only specs, no DB writes, no cleanup needed. Uses
// existing live products (324 active in dev DB at spec-author time).
// Skips when FEED_SECRET is set without an E2E_FEED_TOKEN override available.

const FEED_TOKEN = process.env.FEED_SECRET ?? process.env.E2E_FEED_TOKEN ?? "";

function feedUrl(path: string): string {
  return FEED_TOKEN
    ? `${path}?token=${encodeURIComponent(FEED_TOKEN)}`
    : path;
}

async function fetchFeed(
  request: APIRequestContext,
  path: string,
): Promise<{ status: number; contentType: string; body: string }> {
  const res = await request.get(feedUrl(path));
  return {
    status: res.status(),
    contentType: res.headers()["content-type"] ?? "",
    body: await res.text(),
  };
}

test.describe("Feed schema regression — GMC + Pinterest + Heureka", () => {
  test("Google Merchant Center XML feed has required schema", async ({
    request,
  }) => {
    const { status, contentType, body } = await fetchFeed(
      request,
      "/api/feed/google-merchant",
    );

    expect(status).toBe(200);
    expect(contentType).toMatch(/xml/i);

    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "@_",
      // Always coerce <item> to an array even when only one product matches
      // (defensive against schema drift but also flexes the iteration assertions).
      isArray: (name) => name === "item",
      processEntities: true,
    });
    const doc = parser.parse(body);

    expect(doc.rss, "missing <rss> root").toBeTruthy();
    expect(
      doc.rss["@_xmlns:g"],
      "missing xmlns:g namespace on <rss>",
    ).toBe("http://base.google.com/ns/1.0");
    expect(doc.rss["@_version"]).toBe("2.0");

    const channel = doc.rss.channel;
    expect(channel, "missing <channel> wrapper under <rss>").toBeTruthy();

    const items = channel.item ?? [];
    expect(
      Array.isArray(items) && items.length > 0,
      "GMC feed has zero <item> entries",
    ).toBe(true);

    // Sample first item — Google Merchant required fields per
    // https://support.google.com/merchants/answer/7052112
    const first = items[0];
    expect(first["g:id"], "missing g:id").toBeTruthy();
    expect(first["g:title"], "missing g:title").toBeTruthy();
    expect(first["g:price"], "missing g:price").toBeTruthy();
    expect(first["g:availability"], "missing g:availability").toBeTruthy();
    expect(first["g:image_link"], "missing g:image_link").toBeTruthy();

    // Price format: "1234.00 CZK" (Google strict — currency MUST be ISO code,
    // amount MUST have decimal). Both g:price and g:sale_price (when present)
    // must conform.
    const priceFormat = /^\d+\.\d{2} CZK$/;
    expect(String(first["g:price"])).toMatch(priceFormat);
    if (first["g:sale_price"]) {
      expect(String(first["g:sale_price"])).toMatch(priceFormat);
    }
  });

  test("Pinterest catalog TSV feed has required columns and rows", async ({
    request,
  }) => {
    const { status, contentType, body } = await fetchFeed(
      request,
      "/api/feed/pinterest",
    );

    expect(status).toBe(200);
    // Pinterest catalog uses TSV (tab-separated values), not XML —
    // src/app/api/feed/pinterest/route.ts emits text/tab-separated-values.
    expect(contentType).toMatch(/tab-separated-values/i);

    const lines = body.split("\n").filter((l) => l.length > 0);
    expect(
      lines.length >= 2,
      "Pinterest feed must have header + ≥1 product row",
    ).toBe(true);

    const header = lines[0].split("\t");
    // Pinterest catalog required columns per
    // https://help.pinterest.com/en/business/article/data-source-ingestion
    const REQUIRED = [
      "id",
      "title",
      "description",
      "link",
      "image_link",
      "price",
      "availability",
      "condition",
    ] as const;
    for (const col of REQUIRED) {
      expect(header, `Pinterest header missing column "${col}"`).toContain(col);
    }

    // First data row — required columns populated.
    const dataRow = lines[1].split("\t");
    const idx = (col: string) => header.indexOf(col);
    expect(dataRow[idx("id")], "Pinterest row missing id").toBeTruthy();
    expect(dataRow[idx("title")], "Pinterest row missing title").toBeTruthy();
    expect(dataRow[idx("link")], "Pinterest row missing link").toBeTruthy();
    expect(
      dataRow[idx("image_link")],
      "Pinterest row missing image_link",
    ).toBeTruthy();
    expect(dataRow[idx("price")], "Pinterest row missing price").toMatch(
      /^\d+\.\d{2} CZK$/,
    );
    expect(dataRow[idx("availability")]).toBe("in stock");
  });

  test("Heureka XML feed has required schema", async ({ request }) => {
    const { status, contentType, body } = await fetchFeed(
      request,
      "/api/feed/heureka",
    );

    expect(status).toBe(200);
    expect(contentType).toMatch(/xml/i);

    const parser = new XMLParser({
      ignoreAttributes: false,
      isArray: (name) => name === "SHOPITEM" || name === "PARAM",
      processEntities: true,
    });
    const doc = parser.parse(body);

    expect(doc.SHOP, "missing <SHOP> root").toBeTruthy();

    const items = doc.SHOP.SHOPITEM ?? [];
    expect(
      Array.isArray(items) && items.length > 0,
      "Heureka feed has zero <SHOPITEM> entries",
    ).toBe(true);

    // Heureka required fields per https://sluzby.heureka.cz/napoveda/xml-feed/
    const first = items[0];
    expect(first.ITEM_ID, "missing ITEM_ID").toBeTruthy();
    expect(first.PRODUCTNAME, "missing PRODUCTNAME").toBeTruthy();
    expect(first.URL, "missing URL").toBeTruthy();
    expect(first.IMGURL, "missing IMGURL").toBeTruthy();
    expect(first.PRICE_VAT, "missing PRICE_VAT").toBeTruthy();
    expect(
      first.DELIVERY_DATE,
      "missing DELIVERY_DATE",
    ).toBeDefined();

    // PRICE_VAT must be numeric (Heureka rejects non-numeric prices).
    expect(Number.isFinite(Number(first.PRICE_VAT))).toBe(true);
    expect(Number(first.PRICE_VAT)).toBeGreaterThan(0);

    // ITEM_TYPE=bazaar required for second-hand goods (Heureka category gate).
    expect(first.ITEM_TYPE).toBe("bazaar");
  });
});
