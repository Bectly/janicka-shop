import { chromium } from 'playwright';

const BASE = 'http://localhost:3000';
const VIEWPORT = { width: 375, height: 812 };

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
          // Pre-accept cookies to suppress banner
          { name: 'janicka-cookie-consent', value: JSON.stringify({ essential: true, analytics: false, marketing: false, timestamp: new Date().toISOString() }) }
        ]
      }]
    }
  });

  const page = await context.newPage();
  // 'load' event fires after initial HTML+scripts. Streaming sections may still load async.
  await page.goto(BASE + path, { waitUntil: 'load', timeout: 20000 });
  // Wait a bit for any streaming Suspense sections to render
  await page.waitForTimeout(3000);

  // Check for error overlay
  const hasDevError = await page.$('[data-nextjs-dialog], [data-nextjs-toast-errors]');
  if (hasDevError) {
    // Try pressing Escape to dismiss
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
  }

  await page.screenshot({ path: `/tmp/final-${name}.png`, fullPage: true, animations: 'disabled' });

  const status = await page.evaluate(() => ({
    hasOverflow: document.body.scrollWidth > document.documentElement.clientWidth,
    bodyScrollWidth: document.body.scrollWidth,
    docWidth: document.documentElement.clientWidth,
    hasDevError: !!document.querySelector('[data-nextjs-dialog]'),
    title: document.title,
    interactiveCount: document.querySelectorAll('a, button, input[type="text"], input[type="email"]').length,
  }));

  // Touch target audit
  const touchViolations = await page.evaluate(() => {
    const interactive = Array.from(document.querySelectorAll('a, button, input, [role="button"]'));
    return interactive
      .filter(el => {
        if (el.closest('[data-nextjs-dialog], [data-nextjs-errors]')) return false;
        const rect = el.getBoundingClientRect();
        const style = window.getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden') return false;
        return rect.width > 1 && rect.height > 1 && (rect.width < 44 || rect.height < 44);
      })
      .map(el => ({
        tag: el.tagName,
        text: (el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 50),
        w: Math.round(el.getBoundingClientRect().width),
        h: Math.round(el.getBoundingClientRect().height),
        href: el.getAttribute('href')?.slice(0, 60) || ''
      }))
      .slice(0, 15);
  });

  await browser.close();
  return { ...status, touchViolations };
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

console.log('Mobile QA — 375×812 viewport (iPhone 14)\n');

const allIssues = [];

for (const [name, path] of pages) {
  try {
    const s = await screenshotPage(name, path);
    const overflowStr = s.hasOverflow ? `OVERFLOW(${s.bodyScrollWidth}>${s.docWidth}px)` : 'PASS';
    const errorStr = s.hasDevError ? 'DEV_ERROR' : 'PASS';
    const touchStr = s.touchViolations.length > 0 ? `FAIL(${s.touchViolations.length})` : 'PASS';
    console.log(`[${name.padEnd(12)}] overflow=${overflowStr} error=${errorStr} touch=${touchStr} title="${s.title.slice(0,40)}"`);
    if (s.touchViolations.length > 0) {
      s.touchViolations.forEach(v => console.log(`  ↳ <${v.tag}> "${v.text}" ${v.w}×${v.h}px${v.href ? ' href=' + v.href : ''}`));
      allIssues.push({ page: name, type: 'touch', items: s.touchViolations });
    }
    if (s.hasOverflow) allIssues.push({ page: name, type: 'overflow', bodyScrollWidth: s.bodyScrollWidth });
    if (s.hasDevError) allIssues.push({ page: name, type: 'dev_error' });
  } catch(e) {
    console.log(`[${name.padEnd(12)}] ERROR: ${e.message.slice(0,100)}`);
    allIssues.push({ page: name, type: 'crash', message: e.message.slice(0,100) });
  }
}

console.log(`\n═══ SUMMARY ═══`);
console.log(`Total issues: ${allIssues.length}`);
if (allIssues.length === 0) console.log('✓ All checks passed');
else allIssues.forEach(i => console.log(`  [${i.page}] ${i.type}`));
console.log('\nScreenshots: /tmp/final-*.png');
