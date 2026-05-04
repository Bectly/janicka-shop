import { chromium } from "playwright";

const VIEWPORTS = [
  { name: "320", width: 320, height: 850 },
  { name: "768", width: 768, height: 1024 },
  { name: "1280", width: 1280, height: 800 },
  { name: "1920", width: 1920, height: 1080 },
];

const URL = "http://localhost:3000/";
const OUT_DIR = "docs/design/hero-bento-2026-05-04";

const browser = await chromium.launch();
for (const vp of VIEWPORTS) {
  const ctx = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: 1,
  });
  const page = await ctx.newPage();
  await page.goto(URL, { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(800);

  const foldPath = `${OUT_DIR}/${vp.name}-fold.png`;
  await page.screenshot({ path: foldPath, fullPage: false });
  console.log(`saved ${foldPath}`);

  const fullPath = `${OUT_DIR}/${vp.name}-full.png`;
  await page.screenshot({ path: fullPath, fullPage: true });
  console.log(`saved ${fullPath}`);

  await ctx.close();
}
await browser.close();
console.log("done");
