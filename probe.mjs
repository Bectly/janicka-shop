import { chromium } from 'playwright';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
const p = await ctx.newPage();
await p.goto('https://jvsatnik.cz/',{waitUntil:'networkidle'});
// Check for service worker
const sw = await p.evaluate(() => navigator.serviceWorker?.controller?.scriptURL);
console.log('SW:',sw);
await p.evaluate(() => localStorage.setItem('janicka-cart', JSON.stringify({state:{items:[{productId:'s1',name:'Kus',slug:'t',price:450,size:'M',color:'m',image:null,stock:1}]},version:0})));
await p.goto('https://jvsatnik.cz/checkout',{waitUntil:'networkidle'});
await p.locator('button:has-text("Odmítnout")').first().click().catch(()=>{});
await p.waitForTimeout(500);
await p.evaluate(() => {const set=(i,v)=>{const e=document.getElementById(i);if(e){e.value=v;e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));}};set('firstName','Jana');set('lastName','Vankánová');set('email','vankanovajana@gmail.com');});
await p.waitForTimeout(300);
await p.locator('[data-checkout-step="0"] button:has-text("Pokračovat")').click({force:true});
await p.waitForTimeout(2000);

// Scroll to see step 2 shipping options in full
await p.evaluate(()=>{const el=document.querySelector('[data-checkout-step="1"]'); el?.scrollIntoView({block:'start'});});
await p.waitForTimeout(500);
await p.screenshot({path:'/tmp/f1_pickup.png', fullPage:false});

// NOW click "Zásilkovna — na adresu" home delivery  
await p.evaluate(() => {
  const labels = document.querySelectorAll('[data-checkout-step="1"] label');
  for (const lb of labels) if (lb.textContent?.includes('na adresu')) { lb.click(); return; }
});
await p.waitForTimeout(800);
await p.screenshot({path:'/tmp/f2_home.png', fullPage:false});

// Fill address fields
await p.evaluate(() => {const set=(i,v)=>{const e=document.getElementById(i);if(e){e.value=v;e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));}};set('phone','+420777123456');set('street','Jindřišská 789/123a');set('city','Praha 1');set('zip','11000');});
await p.waitForTimeout(500);
await p.screenshot({path:'/tmp/f3_home_filled.png', fullPage:false});

// Probe any current overflow
const ov = await p.evaluate(() => {
  const vw = window.innerWidth;
  const problems = [];
  document.querySelectorAll('[data-checkout-step="1"] *').forEach(el => {
    const r = el.getBoundingClientRect();
    if (r.right > vw + 1 && r.width > 30) {
      problems.push({tag:el.tagName, cls:(el.className?.toString?.()||'').slice(0,60), text:(el.textContent||'').trim().slice(0,40), l:r.left|0, r:r.right|0, w:r.width|0});
    }
  });
  return { vw, bodyScroll: document.body.scrollWidth, count: problems.length, top: problems.slice(0,6) };
});
console.log('CURRENT:', JSON.stringify(ov, null, 2));
await b.close();
