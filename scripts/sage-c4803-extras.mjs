import { chromium } from 'playwright';
const BASE = 'https://janicka-shop.vercel.app';
const OUT = '/home/bectly/development/projects/janicka-shop/docs/visual-audits/c4803-screenshots';
const browser = await chromium.launch({ headless: true });

async function newCtx(viewport) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2, locale: 'cs-CZ' });
  await ctx.addInitScript(() => {
    try {
      localStorage.setItem('janicka-cookie-consent', JSON.stringify({
        essential: true, analytics: true, marketing: true, timestamp: new Date().toISOString(),
      }));
    } catch {}
  });
  return ctx;
}

// Mobile products grid — scroll past header so we see only cards w/ badges
const ctx = await newCtx({ width: 375, height: 667 });
const page = await ctx.newPage();
await page.goto(`${BASE}/products`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);
// Scroll so we see the actual product grid
await page.evaluate(() => window.scrollTo(0, 600));
await page.waitForTimeout(600);
await page.screenshot({ path: `${OUT}/products-mobile-grid.png` });
await page.evaluate(() => window.scrollTo(0, 1100));
await page.waitForTimeout(600);
await page.screenshot({ path: `${OUT}/products-mobile-grid-2.png` });
await ctx.close();

// Crop the homepage "Nově přidané" section on mobile
const ctx2 = await newCtx({ width: 375, height: 667 });
const page2 = await ctx2.newPage();
await page2.goto(`${BASE}/`, { waitUntil: 'networkidle' });
await page2.waitForTimeout(1200);
// Scroll to "Nově přidané" heading
const heading = page2.locator('h2:has-text("Nově přidané")');
await heading.scrollIntoViewIfNeeded({ timeout: 5000 });
await page2.waitForTimeout(800);
await page2.screenshot({ path: `${OUT}/home-mobile-novinky.png` });
const box = await heading.boundingBox();
console.log('Nově přidané heading at scroll Y:', box ? Math.round(box.y) : 'n/a');
await ctx2.close();

// Same for desktop "Nově přidané"
const ctx3 = await newCtx({ width: 1440, height: 900 });
const page3 = await ctx3.newPage();
await page3.goto(`${BASE}/`, { waitUntil: 'networkidle' });
await page3.waitForTimeout(1200);
const heading3 = page3.locator('h2:has-text("Nově přidané")');
await heading3.scrollIntoViewIfNeeded({ timeout: 5000 });
await page3.waitForTimeout(800);
await page3.screenshot({ path: `${OUT}/home-desktop-novinky.png` });
await ctx3.close();

// Measure homepage scroll distance to "Nově přidané" on mobile from page top
const ctx4 = await newCtx({ width: 375, height: 667 });
const page4 = await ctx4.newPage();
await page4.goto(`${BASE}/`, { waitUntil: 'networkidle' });
await page4.waitForTimeout(1500);
const dist = await page4.evaluate(() => {
  const h = Array.from(document.querySelectorAll('h2')).find(el => /Nově přidané/i.test(el.textContent || ''));
  if (!h) return null;
  const rect = h.getBoundingClientRect();
  return Math.round(rect.top + window.scrollY);
});
console.log('Mobile px-from-top to "Nově přidané":', dist, '(viewport=667)');
await ctx4.close();

await browser.close();
console.log('done');
