import { chromium, devices } from 'playwright';

const BASE = 'https://janicka-shop.vercel.app';
const OUT = '/home/bectly/development/projects/janicka-shop/docs/visual-audits/c4927-launch-ready-mobile';

const VIEWPORTS = [
  { name: 'iphone14pro', width: 393, height: 852, dsf: 3, ua: devices['iPhone 14 Pro Max'].userAgent },
  { name: 'pixel7', width: 412, height: 915, dsf: 2.625, ua: devices['Pixel 7'].userAgent },
];

const PAGES = [
  { url: '/', name: 'home' },
  { url: '/products', name: 'products' },
  { url: '/products/letni-boty-na-klinku-graceland-vel-37', name: 'pdp' },
  { url: '/cart', name: 'cart' },
  { url: '/checkout', name: 'checkout' },
];

const browser = await chromium.launch({ headless: true });
try {
  for (const vp of VIEWPORTS) {
    for (const p of PAGES) {
      const ctx = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        deviceScaleFactor: vp.dsf,
        isMobile: true, hasTouch: true,
        userAgent: vp.ua, locale: 'cs-CZ',
      });
      // pre-set cookie banner to dismissed via every plausible storage key
      await ctx.addInitScript(() => {
        const v = JSON.stringify({ essential: true, analytics: true, marketing: true, timestamp: new Date().toISOString() });
        try { localStorage.setItem('janicka-cookie-consent', v); } catch {}
        try { localStorage.setItem('cookie-consent', v); } catch {}
        try { localStorage.setItem('cookieConsent', v); } catch {}
      });
      const page = await ctx.newPage();
      const out = `${OUT}/clean-${p.name}-${vp.name}.png`;
      console.log(`-> ${p.name} ${vp.name}`);
      try {
        await page.goto(`${BASE}${p.url}`, { waitUntil: 'networkidle', timeout: 45000 });
      } catch (e) { console.log(`  warn: ${e.message}`); }
      await page.waitForTimeout(1200);
      // ensure top of page
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(200);
      await page.screenshot({ path: out, fullPage: false });
      await ctx.close();
    }
  }
} finally {
  await browser.close();
}
console.log('done');
