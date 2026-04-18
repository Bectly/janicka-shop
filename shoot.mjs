import { chromium } from "playwright";

const browser = await chromium.launch();
const base = "http://localhost:3000";

async function prep(ctx) {
  // Preload cookie-consent so banner doesn't appear
  await ctx.addInitScript(() => {
    try {
      localStorage.setItem(
        "janicka-cookie-consent",
        JSON.stringify({ necessary: true, analytics: true, marketing: true, timestamp: Date.now() })
      );
      document.cookie = "cookie-consent=1; path=/; max-age=31536000; SameSite=Lax";
    } catch {}
  });
}

async function shoot(viewport, path, clickFilter = false) {
  const ctx = await browser.newContext({ viewport });
  await prep(ctx);
  const page = await ctx.newPage();
  await page.goto(`${base}/products`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  if (clickFilter) {
    try {
      await page.getByRole("button", { name: /^Filtry/i }).first().click({ timeout: 3000 });
      await page.waitForTimeout(900);
    } catch (e) { console.log("no filter btn", e.message); }
  }
  await page.screenshot({ path, fullPage: !clickFilter });
  await ctx.close();
}

await shoot({ width: 1440, height: 1200 }, "/tmp/filter-desktop.png");
await shoot({ width: 375, height: 812 }, "/tmp/filter-mobile.png");
await shoot({ width: 375, height: 812 }, "/tmp/filter-drawer.png", true);

// Close-up of desktop sidebar
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1200 } });
await prep(ctx);
const page = await ctx.newPage();
await page.goto(`${base}/products`, { waitUntil: "networkidle" });
await page.waitForTimeout(1200);
const side = page.locator("aside").first();
await side.screenshot({ path: "/tmp/filter-sidebar.png" });
await ctx.close();

await browser.close();
console.log("done");
