import { chromium } from 'playwright';

const BASE = 'http://localhost:3000';
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
  { name: 'privacy', path: '/privacy' },
  { name: 'shipping', path: '/shipping' },
  { name: 'returns', path: '/returns' },
];

const issues = [];

async function dismissDevErrorOverlay(page) {
  // Try to dismiss Next.js dev error overlay
  try {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    // Also try clicking the X button if visible
    const closeBtn = await page.$('[data-nextjs-dialog-close], button[aria-label*="close" i], .nextjs-toast-errors-close');
    if (closeBtn) await closeBtn.click();
  } catch {}
}

async function measureTouchTargets(page) {
  return await page.evaluate(() => {
    const interactive = Array.from(document.querySelectorAll(
      'a, button, input, select, textarea, [role="button"], [role="link"], [tabindex="0"]'
    ));
    const bad = [];
    for (const el of interactive) {
      const rect = el.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;
      // Visible and too small
      if (w > 1 && h > 1 && (w < 44 || h < 44)) {
        // Filter out dev tools overlays
        const inDevOverlay = el.closest('[data-nextjs-dialog], .nextjs-container-errors, #__next-build-watcher, [class*="devtool"], [id*="__next"]');
        if (inDevOverlay) continue;
        const text = (el.textContent || el.getAttribute('aria-label') || el.getAttribute('title') || el.tagName).trim().slice(0, 60);
        const computedStyle = window.getComputedStyle(el);
        if (computedStyle.display === 'none' || computedStyle.visibility === 'hidden') continue;
        bad.push({
          tag: el.tagName,
          text,
          w: Math.round(w),
          h: Math.round(h),
          cls: el.className?.slice?.(0, 80) || ''
        });
      }
    }
    return bad.slice(0, 25);
  });
}

async function checkHorizontalOverflow(page) {
  return await page.evaluate(() => {
    const docWidth = document.documentElement.clientWidth;
    const bodyScrollWidth = document.body.scrollWidth;
    const hasOverflow = bodyScrollWidth > docWidth;

    const offenders = [];
    if (hasOverflow) {
      const all = document.querySelectorAll('*');
      for (const el of all) {
        if (el.closest('[data-nextjs-dialog], .nextjs-container-errors, #__next-build-watcher')) continue;
        const rect = el.getBoundingClientRect();
        if (rect.right > docWidth + 2) {
          offenders.push({
            tag: el.tagName,
            cls: el.className?.slice?.(0, 80) || '',
            right: Math.round(rect.right),
            docWidth,
            id: el.id || ''
          });
        }
      }
    }
    return { hasOverflow, bodyScrollWidth, docWidth, offenders: offenders.slice(0, 8) };
  });
}

async function checkImages(page) {
  return await page.evaluate(() => {
    const imgs = Array.from(document.querySelectorAll('img'));
    return imgs
      .filter(img => {
        const rect = img.getBoundingClientRect();
        return rect.width > window.innerWidth + 5;
      })
      .map(img => ({
        src: (img.src || img.getAttribute('src') || '').slice(-60),
        w: Math.round(img.getBoundingClientRect().width),
        vw: window.innerWidth
      }));
  });
}

async function checkTextOverflow(page) {
  return await page.evaluate(() => {
    const all = document.querySelectorAll('p, h1, h2, h3, h4, span, a, button, li');
    const docWidth = document.documentElement.clientWidth;
    const bad = [];
    for (const el of all) {
      if (el.closest('[data-nextjs-dialog], .nextjs-container-errors')) continue;
      const rect = el.getBoundingClientRect();
      if (rect.right > docWidth + 5 && rect.width > 30) {
        bad.push({
          tag: el.tagName,
          text: el.textContent?.trim().slice(0, 50),
          right: Math.round(rect.right),
          docWidth
        });
      }
    }
    return bad.slice(0, 5);
  });
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 2,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1',
    hasTouch: true,
    isMobile: true,
  });

  for (const { name, path } of PAGES) {
    const page = await context.newPage();
    console.log(`\n=== ${name.toUpperCase()} (${path}) ===`);

    try {
      const response = await page.goto(BASE + path, {
        waitUntil: 'domcontentloaded',
        timeout: 20000
      });
      const status = response?.status();
      console.log(`HTTP: ${status}`);

      if (status >= 400) {
        console.log(`SKIP: ${status}`);
        await page.close();
        continue;
      }

      // Wait for network to settle + dismiss any dev overlays
      await page.waitForTimeout(2000);
      await dismissDevErrorOverlay(page);
      await page.waitForTimeout(300);

      // Screenshot
      await page.screenshot({
        path: `/tmp/mobile-${name}.png`,
        fullPage: true,
        animations: 'disabled'
      });
      console.log(`Screenshot saved`);

      // Checks
      const overflow = await checkHorizontalOverflow(page);
      if (overflow.hasOverflow) {
        console.log(`OVERFLOW: bodyScrollWidth=${overflow.bodyScrollWidth} docWidth=${overflow.docWidth}`);
        overflow.offenders.forEach(o => console.log(`  - <${o.tag}> id="${o.id}" cls="${o.cls}" right=${o.right}px`));
        issues.push({ page: name, type: 'horizontal_overflow', detail: overflow });
      } else {
        console.log(`Overflow: NONE`);
      }

      const touchViolations = await measureTouchTargets(page);
      if (touchViolations.length > 0) {
        console.log(`Touch targets <44px: ${touchViolations.length}`);
        touchViolations.forEach(v => console.log(`  - <${v.tag}> "${v.text}" ${v.w}x${v.h}px`));
        issues.push({ page: name, type: 'touch_target', count: touchViolations.length, items: touchViolations });
      } else {
        console.log(`Touch targets: OK`);
      }

      const imgIssues = await checkImages(page);
      if (imgIssues.length > 0) {
        console.log(`Image overflow: ${imgIssues.length}`);
        imgIssues.forEach(i => console.log(`  ${i.src} ${i.w}px`));
        issues.push({ page: name, type: 'image_overflow', items: imgIssues });
      } else {
        console.log(`Images: OK`);
      }

      const textOverflow = await checkTextOverflow(page);
      if (textOverflow.length > 0) {
        console.log(`Text overflow: ${textOverflow.length}`);
        textOverflow.forEach(t => console.log(`  <${t.tag}> "${t.text}" right=${t.right}px`));
        issues.push({ page: name, type: 'text_overflow', items: textOverflow });
      } else {
        console.log(`Text overflow: OK`);
      }

    } catch (err) {
      console.log(`ERROR: ${err.message.slice(0, 150)}`);
      issues.push({ page: name, type: 'error', message: err.message.slice(0, 150) });
    }

    await page.close();
  }

  // Product detail page
  console.log('\n=== PRODUCT DETAIL PAGE ===');
  try {
    const page = await context.newPage();
    await page.goto(BASE + '/products', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(2000);
    await dismissDevErrorOverlay(page);

    const productLink = await page.$('a[href*="/products/"]:not([href="/products"])');
    if (productLink) {
      const href = await productLink.getAttribute('href');
      console.log(`Testing: ${href}`);
      await page.goto(BASE + href, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await page.waitForTimeout(2000);
      await dismissDevErrorOverlay(page);
      await page.screenshot({ path: '/tmp/mobile-product-detail.png', fullPage: true, animations: 'disabled' });

      const overflow = await checkHorizontalOverflow(page);
      console.log(`Overflow: ${overflow.hasOverflow ? 'YES ' + overflow.bodyScrollWidth + 'px > ' + overflow.docWidth + 'px' : 'NONE'}`);

      const touchViolations = await measureTouchTargets(page);
      console.log(`Touch <44px: ${touchViolations.length}`);
      touchViolations.slice(0, 10).forEach(v => console.log(`  <${v.tag}> "${v.text}" ${v.w}x${v.h}px`));

      // Check product gallery
      const galleryExists = await page.$('[data-testid="product-gallery"], .product-gallery, [class*="gallery"]');
      const swipeExists = await page.$('[data-swipeable], [class*="swipe"], [class*="carousel"]');
      console.log(`Gallery: ${galleryExists ? 'found' : 'no element'}, Swipe: ${swipeExists ? 'found' : 'no swipe attr'}`);

      if (touchViolations.length > 0) issues.push({ page: 'product-detail', type: 'touch_target', count: touchViolations.length, items: touchViolations.slice(0, 5) });
      if (overflow.hasOverflow) issues.push({ page: 'product-detail', type: 'horizontal_overflow', detail: overflow });
    } else {
      console.log('No products visible (empty state or error overlay)');
    }
    await page.close();
  } catch (err) {
    console.log(`ERROR: ${err.message.slice(0, 150)}`);
  }

  // Checkout mobile test
  console.log('\n=== CHECKOUT FORM MOBILE ===');
  try {
    const page = await context.newPage();
    await page.goto(BASE + '/checkout', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(2000);
    await dismissDevErrorOverlay(page);
    await page.screenshot({ path: '/tmp/mobile-checkout-detail.png', fullPage: true, animations: 'disabled' });

    // Check form fields
    const fields = await page.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll('input, select, textarea'));
      return inputs.map(inp => {
        const rect = inp.getBoundingClientRect();
        return {
          type: inp.getAttribute('type') || inp.tagName.toLowerCase(),
          name: inp.getAttribute('name') || inp.getAttribute('id') || '',
          placeholder: inp.getAttribute('placeholder') || '',
          h: Math.round(rect.height),
          w: Math.round(rect.width)
        };
      }).filter(f => f.w > 0 || f.h > 0);
    });
    console.log(`Form fields found: ${fields.length}`);
    fields.forEach(f => console.log(`  ${f.type} "${f.name}" ${f.w}x${f.h}px`));

    await page.close();
  } catch (err) {
    console.log(`ERROR: ${err.message.slice(0, 150)}`);
  }

  await browser.close();

  console.log('\n\n══════════════════════════════════════');
  console.log('         MOBILE QA SUMMARY            ');
  console.log('══════════════════════════════════════');

  const overflowIssues = issues.filter(i => i.type === 'horizontal_overflow');
  const touchIssues = issues.filter(i => i.type === 'touch_target');
  const imageIssues = issues.filter(i => i.type === 'image_overflow');
  const errors = issues.filter(i => i.type === 'error');

  console.log(`Horizontal overflow: ${overflowIssues.length === 0 ? 'PASS' : 'FAIL (' + overflowIssues.length + ' pages)'}`);
  console.log(`Touch targets <44px: ${touchIssues.length === 0 ? 'PASS' : 'FAIL (' + touchIssues.map(i => i.page).join(', ') + ')'}`);
  console.log(`Image overflow: ${imageIssues.length === 0 ? 'PASS' : 'FAIL'}`);
  console.log(`Page errors: ${errors.length === 0 ? 'PASS' : 'FAIL (' + errors.length + ')'}`);

  if (touchIssues.length > 0) {
    console.log('\nTouch target violations:');
    touchIssues.forEach(issue => {
      issue.items?.forEach(item => {
        console.log(`  [${issue.page}] <${item.tag}> "${item.text}" ${item.w}x${item.h}px — needs min-h-[44px] or py adjustment`);
      });
    });
  }

  console.log('\nISSUE_COUNT:' + issues.length);
}

run().catch(console.error);
