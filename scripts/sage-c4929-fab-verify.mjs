import { chromium, devices } from 'playwright';

const BASE = process.env.SAGE_BASE_URL || 'https://janicka-shop.vercel.app';
const OUT = '/home/bectly/development/projects/janicka-shop/docs/visual-audits/c4929-fab-fix-verify';

const VIEWPORTS = [
  { name: 'iphone14pro', width: 393, height: 852, dsf: 3, ua: devices['iPhone 14 Pro Max'].userAgent },
  { name: 'pixel7', width: 412, height: 915, dsf: 2.625, ua: devices['Pixel 7'].userAgent },
];

const SOLD_SLUG = 'spaci-pytel-pro-miminko-helios';

async function newCtx(browser, vp) {
  const ctx = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: vp.dsf,
    isMobile: true,
    hasTouch: true,
    userAgent: vp.ua,
    locale: 'cs-CZ',
  });
  const host = new URL(BASE).hostname;
  await ctx.addCookies([{ name: 'cookie-consent', value: '1', domain: host, path: '/' }]);
  await ctx.addInitScript(() => {
    try {
      localStorage.setItem('janicka-cookie-consent', JSON.stringify({
        essential: true, analytics: true, marketing: true,
        timestamp: new Date().toISOString(),
      }));
    } catch {}
  });
  return ctx;
}

async function dismissCookies(page) {
  for (const t of ['Přijmout vše', 'Přijmout', 'Souhlasím', 'OK', 'Rozumím']) {
    try {
      const btn = page.getByRole('button', { name: t });
      if (await btn.count()) { await btn.first().click({ timeout: 1500 }); await page.waitForTimeout(300); return; }
    } catch {}
  }
}

async function inspectFab(page) {
  return await page.evaluate(() => {
    const btn = document.querySelector('button[aria-label="Objevuj náhodné kousky"]');
    if (!btn) return { present: false };
    const r = btn.getBoundingClientRect();
    return { present: true, x: r.x, y: r.y, w: r.width, h: r.height, cx: r.x + r.width / 2, cy: r.y + r.height / 2 };
  });
}

async function shoot(browser, vp, { url, name, fullPage = false }) {
  const ctx = await newCtx(browser, vp);
  const page = await ctx.newPage();
  const fullName = `${name}-${vp.name}`;
  console.log(`-> ${fullName} ${vp.width}x${vp.height} ${url}`);
  try { await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 }); } catch (e) { console.log(`  goto warn: ${e.message}`); }
  await dismissCookies(page);
  await page.waitForTimeout(400);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(400);
  const fab = await inspectFab(page);
  await page.screenshot({ path: `${OUT}/${fullName}${fullPage ? '-full' : ''}.png`, fullPage });
  await ctx.close();
  return { fullName, url, fab };
}

const browser = await chromium.launch({ headless: true });
const results = [];
try {
  // Discover an available PDP slug
  const ctx = await newCtx(browser, VIEWPORTS[0]);
  const page = await ctx.newPage();
  await page.goto(`${BASE}/products`, { waitUntil: 'networkidle', timeout: 45000 });
  const slugs = await page.$$eval('a[href^="/products/"]', as => Array.from(new Set(
    as.map(a => a.getAttribute('href') || '').filter(h => /^\/products\/[^/?#]+$/.test(h))
  )));
  const availableSlug = slugs.find(s => !s.includes(SOLD_SLUG)) || slugs[0];
  console.log(`available=${availableSlug} sold=/products/${SOLD_SLUG}`);
  await ctx.close();

  for (const vp of VIEWPORTS) {
    results.push(await shoot(browser, vp, { url: `${BASE}/`, name: 'home' }));
    results.push(await shoot(browser, vp, { url: `${BASE}/products`, name: 'products' }));
    results.push(await shoot(browser, vp, { url: `${BASE}${availableSlug}`, name: 'pdp-available' }));
    results.push(await shoot(browser, vp, { url: `${BASE}/products/${SOLD_SLUG}`, name: 'pdp-sold' }));
    results.push(await shoot(browser, vp, { url: `${BASE}/cart`, name: 'cart' }));
    results.push(await shoot(browser, vp, { url: `${BASE}/checkout`, name: 'checkout' }));
  }
} finally {
  await browser.close();
}

console.log('\n=== FAB inspection ===');
for (const r of results) {
  if (!r.fab.present) console.log(`HIDDEN  ${r.fullName}  (${r.url})`);
  else console.log(`PRESENT ${r.fullName}  cx=${r.fab.cx.toFixed(0)} cy=${r.fab.cy.toFixed(0)} (${r.fab.w}x${r.fab.h})`);
}

import { writeFileSync } from 'fs';
writeFileSync(`${OUT}/fab-inspection.json`, JSON.stringify(results, null, 2));
console.log('\ndone');
