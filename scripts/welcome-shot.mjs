import { chromium } from "playwright";

const url = process.env.SHOT_URL || "http://localhost:3000/";
const out =
  process.env.SHOT_OUT ||
  "/home/bectly/development/projects/janicka-shop/docs/design/welcome-page-2026-05-04";

const breakpoints = [
  { name: "mobile", width: 390, height: 844 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1440, height: 900 },
];

const browser = await chromium.launch();
for (const bp of breakpoints) {
  const ctx = await browser.newContext({
    viewport: { width: bp.width, height: bp.height },
    deviceScaleFactor: 1,
  });
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForTimeout(2500);

  await page.screenshot({ path: `${out}/${bp.name}-fold.png`, fullPage: false });
  await page.screenshot({ path: `${out}/${bp.name}-full.png`, fullPage: true });
  await ctx.close();
  console.log(bp.name, "done");
}
await browser.close();
