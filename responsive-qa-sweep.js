/**
 * Responsive QA sweep — task #768
 * Captures screenshots, console errors, layout-shifts, FAB collisions
 * across 8 viewports × 7 pages.
 */
const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const VIEWPORTS = [
  { name: 'iphone-se1-320', width: 320, height: 568 },
  { name: 'iphone-se2-375', width: 375, height: 667 },
  { name: 'iphone-13-390', width: 390, height: 844 },
  { name: 'iphone-11pm-414', width: 414, height: 896 },
  { name: 'iphone-14pm-430', width: 430, height: 932 },
  { name: 'galaxy-s20-360', width: 360, height: 800 },
  { name: 'ipad-768', width: 768, height: 1024 },
  { name: 'ipad-pro-1024', width: 1024, height: 1366 },
];

const PAGES = [
  { slug: 'home', url: '/' },
  { slug: 'products', url: '/products' },
  { slug: 'pdp', url: 'PDP_PLACEHOLDER' },
  { slug: 'search', url: '/search?q=tri%C4%8Dko' },
  { slug: 'cart', url: '/cart' },
  { slug: 'checkout', url: '/checkout' },
  { slug: 'account', url: '/account' },
];

const BASE = 'http://localhost:3000';
const OUT_DIR = '/home/bectly/development/projects/janicka-shop/docs/responsive-screenshots';

async function getFirstProductSlug() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(BASE + '/products', { waitUntil: 'domcontentloaded', timeout: 30000 });
  const href = await page.locator('a[href^="/products/"]').first().getAttribute('href').catch(() => null);
  await browser.close();
  return href || '/products';
}

async function checkFabCollisions(page) {
  // Find fixed-positioned elements and compute pairwise distances
  return await page.evaluate(() => {
    const all = Array.from(document.querySelectorAll('*'));
    const fixed = all.filter((el) => {
      const cs = getComputedStyle(el);
      return (cs.position === 'fixed' || cs.position === 'sticky') && el.getBoundingClientRect().width > 0 && el.getBoundingClientRect().height > 0;
    });
    const rects = fixed.map((el) => {
      const r = el.getBoundingClientRect();
      return { tag: el.tagName, cls: el.className?.toString?.()?.slice(0, 80) || '', x: r.x, y: r.y, w: r.width, h: r.height, b: r.bottom, r: r.right };
    });
    const collisions = [];
    for (let i = 0; i < rects.length; i++) {
      for (let j = i + 1; j < rects.length; j++) {
        const a = rects[i], b = rects[j];
        // skip if either is full-width header
        if (a.w > 200 || b.w > 200) continue;
        const overlapX = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
        const overlapY = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
        if (overlapX > 0 && overlapY > 0) {
          collisions.push({ a, b, overlap: { x: overlapX, y: overlapY } });
          continue;
        }
        // Distance between rects
        const dx = a.x + a.w < b.x ? b.x - (a.x + a.w) : (b.x + b.w < a.x ? a.x - (b.x + b.w) : 0);
        const dy = a.y + a.h < b.y ? b.y - (a.y + a.h) : (b.y + b.h < a.y ? a.y - (b.y + b.h) : 0);
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 8 && a.w < 200 && b.w < 200) {
          collisions.push({ a, b, distance: dist });
        }
      }
    }
    return collisions;
  });
}

async function getCLS(page) {
  return await page.evaluate(() => {
    return new Promise((resolve) => {
      let cls = 0;
      try {
        const po = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (!entry.hadRecentInput) cls += entry.value;
          }
        });
        po.observe({ type: 'layout-shift', buffered: true });
        setTimeout(() => { po.disconnect(); resolve(cls); }, 1500);
      } catch (e) { resolve(0); }
    });
  });
}

(async () => {
  const pdpUrl = await getFirstProductSlug();
  PAGES.find((p) => p.slug === 'pdp').url = pdpUrl;
  console.log('PDP URL:', pdpUrl);

  const results = [];
  const browser = await chromium.launch();

  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    const page = await ctx.newPage();

    for (const p of PAGES) {
      const errs = [];
      const reqFails = [];
      page.on('console', (msg) => { if (msg.type() === 'error') errs.push(msg.text().slice(0, 200)); });
      page.on('pageerror', (e) => errs.push('pageerror: ' + e.message.slice(0, 200)));
      page.on('requestfailed', (req) => reqFails.push(req.url() + ' ' + (req.failure()?.errorText || '')));

      const url = BASE + p.url;
      let status = 'ok', loadMs = 0, cls = 0, collisions = [];
      try {
        const t0 = Date.now();
        const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        loadMs = Date.now() - t0;
        status = resp ? String(resp.status()) : 'no-response';
        // Wait briefly for images / hydration
        await page.waitForTimeout(800);
        cls = await getCLS(page).catch(() => 0);
        collisions = await checkFabCollisions(page).catch(() => []);
        const screenshotPath = path.join(OUT_DIR, `${vp.name}_${p.slug}.png`);
        await page.screenshot({ path: screenshotPath, fullPage: false });
      } catch (e) {
        status = 'ERR: ' + e.message.slice(0, 120);
      }

      const r = {
        viewport: vp.name,
        size: `${vp.width}x${vp.height}`,
        page: p.slug,
        url: p.url,
        status,
        loadMs,
        cls: Number(cls.toFixed(4)),
        consoleErrors: errs.slice(0, 5),
        consoleErrorCount: errs.length,
        requestFails: reqFails.slice(0, 3),
        requestFailCount: reqFails.length,
        collisions: collisions.length,
        collisionDetail: collisions.slice(0, 3).map((c) => ({
          a: `${c.a.tag}.${c.a.cls.slice(0, 30)}`,
          b: `${c.b.tag}.${c.b.cls.slice(0, 30)}`,
          dist: c.distance ?? 'overlap',
        })),
      };
      results.push(r);
      console.log(`${vp.name} ${p.slug}: ${status} cls=${r.cls} errs=${errs.length} collisions=${collisions.length}`);
      // reset listeners
      page.removeAllListeners('console');
      page.removeAllListeners('pageerror');
      page.removeAllListeners('requestfailed');
    }

    await ctx.close();
  }
  await browser.close();
  fs.writeFileSync('/tmp/responsive-qa-results.json', JSON.stringify(results, null, 2));
  console.log('\nDONE. Results saved to /tmp/responsive-qa-results.json');
})();
