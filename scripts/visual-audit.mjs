/**
 * Janička Shop — Visual Audit Screenshot Script
 * Usage: node scripts/visual-audit.mjs [base-url] [output-dir]
 * Defaults: base-url=https://jvsatnik.cz, output-dir=docs/audits/visual-audit-YYYY-MM-DD/screenshots
 *
 * Captures desktop (1440×900) and mobile (375×812) screenshots for all public pages.
 * Viewport max 1800px tall to stay within Anthropic vision API 2000px limit.
 */

import { chromium } from "playwright";
import { mkdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");

const baseUrl = process.argv[2] || "https://jvsatnik.cz";
const today = new Date().toISOString().slice(0, 10);
const outputDir =
  process.argv[3] ||
  resolve(projectRoot, `docs/audits/visual-audit-${today}/screenshots`);

mkdirSync(outputDir, { recursive: true });

/** Pages to audit. slug is used to derive filename. */
const PAGES = [
  { path: "/", slug: "homepage" },
  { path: "/products", slug: "products-listing" },
  // Supply a real in-stock slug at runtime via PRODUCT_SLUG env var, or fallback
  {
    path: `/products/${process.env.PRODUCT_SLUG || "na-kd-dlouhe-ruzove-saty-maxi-pruzne-elegantni"}`,
    slug: "product-detail",
  },
  { path: "/collections", slug: "collections-listing" },
  { path: "/collections/_placeholder", slug: "collection-detail" },
  { path: "/search?q=triko", slug: "search" },
  { path: "/cart", slug: "cart-empty" },
  { path: "/login", slug: "login" },
  { path: "/about", slug: "o-nas" },
  { path: "/privacy", slug: "ochrana-soukromi" },
  { path: "/rozmery", slug: "rozmery" },
  { path: "/neexistuje", slug: "404" },
];

const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "mobile", width: 375, height: 812 },
];

async function captureAll() {
  const browser = await chromium.launch();
  const results = [];

  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    const page = await ctx.newPage();

    for (const pg of PAGES) {
      const url = `${baseUrl}${pg.path}`;
      const filename = `${pg.slug}-${vp.name}.png`;
      const filepath = resolve(outputDir, filename);

      try {
        await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20000 });
        await page.waitForTimeout(1500);
        await page.screenshot({ path: filepath });
        console.log(`✓ ${filename}`);
        results.push({ slug: pg.slug, viewport: vp.name, path: filepath, ok: true });
      } catch (err) {
        console.error(`✗ ${filename}: ${err.message}`);
        results.push({ slug: pg.slug, viewport: vp.name, path: filepath, ok: false, error: err.message });
      }
    }

    await ctx.close();
  }

  await browser.close();

  const ok = results.filter((r) => r.ok).length;
  const fail = results.filter((r) => !r.ok).length;
  console.log(`\nDone: ${ok} captured, ${fail} failed`);
  console.log(`Output: ${outputDir}`);
}

captureAll().catch((e) => {
  console.error(e);
  process.exit(1);
});
