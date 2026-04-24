import { chromium } from 'playwright';

const BASE = 'https://janicka-shop.vercel.app';
const OUT = '/home/bectly/development/projects/janicka-shop/docs/visual-audits/c4803-screenshots';

async function dismissCookies(page) {
  const labels = ['Přijmout vše', 'Přijmout', 'Souhlasím', 'OK'];
  for (const t of labels) {
    const btn = page.getByRole('button', { name: t });
    if (await btn.count().catch(() => 0)) {
      try { await btn.first().click({ timeout: 2000 }); await page.waitForTimeout(500); return true; } catch {}
    }
  }
  return false;
}

async function newCtx(browser, viewport) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2, locale: 'cs-CZ' });
  await ctx.addCookies([
    { name: 'cookie-consent', value: '1', domain: 'janicka-shop.vercel.app', path: '/' },
  ]);
  await ctx.addInitScript(() => {
    try {
      localStorage.setItem('janicka-cookie-consent', JSON.stringify({
        essential: true, analytics: true, marketing: true, timestamp: new Date().toISOString(),
      }));
    } catch {}
  });
  return ctx;
}

async function shoot(browser, { url, name, viewport, fullPage = false }) {
  const ctx = await newCtx(browser, viewport);
  const page = await ctx.newPage();
  console.log(`-> ${name} ${viewport.width}x${viewport.height} ${url}`);
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 });
  } catch (e) {
    console.log(`  goto warn: ${e.message}`);
  }
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage });
  await ctx.close();
}

const browser = await chromium.launch({ headless: true });
try {
  await shoot(browser, { url: `${BASE}/`, name: 'home-mobile-viewport', viewport: { width: 375, height: 667 } });
  await shoot(browser, { url: `${BASE}/`, name: 'home-mobile-full', viewport: { width: 375, height: 667 }, fullPage: true });
  await shoot(browser, { url: `${BASE}/`, name: 'home-desktop-viewport', viewport: { width: 1440, height: 900 } });
  await shoot(browser, { url: `${BASE}/products`, name: 'products-mobile', viewport: { width: 375, height: 667 } });
  await shoot(browser, { url: `${BASE}/products`, name: 'products-desktop', viewport: { width: 1440, height: 900 } });

  const ctx = await newCtx(browser, { width: 1440, height: 900 });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/products`, { waitUntil: 'networkidle' });
  const slugs = await page.$$eval('a[href^="/products/"]', as => Array.from(new Set(
    as.map(a => a.getAttribute('href') || '').filter(h => /^\/products\/[^/?#]+$/.test(h))
  )).slice(0, 6));
  console.log('Discovered slugs:', slugs);
  await ctx.close();

  for (let i = 0; i < slugs.length && i < 4; i++) {
    await shoot(browser, { url: `${BASE}${slugs[i]}`, name: `pdp-sample-${i + 1}-mobile`, viewport: { width: 375, height: 667 } });
  }

  const ctx2 = await newCtx(browser, { width: 375, height: 1500 });
  const page2 = await ctx2.newPage();
  await page2.goto(`${BASE}/products`, { waitUntil: 'networkidle' });
  await page2.waitForTimeout(1000);
  await page2.screenshot({ path: `${OUT}/products-mobile-tall.png` });
  await ctx2.close();
} finally {
  await browser.close();
}
console.log('done');
