import { chromium, devices } from 'playwright';

const BASE = process.env.SAGE_BASE_URL || 'https://janicka-shop.vercel.app';
const OUT = '/home/bectly/development/projects/janicka-shop/docs/visual-audits/c4927-launch-ready-mobile';

// Required viewports per Lead directive #579: iPhone 14 Pro 393x852, Pixel 7 412x915
const VIEWPORTS = [
  { name: 'iphone14pro', width: 393, height: 852, dsf: 3, ua: devices['iPhone 14 Pro Max'].userAgent },
  { name: 'pixel7', width: 412, height: 915, dsf: 2.625, ua: devices['Pixel 7'].userAgent },
];

async function newCtx(browser, vp) {
  const ctx = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: vp.dsf,
    isMobile: true,
    hasTouch: true,
    userAgent: vp.ua,
    locale: 'cs-CZ',
  });
  // pre-accept cookies
  const host = new URL(BASE).hostname;
  await ctx.addCookies([
    { name: 'cookie-consent', value: '1', domain: host, path: '/' },
  ]);
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
  const labels = ['Přijmout vše', 'Přijmout', 'Souhlasím', 'OK', 'Rozumím'];
  for (const t of labels) {
    try {
      const btn = page.getByRole('button', { name: t });
      if (await btn.count()) {
        await btn.first().click({ timeout: 1500 });
        await page.waitForTimeout(400);
        return true;
      }
    } catch {}
  }
  return false;
}

async function shoot(browser, vp, { url, name, fullPage = false, prep }) {
  const ctx = await newCtx(browser, vp);
  const page = await ctx.newPage();
  const fullName = `${name}-${vp.name}`;
  console.log(`-> ${fullName}  ${vp.width}x${vp.height}  ${url}`);
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 });
  } catch (e) {
    console.log(`  goto warn: ${e.message}`);
  }
  await dismissCookies(page);
  await page.waitForTimeout(800);
  if (prep) {
    try { await prep(page); } catch (e) { console.log(`  prep warn: ${e.message}`); }
  }
  await page.screenshot({ path: `${OUT}/${fullName}${fullPage ? '-full' : ''}.png`, fullPage });
  await ctx.close();
}

const browser = await chromium.launch({ headless: true });
const findings = [];
try {
  // Discover an available + a sold PDP slug
  const ctx = await newCtx(browser, VIEWPORTS[0]);
  const page = await ctx.newPage();
  await page.goto(`${BASE}/products`, { waitUntil: 'networkidle', timeout: 45000 });
  const slugs = await page.$$eval('a[href^="/products/"]', as => Array.from(new Set(
    as.map(a => a.getAttribute('href') || '').filter(h => /^\/products\/[^/?#]+$/.test(h))
  )));
  console.log(`Found ${slugs.length} product links on /products`);
  await ctx.close();

  let availableSlug = slugs[0];
  let soldSlug = null;

  // Try to find a sold one by probing /products?available=false (admin filter) — fallback: sniff badges
  const ctx2 = await newCtx(browser, VIEWPORTS[0]);
  const page2 = await ctx2.newPage();
  await page2.goto(`${BASE}/products`, { waitUntil: 'networkidle' });
  const soldHrefs = await page2.$$eval('a', as =>
    as.filter(a => {
      const txt = (a.textContent || '').toLowerCase();
      return /prodáno|prodano|sold/.test(txt) && /\/products\//.test(a.getAttribute('href') || '');
    }).map(a => a.getAttribute('href'))
  );
  if (soldHrefs.length) soldSlug = soldHrefs[0];
  await ctx2.close();
  console.log(`available=${availableSlug}  sold=${soldSlug || '(none on /products listing)'}`);

  for (const vp of VIEWPORTS) {
    await shoot(browser, vp, { url: `${BASE}/`, name: 'home-abovefold' });
    await shoot(browser, vp, { url: `${BASE}/`, name: 'home', fullPage: true });

    await shoot(browser, vp, { url: `${BASE}/products`, name: 'products-listing' });
    await shoot(browser, vp, { url: `${BASE}/products`, name: 'products-listing', fullPage: true });

    // open mobile filter drawer if present
    await shoot(browser, vp, {
      url: `${BASE}/products`,
      name: 'products-filter-open',
      prep: async (page) => {
        const filterBtn = page.getByRole('button', { name: /filtr/i });
        if (await filterBtn.count()) {
          await filterBtn.first().click({ timeout: 2000 });
          await page.waitForTimeout(800);
        }
      },
    });

    if (availableSlug) {
      await shoot(browser, vp, { url: `${BASE}${availableSlug}`, name: 'pdp-available' });
      await shoot(browser, vp, { url: `${BASE}${availableSlug}`, name: 'pdp-available', fullPage: true });
    }
    if (soldSlug) {
      await shoot(browser, vp, { url: `${BASE}${soldSlug}`, name: 'pdp-sold', fullPage: true });
    }

    await shoot(browser, vp, { url: `${BASE}/cart`, name: 'cart-empty' });
    await shoot(browser, vp, { url: `${BASE}/checkout`, name: 'checkout' });
    await shoot(browser, vp, { url: `${BASE}/checkout`, name: 'checkout', fullPage: true });
  }
} finally {
  await browser.close();
}
console.log('done');
