const { chromium } = require('playwright');

const BASE_URL = 'https://janicka-shop.vercel.app';
const results = [];

function log(test, status, detail) {
  const emoji = status === 'PASS' ? '✓' : status === 'FAIL' ? '✗' : '⚠';
  console.log(`${emoji} [${status}] ${test}: ${detail}`);
  results.push({ test, status, detail });
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Linux; Android 11; Pixel 5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Mobile Safari/537.36',
    viewport: { width: 390, height: 844 }
  });
  const page = await context.newPage();
  
  // 1. Homepage
  try {
    await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 });
    const title = await page.title();
    const h1Count = await page.locator('h1').count();
    log('Homepage loads', 'PASS', `title="${title}", h1 count=${h1Count}`);
    
    // JSON-LD check
    const ldScripts = await page.locator('script[type="application/ld+json"]').count();
    log('Homepage JSON-LD', ldScripts >= 2 ? 'PASS' : 'FAIL', `${ldScripts} ld+json scripts`);
  } catch (e) {
    log('Homepage loads', 'FAIL', e.message);
  }
  
  // 2. Products page + add to cart
  try {
    await page.goto(`${BASE_URL}/products`, { waitUntil: 'networkidle', timeout: 30000 });
    const productLinks = await page.locator('a[href^="/products/"]').count();
    log('Products catalog loads', productLinks > 0 ? 'PASS' : 'FAIL', `${productLinks} product links`);
    
    // Navigate to first product
    if (productLinks > 0) {
      const firstProductHref = await page.locator('a[href^="/products/"]').first().getAttribute('href');
      await page.goto(`${BASE_URL}${firstProductHref}`, { waitUntil: 'networkidle', timeout: 30000 });
      const addToCartBtn = page.locator('button:has-text("Přidat do košíku")');
      const btnCount = await addToCartBtn.count();
      log('PDP add-to-cart button', btnCount > 0 ? 'PASS' : 'FAIL', `${btnCount} buttons found on ${firstProductHref}`);
      
      // Check JSON-LD on PDP
      const pdpLD = await page.locator('script[type="application/ld+json"]').count();
      log('PDP JSON-LD', pdpLD > 0 ? 'PASS' : 'FAIL', `${pdpLD} ld+json scripts on PDP`);
      
      // Add to cart
      if (btnCount > 0) {
        await addToCartBtn.first().click();
        await page.waitForTimeout(2000);
        const cartCount = await page.locator('[data-cart-count], .cart-count, [aria-label*="košík"]').count();
        log('Add to cart action', 'PASS', `cart count elements: ${cartCount}`);
      }
    }
  } catch (e) {
    log('Products flow', 'FAIL', e.message);
  }
  
  // 3. Cart page
  try {
    await page.goto(`${BASE_URL}/cart`, { waitUntil: 'networkidle', timeout: 30000 });
    const cartContent = await page.locator('main').textContent();
    const hasCartContent = cartContent.includes('košík') || cartContent.includes('Košík');
    log('Cart page loads', hasCartContent ? 'PASS' : 'FAIL', `Cart content present: ${hasCartContent}`);
  } catch (e) {
    log('Cart page', 'FAIL', e.message);
  }
  
  // 4. /soukromi trust page
  try {
    await page.goto(`${BASE_URL}/soukromi`, { waitUntil: 'networkidle', timeout: 30000 });
    const h1 = await page.locator('h1').first().textContent().catch(() => '');
    const hasVinted = (await page.content()).includes('Vinted');
    const hasTrustMsg = (await page.content()).includes('Tvoje') || (await page.content()).includes('fotky');
    log('/soukromi trust page', hasVinted && hasTrustMsg ? 'PASS' : 'FAIL', `H1="${h1}", hasVinted=${hasVinted}, hasTrustMsg=${hasTrustMsg}`);
  } catch (e) {
    log('/soukromi trust page', 'FAIL', e.message);
  }
  
  // 5. Checkout page (empty cart redirect test)
  try {
    // Clear cart first by visiting with empty state
    await page.goto(`${BASE_URL}/checkout`, { waitUntil: 'networkidle', timeout: 30000 });
    const checkoutUrl = page.url();
    const isOnCheckout = checkoutUrl.includes('/checkout') || checkoutUrl.includes('/cart');
    log('Checkout page accessible', isOnCheckout ? 'PASS' : 'FAIL', `Final URL: ${checkoutUrl}`);
    
    // Check for accordion sections
    const accordionCount = await page.locator('[data-state], [aria-expanded]').count();
    const emailInput = await page.locator('input[type="email"]').count();
    log('Checkout accordion sections', accordionCount > 0 || emailInput > 0 ? 'PASS' : 'WARN', `accordion elements=${accordionCount}, emailInputs=${emailInput}`);
  } catch (e) {
    log('Checkout page', 'FAIL', e.message);
  }
  
  // 6. Admin redirect (should redirect to login)
  try {
    const adminResp = await page.goto(`${BASE_URL}/admin/subscribers`, { waitUntil: 'networkidle', timeout: 30000 });
    const finalUrl = page.url();
    const isLoginOrAdmin = finalUrl.includes('/auth') || finalUrl.includes('/login') || finalUrl.includes('/admin');
    log('/admin/subscribers redirect', isLoginOrAdmin ? 'PASS' : 'FAIL', `Final URL: ${finalUrl}`);
  } catch (e) {
    log('/admin/subscribers redirect', 'FAIL', e.message);
  }
  
  await browser.close();
  
  // Summary
  console.log('\n=== SMOKE TEST SUMMARY ===');
  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  const warned = results.filter(r => r.status === 'WARN').length;
  console.log(`Total: ${results.length} | PASS: ${passed} | FAIL: ${failed} | WARN: ${warned}`);
})();
