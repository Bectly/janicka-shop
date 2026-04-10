import { chromium } from 'playwright';

const BASE = 'http://localhost:3001';
const VIEWPORT = { width: 375, height: 812 };

const PAGES = [
  { name: 'homepage', path: '/' },
  { name: 'products', path: '/products' },
  { name: 'cart', path: '/cart' },
  { name: 'search', path: '/search' },
  { name: 'checkout', path: '/checkout' },
  { name: 'collections', path: '/collections' },
  { name: 'about', path: '/about' },
  { name: 'contact', path: '/contact' },
];

const issues = [];

async function measureTouchTargets(page, pageName) {
  // Find all interactive elements and check min 44x44px
  const violations = await page.evaluate(() => {
    const interactive = Array.from(document.querySelectorAll(
      'a, button, input, select, textarea, [role="button"], [role="link"], [tabindex]'
    ));
    const bad = [];
    for (const el of interactive) {
      const rect = el.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;
      if ((w > 0 || h > 0) && (w < 44 || h < 44)) {
        const text = (el.textContent || el.getAttribute('aria-label') || el.getAttribute('title') || el.tagName).trim().slice(0, 60);
        bad.push({
          tag: el.tagName,
          text,
          w: Math.round(w),
          h: Math.round(h),
          cls: el.className.slice(0, 80)
        });
      }
    }
    return bad.slice(0, 20); // cap at 20
  });
  return violations;
}

async function checkHorizontalOverflow(page) {
  return await page.evaluate(() => {
    const body = document.body;
    const docWidth = document.documentElement.clientWidth;
    const bodyWidth = body.scrollWidth;
    const hasOverflow = bodyWidth > docWidth;

    // Find offending elements
    const offenders = [];
    if (hasOverflow) {
      const all = document.querySelectorAll('*');
      for (const el of all) {
        const rect = el.getBoundingClientRect();
        if (rect.right > docWidth + 2) {
          offenders.push({
            tag: el.tagName,
            cls: el.className.slice(0, 80),
            right: Math.round(rect.right),
            docWidth
          });
        }
      }
    }

    return { hasOverflow, bodyWidth, docWidth, offenders: offenders.slice(0, 10) };
  });
}

async function checkImages(page) {
  return await page.evaluate(() => {
    const imgs = Array.from(document.querySelectorAll('img'));
    const overflowing = imgs.filter(img => {
      const rect = img.getBoundingClientRect();
      return rect.width > window.innerWidth + 2 || rect.right > window.innerWidth + 2;
    });
    return overflowing.map(img => ({
      src: img.src.slice(-60),
      w: Math.round(img.getBoundingClientRect().width),
      vw: window.innerWidth
    }));
  });
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 2,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    hasTouch: true,
    isMobile: true,
  });

  for (const { name, path } of PAGES) {
    const page = await context.newPage();
    console.log(`\n=== ${name.toUpperCase()} (${path}) ===`);

    try {
      const response = await page.goto(BASE + path, {
        waitUntil: 'networkidle',
        timeout: 15000
      });

      const status = response?.status();
      console.log(`HTTP: ${status}`);

      if (status >= 400) {
        console.log(`SKIP: Page returned ${status}`);
        await page.close();
        continue;
      }

      // Wait a bit for any JS rendering
      await page.waitForTimeout(1000);

      // Screenshot
      await page.screenshot({
        path: `/tmp/mobile-${name}.png`,
        fullPage: true,
        animations: 'disabled'
      });
      console.log(`Screenshot: /tmp/mobile-${name}.png`);

      // Check horizontal overflow
      const overflow = await checkHorizontalOverflow(page);
      if (overflow.hasOverflow) {
        console.log(`OVERFLOW: bodyWidth=${overflow.bodyWidth} > docWidth=${overflow.docWidth}`);
        overflow.offenders.forEach(o => console.log(`  OFFENDER: <${o.tag}> cls="${o.cls}" right=${o.right}px`));
        issues.push({ page: name, type: 'horizontal_overflow', detail: overflow });
      } else {
        console.log(`Overflow: NONE`);
      }

      // Check touch targets
      const touchViolations = await measureTouchTargets(page, name);
      if (touchViolations.length > 0) {
        console.log(`Touch targets <44px: ${touchViolations.length}`);
        touchViolations.forEach(v => console.log(`  <${v.tag}> "${v.text}" ${v.w}x${v.h}px`));
        issues.push({ page: name, type: 'touch_target', count: touchViolations.length, items: touchViolations });
      } else {
        console.log(`Touch targets: OK`);
      }

      // Check images
      const imgIssues = await checkImages(page);
      if (imgIssues.length > 0) {
        console.log(`Image overflow: ${imgIssues.length}`);
        imgIssues.forEach(i => console.log(`  ${i.src} ${i.w}px > ${i.vw}vw`));
        issues.push({ page: name, type: 'image_overflow', items: imgIssues });
      } else {
        console.log(`Images: OK`);
      }

      // Check nav usability - look for hamburger/nav toggle
      const hasNav = await page.$('button[aria-label*="menu" i], button[aria-label*="nav" i], [data-testid*="menu"], .hamburger, [aria-controls*="nav"]');
      console.log(`Mobile nav: ${hasNav ? 'found nav trigger' : 'no obvious trigger (check screenshot)'}`);

    } catch (err) {
      console.log(`ERROR: ${err.message}`);
      issues.push({ page: name, type: 'error', message: err.message });
    }

    await page.close();
  }

  // Also check a product page if we can find one
  console.log('\n=== PRODUCT DETAIL PAGE ===');
  try {
    const page = await context.newPage();
    // First get a product slug from the listing
    await page.goto(BASE + '/products', { waitUntil: 'domcontentloaded', timeout: 15000 });
    const productLink = await page.$('a[href*="/products/"]');
    if (productLink) {
      const href = await productLink.getAttribute('href');
      console.log(`Found product: ${href}`);
      await page.goto(BASE + href, { waitUntil: 'networkidle', timeout: 15000 });
      await page.waitForTimeout(1000);
      await page.screenshot({ path: '/tmp/mobile-product-detail.png', fullPage: true, animations: 'disabled' });

      const overflow = await checkHorizontalOverflow(page);
      console.log(`Overflow: ${overflow.hasOverflow ? 'YES bodyWidth=' + overflow.bodyWidth : 'NONE'}`);

      const touchViolations = await measureTouchTargets(page, 'product-detail');
      console.log(`Touch targets <44px: ${touchViolations.length}`);
      touchViolations.slice(0, 10).forEach(v => console.log(`  <${v.tag}> "${v.text}" ${v.w}x${v.h}px`));

      if (touchViolations.length > 0) issues.push({ page: 'product-detail', type: 'touch_target', count: touchViolations.length, items: touchViolations });
      if (overflow.hasOverflow) issues.push({ page: 'product-detail', type: 'horizontal_overflow', detail: overflow });
    }
    await page.close();
  } catch (err) {
    console.log(`ERROR: ${err.message}`);
  }

  await browser.close();

  console.log('\n\n=== SUMMARY OF ALL ISSUES ===');
  if (issues.length === 0) {
    console.log('NO ISSUES FOUND');
  } else {
    issues.forEach(issue => {
      console.log(`[${issue.page}] ${issue.type}: ${JSON.stringify(issue).slice(0, 200)}`);
    });
  }
  console.log('\nISSUE_COUNT:' + issues.length);
}

run().catch(console.error);
