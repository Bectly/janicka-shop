const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto('https://janicka-shop.vercel.app/soukromi', { waitUntil: 'networkidle', timeout: 30000 });
  const content = await page.content();
  const textContent = await page.locator('body').textContent();
  
  // Count Vinted
  const vintedInSource = (content.match(/Vinted/g) || []).length;
  const vintedInText = (textContent.match(/Vinted/g) || []).length;
  console.log(`Vinted in source HTML: ${vintedInSource}`);
  console.log(`Vinted in visible text: ${vintedInText}`);
  
  // Get H1
  const h1 = await page.locator('h1').first().textContent().catch(() => '');
  console.log(`H1: ${h1}`);
  
  // First 2000 chars of body text
  console.log('\nBody text excerpt:\n' + textContent.substring(0, 2000));
  
  await browser.close();
})();
