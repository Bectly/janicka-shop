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

  await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 45000 });

  // Wait for main content to hydrate (hero section should appear)
  try {
    await page.waitForSelector('main section, body section', { timeout: 10000 });
  } catch {
    console.log(`[${vp.name}] WARNING: no section found after 10s`);
  }

  const domInfo = await page.evaluate(() => {
    // Find the hero section — it should be the first section on the page
    const allSections = Array.from(document.querySelectorAll('section'));
    const heroSection = allSections.find(s =>
      s.className.includes('max-h-hero') ||
      s.className.includes('min-h-') ||
      s.className.includes('overflow-hidden') && s.className.includes('bg-gradient')
    ) || allSections[0];

    if (!heroSection) {
      return {
        heroH: -1,
        heroClass: 'NOT FOUND',
        hasMaxH: false,
        hasMinH: false,
        sectionCount: allSections.length,
        bodySnippet: document.body.innerText.substring(0, 100),
      };
    }

    const rect = heroSection.getBoundingClientRect();
    const cls = heroSection.className;
    return {
      heroH: Math.round(rect.height),
      heroClass: cls.substring(0, 120),
      hasMaxH: cls.includes('max-h-hero'),
      hasMinH: cls.includes('min-h-['),
      sectionCount: allSections.length,
      bodySnippet: '',
    };
  });

  const screenshotPath = `${OUT_DIR}/${vp.name}.png`;
  await page.screenshot({ path: screenshotPath, fullPage: false });

  const criteria = CRITERIA[vp.name];
  // -1 means section not found — that's a fail unless server-side rendering
  const pass = domInfo.heroH > 0 ? domInfo.heroH <= criteria.maxHeroPx : false;

  results.push({
    viewport: vp.name,
    heroHeight: domInfo.heroH,
    maxAllowed: criteria.maxHeroPx,
    pass,
    hasMaxH: domInfo.hasMaxH,
    hasMinH: domInfo.hasMinH,
    heroClass: domInfo.heroClass,
    sectionCount: domInfo.sectionCount,
  });

  console.log(`[${vp.name}] hero=${domInfo.heroH}px max=${criteria.maxHeroPx}px ${pass ? 'PASS' : 'FAIL'} sections=${domInfo.sectionCount} max-h=${domInfo.hasMaxH} min-h=${domInfo.hasMinH}`);
  if (domInfo.heroClass) console.log(`  class: ${domInfo.heroClass}`);

  await ctx.close();
}

await browser.close();

console.log('\n=== SUMMARY ===');
for (const r of results) {
  const status = r.pass ? 'PASS' : 'FAIL';
  console.log(`${status} ${r.viewport}: hero=${r.heroHeight}px (max=${r.maxAllowed}px) sections=${r.sectionCount} has-max-h=${r.hasMaxH} has-min-h=${r.hasMinH}`);
}

const allPass = results.every(r => r.pass);
console.log(`\nOverall: ${allPass ? 'ALL PASS' : 'SOME FAIL'}`);
process.exit(allPass ? 0 : 1);
