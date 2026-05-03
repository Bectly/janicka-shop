const { chromium } = require('playwright');
const slugs = [
  'panska-zimni-bunda-cxs-vel-xs',
  'letni-boty-na-klinku-graceland-vel-37',
  'sportovni-boty-reebok-vel-37',
];
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  page.on('pageerror', e => console.log('PAGEERR:', e.message?.slice(0, 200)));
  page.on('console', m => { if (m.type() === 'error') console.log('CONSOLEERR:', m.text().slice(0, 200)); });
  for (const slug of slugs) {
    const resp = await page.goto('https://www.jvsatnik.cz/products/' + slug, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(3500);
    const data = await page.evaluate(() => ({
      h1: document.querySelector('h1')?.textContent?.trim()?.slice(0, 60) || null,
      mainH: Math.round(document.querySelector('main')?.getBoundingClientRect().height || 0),
      mainChildren: document.querySelector('main')?.children.length || 0,
      mainHTML: document.querySelector('main')?.innerHTML.length || 0,
      imgs: document.querySelectorAll('main img').length,
      buttons: document.querySelectorAll('main button').length,
      bodyText: (document.body.innerText || '').length,
    }));
    console.log(JSON.stringify({ slug, http: resp?.status(), ...data }));
  }
  await browser.close();
})();
