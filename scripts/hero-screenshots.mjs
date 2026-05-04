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

// Use prod URL since local dev server is in a contested state
const BASE_URL = 'https://jvsatnik.cz';

const browser = await chromium.launch({ headless: true });
const results = [];

for (const vp of VIEWPORTS) {
  const ctx = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: 1,
  });
  const page = await ctx.newPage();

  await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 45000 });

  // Wait for hydration
  await page.waitForTimeout(2000);

  const domInfo = await page.evaluate(() => {
    const allSections = Array.from(document.querySelectorAll('section'));
    // Hero is the first section with the hero gradient background
    const heroSection = allSections.find(s =>
      s.className.includes('max-h-hero') ||
      (s.className.includes('overflow-hidden') && s.className.includes('bg-gradient'))
    ) || allSections[0];

    if (!heroSection) {
      return { heroH: -1, heroClass: 'NOT_FOUND', hasMaxH: false, hasMinH: false, sectionCount: allSections.length };
    }

    const rect = heroSection.getBoundingClientRect();
    const cls = heroSection.className;
    return {
      heroH: Math.round(rect.height),
      heroClass: cls.substring(0, 150),
      hasMaxH: cls.includes('max-h-hero'),
      hasMinH: cls.includes('min-h-['),
      sectionCount: allSections.length,
    };
  });

  const screenshotPath = `${OUT_DIR}/${vp.name}.png`;
  await page.screenshot({ path: screenshotPath, fullPage: false });

  const criteria = CRITERIA[vp.name];
  const pass = domInfo.heroH > 0 && domInfo.heroH <= criteria.maxHeroPx;

  results.push({ viewport: vp.name, heroHeight: domInfo.heroH, maxAllowed: criteria.maxHeroPx, pass, hasMaxH: domInfo.hasMaxH, hasMinH: domInfo.hasMinH });
  console.log(`[${vp.name}] hero=${domInfo.heroH}px max=${criteria.maxHeroPx}px ${pass ? 'PASS' : 'FAIL'} has-max-h=${domInfo.hasMaxH} has-min-h=${domInfo.hasMinH}`);
  if (domInfo.heroClass) console.log(`  class: ${domInfo.heroClass}`);

  await ctx.close();
}

await browser.close();

console.log('\n=== SUMMARY ===');
for (const r of results) {
  console.log(`${r.pass ? 'PASS' : 'FAIL'} ${r.viewport}: hero=${r.heroHeight}px (max=${r.maxAllowed}px) has-max-h=${r.hasMaxH} has-min-h=${r.hasMinH}`);
}

const allPass = results.every(r => r.pass);
console.log(`\nOverall: ${allPass ? 'ALL PASS' : 'SOME FAIL'}`);
process.exit(allPass ? 0 : 1);
