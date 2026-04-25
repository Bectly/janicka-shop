import { chromium, devices } from 'playwright';

const BASE = 'https://janicka-shop.vercel.app';
const OUT = '/home/bectly/development/projects/janicka-shop/docs/visual-audits/c4927-launch-ready-mobile';

const slugs = ['panske-sako-stones', 'spaci-pytel-pro-miminko-helios', 'automaticka-michacka-na-kojenecke-mleko'];
const VPs = [
  { name: 'iphone14pro', width: 393, height: 852, dsf: 3, ua: devices['iPhone 14 Pro Max'].userAgent },
  { name: 'pixel7', width: 412, height: 915, dsf: 2.625, ua: devices['Pixel 7'].userAgent },
];

const browser = await chromium.launch({ headless: true });
try {
  for (const vp of VPs) {
    for (const slug of slugs) {
      const ctx = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        deviceScaleFactor: vp.dsf, isMobile: true, hasTouch: true,
        userAgent: vp.ua, locale: 'cs-CZ',
      });
      await ctx.addInitScript(() => {
        const v = JSON.stringify({ essential: true, analytics: true, marketing: true, timestamp: new Date().toISOString() });
        try { localStorage.setItem('janicka-cookie-consent', v); } catch {}
        try { localStorage.setItem('cookie-consent', v); } catch {}
      });
      const page = await ctx.newPage();
      console.log(`-> sold-${slug} ${vp.name}`);
      try {
        await page.goto(`${BASE}/products/${slug}`, { waitUntil: 'networkidle', timeout: 45000 });
      } catch (e) { console.log(`  warn: ${e.message}`); }
      await page.waitForTimeout(1500);
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({ path: `${OUT}/clean-pdp-sold-${slug}-${vp.name}.png`, fullPage: false });
      await page.screenshot({ path: `${OUT}/clean-pdp-sold-${slug}-${vp.name}-full.png`, fullPage: true });
      await ctx.close();
    }
  }
} finally {
  await browser.close();
}
console.log('done');
