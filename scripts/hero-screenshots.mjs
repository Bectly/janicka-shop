import { chromium } from 'playwright';
import { existsSync, mkdirSync } from 'fs';

const OUT_DIR = '/home/bectly/development/projects/janicka-shop/docs/design/hero-fix-2026-05-04';
if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

const VIEWPORTS = [
  { name: '320x568',   width: 320,  height: 568  },
  { name: '768x1024',  width: 768,  height: 1024 },
  { name: '1280x800',  width: 1280, height: 800  },
  { name: '1920x1080', width: 1920, height: 1080 },
];

const CRITERIA = {
  '320x568':   { maxHeroPx: 230 },
  '768x1024':  { maxHeroPx: 410 },
  '1280x800':  { maxHeroPx: 360 },
  '1920x1080': { maxHeroPx: 486 },
};

const BASE_URL = 'http://localhost:3000';

const browser = await chromium.launch({ headless: true });
const results = [];

for (const vp of VIEWPORTS) {
  const ctx = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: 1,
  });
  const page = await ctx.newPage();

  await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 });

  const heroHeight = await page.evaluate(() => {
    const hero = document.querySelector('section');
    if (!hero) return -1;
    return hero.getBoundingClientRect().height;
  });

  const hasMaxH = await page.evaluate(() => {
    const hero = document.querySelector('section');
    if (!hero) return false;
    return hero.className.includes('max-h-hero');
  });

  const hasMinH = await page.evaluate(() => {
    const hero = document.querySelector('section');
    if (!hero) return false;
    return hero.className.includes('min-h-[');
  });

  const screenshotPath = `${OUT_DIR}/${vp.name}.png`;
  await page.screenshot({ path: screenshotPath, fullPage: false });

  const criteria = CRITERIA[vp.name];
  const pass = heroHeight <= criteria.maxHeroPx;

  results.push({ viewport: vp.name, heroHeight: Math.round(heroHeight), maxAllowed: criteria.maxHeroPx, pass, hasMaxH, hasMinH });
  console.log(`[${vp.name}] hero=${Math.round(heroHeight)}px max=${criteria.maxHeroPx}px ${pass ? 'PASS' : 'FAIL'} max-h=${hasMaxH} min-h=${hasMinH}`);

  await ctx.close();
}

await browser.close();

console.log('\n=== SUMMARY ===');
for (const r of results) {
  const status = r.pass ? 'PASS' : 'FAIL';
  console.log(`${status} ${r.viewport}: hero=${r.heroHeight}px (max=${r.maxAllowed}px) has-max-h=${r.hasMaxH} has-min-h=${r.hasMinH}`);
}

const allPass = results.every(r => r.pass);
console.log(`\nOverall: ${allPass ? 'ALL PASS' : 'SOME FAIL'}`);
process.exit(allPass ? 0 : 1);
