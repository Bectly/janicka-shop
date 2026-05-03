const { chromium } = require('playwright');
const routes = [
  ['/', 'homepage'],
  ['/products', 'products-list'],
  ['/cart', 'cart'],
  ['/checkout', 'checkout'],
  ['/oblibene', 'wishlist'],
  ['/about', 'about'],
  ['/search?q=top', 'search-top'],
  ['/search?q=zzzzzzzz', 'search-noresults'],
  ['/this-route-does-not-exist-12345', '404'],
  ['/collections', 'collections'],
];
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  for (const [path, name] of routes) {
    try {
      const resp = await page.goto('https://www.jvsatnik.cz' + path, { waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForTimeout(2500);
      const data = await page.evaluate(() => {
        const main = document.querySelector('main');
        const r = main?.getBoundingClientRect();
        return {
          status: document.title,
          mainH: r ? Math.round(r.height) : null,
          mainChildren: main?.children.length || 0,
          h1: document.querySelector('h1')?.textContent?.trim()?.slice(0, 50) || null,
          imgs: document.querySelectorAll('main img').length,
          buttons: document.querySelectorAll('main button').length,
          links: document.querySelectorAll('main a').length,
        };
      });
      console.log(JSON.stringify({ path, name, http: resp?.status(), ...data }));
    } catch (e) {
      console.log(JSON.stringify({ path, name, err: e.message?.slice(0, 100) }));
    }
  }
  await browser.close();
})();
