import { chromium } from 'playwright';

const BASE = 'http://localhost:3000';
const VIEWPORT = { width: 375, height: 812 };

async function dismissOverlay(page) {
  try {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
    const btn = await page.$('button[data-close-overlay], [data-nextjs-toast-errors-close], button:has-text("×"), button:has-text("✕")');
    if (btn) await btn.click().catch(() => {});
  } catch {}
}

async function screenshotPage(name, path) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 2,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1',
    hasTouch: true,
    isMobile: true,
    storageState: {
      cookies: [],
      origins: [{
        origin: BASE,
        localStorage: [
          // Set cookie consent so banner doesn't appear
          { name: 'janicka-cookie-consent', value: JSON.stringify({ essential: true, analytics: false, marketing: false, timestamp: new Date().toISOString() }) }
        ]
      }]
    }
  });

  const page = await context.newPage();
  await page.goto(BASE + path, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);
  await dismissOverlay(page);
  await page.waitForTimeout(500);
  await page.screenshot({ path: `/tmp/final-${name}.png`, fullPage: true, animations: 'disabled' });

  const status = await page.evaluate(() => ({
    hasOverflow: document.body.scrollWidth > document.documentElement.clientWidth,
    bodyScrollWidth: document.body.scrollWidth,
    docWidth: document.documentElement.clientWidth,
    hasError: !!document.querySelector('[data-nextjs-dialog], [data-nextjs-errors]'),
    errorText: document.querySelector('[data-nextjs-dialog] h1, .nextjs-toast-errors')?.textContent || '',
    title: document.title,
  }));

  await browser.close();
  return status;
}

const pages = [
  ['homepage', '/'],
  ['products', '/products'],
  ['collections', '/collections'],
  ['search', '/search'],
  ['cart', '/cart'],
  ['checkout', '/checkout'],
  ['about', '/about'],
  ['privacy', '/privacy'],
  ['shipping', '/shipping'],
  ['returns', '/returns'],
];

for (const [name, path] of pages) {
  try {
    const status = await screenshotPage(name, path);
    const overflowStr = status.hasOverflow ? `OVERFLOW (${status.bodyScrollWidth} > ${status.docWidth})` : 'ok';
    const errStr = status.hasError ? `ERROR: ${status.errorText.slice(0, 80)}` : 'ok';
    console.log(`[${name}] overflow=${overflowStr} error=${errStr} title="${status.title}"`);
  } catch(e) {
    console.log(`[${name}] FAILED: ${e.message.slice(0,100)}`);
  }
}
console.log('\nScreenshots saved to /tmp/final-*.png');
