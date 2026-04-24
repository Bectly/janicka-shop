import { chromium } from 'playwright';

const BASE = 'https://janicka-shop.vercel.app';
const OUT = '/home/bectly/development/projects/janicka-shop/docs/visual-audits/c4803-screenshots';

async function shoot(browser, { url, name, viewport, fullPage = false }) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  console.log(`→ ${name} ${viewport.width}x${viewport.height} ${url}`);
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 });
  } catch (e) {
    console.log(`  goto warn: ${e.message}`);
  }
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage });
  await ctx.close();
}

const browser = await chromium.launch({ headless: true });
try {
  // Homepage — mobile viewport, BOTH viewport-only (above the fold) and full
  await shoot(browser, { url: `${BASE}/`, name: 'home-mobile-viewport', viewport: { width: 375, height: 667 } });
  await shoot(browser, { url: `${BASE}/`, name: 'home-mobile-full', viewport: { width: 375, height: 667 }, fullPage: true });

  // Homepage — desktop
  await shoot(browser, { url: `${BASE}/`, name: 'home-desktop-viewport', viewport: { width: 1440, height: 900 } });

  // Products grid — mobile
  await shoot(browser, { url: `${BASE}/products`, name: 'products-mobile', viewport: { width: 375, height: 667 } });

  // Products grid — desktop (for badge sample)
  await shoot(browser, { url: `${BASE}/products`, name: 'products-desktop', viewport: { width: 1440, height: 900 } });

  // Find one product per condition by scraping the API
  const apiCtx = await browser.newContext();
  const apiPage = await apiCtx.newPage();
  const samples = {};
  for (const cond of ['new_with_tags','new_without_tags','excellent','good','visible_wear']) {
    try {
      const res = await apiPage.request.get(`${BASE}/api/products?condition=${cond}&limit=1`);
      if (res.ok()) {
        const j = await res.json();
        const slug = j?.products?.[0]?.slug || j?.data?.[0]?.slug || j?.[0]?.slug;
        if (slug) samples[cond] = slug;
      }
    } catch {}
  }
  console.log('Condition samples:', samples);
  await apiCtx.close();

  // PDP for each condition we found
  for (const [cond, slug] of Object.entries(samples)) {
    await shoot(browser, { url: `${BASE}/products/${slug}`, name: `pdp-${cond}-mobile`, viewport: { width: 375, height: 667 } });
  }
} finally {
  await browser.close();
}
console.log('done');
