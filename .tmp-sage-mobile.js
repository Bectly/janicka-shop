const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  // Mobile 404
  await page.goto('https://www.jvsatnik.cz/this-route-does-not-exist-12345', { waitUntil: 'networkidle', timeout: 25000 });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: 'docs/visual-qa/2026-05-03-bug-hunt/19b-404-fold-m.png' });
  const m404 = await page.evaluate(() => ({
    h1: document.querySelector('h1')?.textContent?.trim() || null,
    mainH: Math.round(document.querySelector('main')?.getBoundingClientRect().height || 0),
    mainTop: Math.round(document.querySelector('main')?.getBoundingClientRect().top || 0),
    bodyText: document.body.innerText.length,
  }));
  console.log('404m:', JSON.stringify(m404));

  // PDP mobile to confirm hydration
  const errs = [];
  page.on('pageerror', e => errs.push(e.message?.slice(0, 80)));
  await page.goto('https://www.jvsatnik.cz/products/letni-boty-na-klinku-graceland-vel-37', { waitUntil: 'networkidle', timeout: 25000 });
  await page.waitForTimeout(3500);
  await page.screenshot({ path: 'docs/visual-qa/2026-05-03-bug-hunt/03g-product-m-fresh.png' });
  const pdp = await page.evaluate(() => ({
    h1: document.querySelector('h1')?.textContent?.trim()?.slice(0,50) || null,
    mainH: Math.round(document.querySelector('main')?.getBoundingClientRect().height || 0),
    imgs: document.querySelectorAll('main img').length,
    addToCartBtn: false,
  }));
  console.log('PDPm:', JSON.stringify(pdp), 'errs:', JSON.stringify(errs.slice(0,2)));

  await browser.close();
})();
