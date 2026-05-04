/**
 * Hero trim verification — captures homepage hero at 4 viewports,
 * measures section height vs viewport height, fails if any > 65%.
 *
 * Usage: node scripts/hero-trim-verify.mjs [base-url]
 * Defaults: base-url=http://localhost:3000
 */

import { chromium } from "playwright";
import { mkdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");

const baseUrl = process.argv[2] || "http://localhost:3000";
const outputDir = resolve(projectRoot, "docs/audits/visual-audit-2026-05-04");
mkdirSync(outputDir, { recursive: true });

const VIEWPORTS = [
  { name: "mobile", width: 390, height: 844 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "laptop", width: 1440, height: 900 },
  { name: "desktop", width: 1920, height: 1080 },
];

const MAX_RATIO = 0.65;

async function run() {
  const browser = await chromium.launch();
  const results = [];
  let anyFail = false;

  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    const page = await ctx.newPage();
    await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(4000);

    const heroBox = await page.evaluate(() => {
      const sections = Array.from(document.querySelectorAll("section"));
      const hero = sections.find((s) => (s.className || "").includes("vh]"));
      if (!hero) return null;
      const r = hero.getBoundingClientRect();
      return { height: r.height, top: r.top };
    });

    const ratio = heroBox ? heroBox.height / vp.height : null;
    const fail = ratio === null || ratio > MAX_RATIO;
    if (fail) anyFail = true;

    const filename = `hero-trim-2-${vp.name}.png`;
    await page.screenshot({ path: resolve(outputDir, filename) });

    const verdict = fail ? "FAIL" : "PASS";
    const ratioStr = ratio === null ? "n/a" : `${(ratio * 100).toFixed(1)}%`;
    console.log(`[${verdict}] ${vp.name} ${vp.width}x${vp.height} hero=${heroBox?.height?.toFixed(0)}px ratio=${ratioStr} -> ${filename}`);
    results.push({ ...vp, heroHeight: heroBox?.height, ratio, fail });

    await ctx.close();
  }

  await browser.close();

  console.log("\nSummary:");
  console.table(results.map((r) => ({
    viewport: r.name,
    size: `${r.width}x${r.height}`,
    heroPx: r.heroHeight ? Math.round(r.heroHeight) : "—",
    ratio: r.ratio ? `${(r.ratio * 100).toFixed(1)}%` : "—",
    verdict: r.fail ? "FAIL" : "PASS",
  })));

  process.exit(anyFail ? 1 : 0);
}

run().catch((e) => {
  console.error(e);
  process.exit(2);
});
