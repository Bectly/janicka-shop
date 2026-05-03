const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto('https://www.jvsatnik.cz/products/panska-zimni-bunda-cxs-vel-xs', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(3000);
  // Try dismissing cookie banner
  try { await page.click('button:has-text("Přijmout vše")', { timeout: 3000 }); } catch {}
  await page.waitForTimeout(2000);
  // Probe DOM
  const data = await page.evaluate(() => {
    const h1 = document.querySelector('h1');
    const main = document.querySelector('main');
    const imgs = Array.from(document.querySelectorAll('main img')).slice(0,3).map(i => ({src: i.src.slice(0,80), w: i.naturalWidth, h: i.naturalHeight, vis: getComputedStyle(i).visibility, op: getComputedStyle(i).opacity}));
    const buttons = Array.from(document.querySelectorAll('main button')).map(b => b.textContent?.trim().slice(0,40));
    return {
      h1: h1?.textContent || null,
      mainHeight: main?.getBoundingClientRect().height,
      mainChildren: main?.children.length,
      imgs,
      buttons: buttons.slice(0, 10),
    };
  });
  console.log(JSON.stringify(data, null, 2));
  await page.screenshot({ path: '/tmp/sage-fresh/product-after-dismiss-d.png', fullPage: false });
  await browser.close();
})();
