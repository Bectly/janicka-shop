/**
 * Vinted Profile Scraper — Migrate products from Vinted to Janička Shop
 *
 * Scrapes ALL products from a Vinted member profile including:
 * - Title, description, price, brand, size, condition, color, category
 * - ALL photos (downloaded to local directory)
 * - Material, measurements if available
 *
 * Uses Playwright with Chromium to handle Vinted's JS-rendered pages.
 * Requires login session — uses Flatpak Chrome cookies or manual login.
 *
 * Usage:
 *   npx tsx scripts/scrape-vinted.ts
 *
 * Output:
 *   scripts/vinted-data/products.json  — all product data
 *   scripts/vinted-data/images/        — downloaded product photos
 */

import { chromium, type Page, type Browser } from "playwright";
import * as fs from "fs";
import * as path from "path";

// --- Config ---
const MEMBER_URL = "https://www.vinted.cz/member/149371637";
const OUTPUT_DIR = path.join(__dirname, "vinted-data");
const IMAGES_DIR = path.join(OUTPUT_DIR, "images");
const PRODUCTS_FILE = path.join(OUTPUT_DIR, "products.json");
const DELAY_MS = 2000; // between page loads to avoid rate limiting
const MAX_RETRIES = 3;

interface VintedProduct {
  vintedId: string;
  url: string;
  title: string;
  description: string;
  price: number;
  currency: string;
  originalPrice: number | null;
  brand: string;
  size: string;
  condition: string;
  color: string[];
  category: string;
  material: string;
  measurements: string;
  views: number;
  favorites: number;
  uploadedAt: string;
  photos: string[]; // local file paths after download
  photoUrls: string[]; // original Vinted URLs
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function downloadImage(
  url: string,
  filepath: string,
  retries = MAX_RETRIES
): Promise<boolean> {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const buffer = Buffer.from(await response.arrayBuffer());
      fs.writeFileSync(filepath, buffer);
      return true;
    } catch (e) {
      if (attempt === retries - 1) {
        console.error(`  Failed to download ${url}: ${e}`);
        return false;
      }
      await sleep(1000);
    }
  }
  return false;
}

async function collectProductUrls(page: Page): Promise<string[]> {
  console.log("Navigating to member profile...");
  await page.goto(MEMBER_URL, { waitUntil: "networkidle", timeout: 30000 });

  // Accept cookies if banner appears
  try {
    const cookieBtn = page.locator(
      '[data-testid="cookie-consent-banner-accept"]'
    );
    if (await cookieBtn.isVisible({ timeout: 3000 })) {
      await cookieBtn.click();
      await sleep(1000);
    }
  } catch {
    // No cookie banner
  }

  // Scroll to load all items (Vinted uses infinite scroll)
  let previousCount = 0;
  let sameCountAttempts = 0;

  while (sameCountAttempts < 5) {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await sleep(1500);

    const currentCount = await page
      .locator('[data-testid="catalog-grid"] a[href*="/items/"]')
      .count()
      .catch(() => 0);

    // Also try alternative selectors
    const altCount = await page
      .locator(
        '.feed-grid a[href*="/items/"], .catalog-grid a[href*="/items/"], a[href*="/items/"][class*="ItemBox"]'
      )
      .count()
      .catch(() => 0);

    const count = Math.max(currentCount, altCount);
    console.log(`  Loaded ${count} items so far...`);

    if (count === previousCount) {
      sameCountAttempts++;
    } else {
      sameCountAttempts = 0;
    }
    previousCount = count;
  }

  // Extract all product URLs
  const urls = await page.evaluate(() => {
    const links = document.querySelectorAll('a[href*="/items/"]');
    const uniqueUrls = new Set<string>();
    links.forEach((link) => {
      const href = (link as HTMLAnchorElement).href;
      if (href && href.includes("/items/")) {
        // Normalize URL
        const url = new URL(href);
        uniqueUrls.add(`${url.origin}${url.pathname}`);
      }
    });
    return Array.from(uniqueUrls);
  });

  console.log(`Found ${urls.length} product URLs`);
  return urls;
}

async function scrapeProductDetail(
  page: Page,
  url: string,
  index: number
): Promise<VintedProduct | null> {
  console.log(`\n[${index}] Scraping: ${url}`);

  try {
    await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
    await sleep(500);

    // Extract product data from the page
    const data = await page.evaluate(() => {
      const getText = (selector: string): string => {
        const el = document.querySelector(selector);
        return el?.textContent?.trim() || "";
      };

      const getTexts = (selector: string): string[] => {
        return Array.from(document.querySelectorAll(selector)).map(
          (el) => el.textContent?.trim() || ""
        );
      };

      // Title
      const title =
        getText('[data-testid="item-title"]') ||
        getText('[itemprop="name"]') ||
        getText("h2.web_ui__Text__title") ||
        getText(".item-title") ||
        "";

      // Description
      const description =
        getText('[data-testid="item-description"]') ||
        getText('[itemprop="description"]') ||
        getText(".item-description") ||
        "";

      // Price
      const priceText =
        getText('[data-testid="item-price"]') ||
        getText('[itemprop="price"]') ||
        getText(".item-price") ||
        "0";
      const price = parseFloat(priceText.replace(/[^\d.,]/g, "").replace(",", ".")) || 0;

      // Brand
      const brand =
        getText('[data-testid="item-details-brand"]') ||
        getText('[itemprop="brand"]') ||
        getText('.details-list--brand a') ||
        "";

      // Size
      const size =
        getText('[data-testid="item-details-size"]') ||
        getText('[itemprop="size"]') ||
        getText('.details-list--size') ||
        "";

      // Condition
      const condition =
        getText('[data-testid="item-details-condition"]') ||
        getText('.details-list--condition') ||
        "";

      // Color
      const colorEls =
        getTexts('[data-testid="item-details-color"]') ||
        getTexts('.details-list--color a');
      const color = colorEls.length > 0 ? colorEls : [];

      // Category
      const categoryBreadcrumbs = getTexts(
        '[data-testid="item-breadcrumbs"] a, .breadcrumbs a'
      );
      const category =
        categoryBreadcrumbs.length > 1
          ? categoryBreadcrumbs.slice(1).join(" > ")
          : "";

      // Material
      const material =
        getText('[data-testid="item-details-material"]') ||
        getText('.details-list--material') ||
        "";

      // Views & favorites
      const statsText =
        getText('[data-testid="item-statistics"]') ||
        getText(".item-statistic") ||
        "";
      const viewsMatch = statsText.match(/(\d+)\s*(?:zobrazení|views)/i);
      const favsMatch = statsText.match(
        /(\d+)\s*(?:oblíbené|favorites|hearts)/i
      );

      // Upload date
      const uploadedAt =
        getText('[data-testid="item-details-uploaded"]') ||
        getText(".details-list--uploaded") ||
        "";

      // Photo URLs — get ALL full-size images
      const photoUrls: string[] = [];

      // Try multiple selectors for images
      const imgSelectors = [
        '[data-testid="item-photo"] img',
        '[data-testid="item-gallery"] img',
        ".item-photos img",
        ".item-gallery img",
        'img[src*="images.vinted"]',
        'img[src*="vinted"]',
      ];

      for (const selector of imgSelectors) {
        document.querySelectorAll(selector).forEach((img) => {
          const src =
            (img as HTMLImageElement).src ||
            img.getAttribute("data-src") ||
            "";
          if (src && !photoUrls.includes(src)) {
            // Try to get full-size URL (remove size params)
            const fullSrc = src
              .replace(/\/f\d+x\d+\//, "/f800x800/")
              .replace(/\?.*$/, "");
            photoUrls.push(fullSrc);
          }
        });
      }

      // Also check srcset for higher-res versions
      document.querySelectorAll("img[srcset]").forEach((img) => {
        const srcset = img.getAttribute("srcset") || "";
        const urls = srcset
          .split(",")
          .map((s) => s.trim().split(" ")[0])
          .filter((u) => u.includes("vinted"));
        urls.forEach((u) => {
          if (!photoUrls.includes(u)) photoUrls.push(u);
        });
      });

      return {
        title,
        description,
        price,
        brand,
        size,
        condition,
        color,
        category,
        material,
        views: viewsMatch ? parseInt(viewsMatch[1]) : 0,
        favorites: favsMatch ? parseInt(favsMatch[1]) : 0,
        uploadedAt,
        photoUrls,
      };
    });

    // Try to also intercept the API response for richer data
    // Vinted loads item data via XHR — check for JSON-LD too
    const jsonLd = await page
      .evaluate(() => {
        const script = document.querySelector(
          'script[type="application/ld+json"]'
        );
        if (script) {
          try {
            return JSON.parse(script.textContent || "{}");
          } catch {
            return null;
          }
        }
        return null;
      })
      .catch(() => null);

    // Merge JSON-LD data if available
    if (jsonLd) {
      if (!data.title && jsonLd.name) data.title = jsonLd.name;
      if (!data.description && jsonLd.description)
        data.description = jsonLd.description;
      if (!data.price && jsonLd.offers?.price)
        data.price = parseFloat(jsonLd.offers.price);
      if (!data.brand && jsonLd.brand?.name) data.brand = jsonLd.brand.name;
      if (jsonLd.image) {
        const images = Array.isArray(jsonLd.image)
          ? jsonLd.image
          : [jsonLd.image];
        images.forEach((img: string) => {
          if (!data.photoUrls.includes(img)) data.photoUrls.push(img);
        });
      }
    }

    // Extract Vinted ID from URL
    const vintedIdMatch = url.match(/\/items\/(\d+)/);
    const vintedId = vintedIdMatch ? vintedIdMatch[1] : "";

    // Download photos
    const photos: string[] = [];
    const productImagesDir = path.join(IMAGES_DIR, vintedId || `product-${index}`);
    fs.mkdirSync(productImagesDir, { recursive: true });

    for (let i = 0; i < data.photoUrls.length; i++) {
      const ext = data.photoUrls[i].match(/\.(jpe?g|png|webp)/i)?.[1] || "jpg";
      const filename = `${i + 1}.${ext}`;
      const filepath = path.join(productImagesDir, filename);

      const success = await downloadImage(data.photoUrls[i], filepath);
      if (success) {
        photos.push(filepath);
        console.log(`  Downloaded photo ${i + 1}/${data.photoUrls.length}`);
      }
    }

    const product: VintedProduct = {
      vintedId,
      url,
      title: data.title,
      description: data.description,
      price: data.price,
      currency: "CZK",
      originalPrice: null,
      brand: data.brand,
      size: data.size,
      condition: data.condition,
      color: data.color,
      category: data.category,
      material: data.material,
      measurements: "",
      views: data.views,
      favorites: data.favorites,
      uploadedAt: data.uploadedAt,
      photos,
      photoUrls: data.photoUrls,
    };

    console.log(
      `  OK: "${product.title}" | ${product.price} CZK | ${product.photos.length} photos`
    );
    return product;
  } catch (e) {
    console.error(`  ERROR scraping ${url}: ${e}`);
    return null;
  }
}

async function main() {
  // Create output directories
  fs.mkdirSync(IMAGES_DIR, { recursive: true });

  console.log("=== Vinted Profile Scraper ===");
  console.log(`Target: ${MEMBER_URL}`);
  console.log(`Output: ${OUTPUT_DIR}`);
  console.log();

  // Launch browser — try to use existing Chrome session for auth
  // Flatpak Chrome profile: ~/.var/app/com.google.Chrome/config/google-chrome/
  const userDataDir =
    process.env.CHROME_USER_DATA ||
    `${process.env.HOME}/.var/app/com.google.Chrome/config/google-chrome`;

  let browser: Browser;
  let usingProfile = false;

  try {
    // Try launching with Chrome profile for auth cookies
    browser = await chromium.launchPersistentContext(userDataDir, {
      headless: true,
      channel: "chromium",
      args: [
        "--no-sandbox",
        "--disable-blink-features=AutomationControlled",
        "--disable-dev-shm-usage",
      ],
    }) as unknown as Browser;
    usingProfile = true;
    console.log("Using Chrome profile for authentication");
  } catch {
    // Fallback: launch fresh browser — may need manual login
    console.log(
      "Could not use Chrome profile, launching fresh browser..."
    );
    console.log(
      "NOTE: You may need to log in to Vinted manually if scraping fails."
    );
    browser = await chromium.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-blink-features=AutomationControlled",
      ],
    });
  }

  const context = usingProfile
    ? (browser as any)
    : await browser.newContext({
        userAgent:
          "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        viewport: { width: 1920, height: 1080 },
        locale: "cs-CZ",
      });

  const page = usingProfile ? await (context as any).newPage() : await context.newPage();

  try {
    // Step 1: Collect all product URLs from profile
    const productUrls = await collectProductUrls(page);

    if (productUrls.length === 0) {
      console.error(
        "No products found! The page might require login or have a different structure."
      );
      console.log("Taking debug screenshot...");
      await page.screenshot({
        path: path.join(OUTPUT_DIR, "debug-screenshot.png"),
      });
      return;
    }

    // Step 2: Scrape each product detail page
    const products: VintedProduct[] = [];
    let failed = 0;

    // Load existing progress if any (resume support)
    const existingProducts: VintedProduct[] = [];
    if (fs.existsSync(PRODUCTS_FILE)) {
      try {
        const existing = JSON.parse(fs.readFileSync(PRODUCTS_FILE, "utf-8"));
        existingProducts.push(...existing);
        console.log(
          `\nResuming: ${existingProducts.length} products already scraped`
        );
      } catch {
        // Corrupted file, start fresh
      }
    }

    const existingUrls = new Set(existingProducts.map((p) => p.url));
    products.push(...existingProducts);

    for (let i = 0; i < productUrls.length; i++) {
      if (existingUrls.has(productUrls[i])) {
        console.log(`[${i + 1}/${productUrls.length}] Already scraped, skipping`);
        continue;
      }

      const product = await scrapeProductDetail(
        page,
        productUrls[i],
        i + 1
      );

      if (product) {
        products.push(product);
      } else {
        failed++;
      }

      // Save progress after each product (crash recovery)
      fs.writeFileSync(PRODUCTS_FILE, JSON.stringify(products, null, 2));

      // Rate limiting delay
      if (i < productUrls.length - 1) {
        await sleep(DELAY_MS);
      }
    }

    // Final save
    fs.writeFileSync(PRODUCTS_FILE, JSON.stringify(products, null, 2));

    console.log("\n=== SCRAPING COMPLETE ===");
    console.log(`Total products: ${products.length}`);
    console.log(`Failed: ${failed}`);
    console.log(`Photos downloaded: ${products.reduce((sum, p) => sum + p.photos.length, 0)}`);
    console.log(`Output: ${PRODUCTS_FILE}`);
    console.log(`Images: ${IMAGES_DIR}`);
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
