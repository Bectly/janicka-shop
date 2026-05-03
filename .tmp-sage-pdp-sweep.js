const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto('https://www.jvsatnik.cz/products', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  const slugs = await page.evaluate(() => Array.from(document.querySelectorAll('a[href^="/products/"]')).map(a => a.getAttribute('href')).filter(h => h !== '/products' && h !== '/products/').slice(0, 12));
  console.log('SLUGS_COUNT', slugs.length);
  const broken = [];
  for (const href of slugs) {
    const errs = [];
    page.removeAllListeners('pageerror');
    page.on('pageerror', e => errs.push(e.message?.slice(0, 80)));
    await page.goto('https://www.jvsatnik.cz' + href, { waitUntil: 'networkidle', timeout: 25000 });
    await page.waitForTimeout(2500);
    const h = await page.evaluate(() => Math.round(document.querySelector('main')?.getBoundingClientRect().height || 0));
    const empty = h < 500;
    if (empty || errs.length) console.log(JSON.stringify({ href, mainH: h, empty, errs: errs.slice(0, 2) }));
    if (empty) broken.push(href);
  }
  console.log('BROKEN_TOTAL', broken.length, '/', slugs.length);
  console.log('BROKEN_LIST', JSON.stringify(broken));
  await browser.close();
})();
