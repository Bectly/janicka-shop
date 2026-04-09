/**
 * Vinted Profile Scraper — Migrate products from Vinted to Janička Shop
 *
 * Uses Playwright to:
 * 1. Navigate to the member profile page
 * 2. Intercept Vinted's internal API responses (structured JSON data)
 * 3. Scroll to trigger pagination and capture all items
 * 4. Download all product photos at full resolution (f1600x1600)
 *
 * This approach is much more reliable than DOM scraping because:
 * - Vinted renders products entirely client-side (no SSR product data)
 * - API responses contain rich structured data (brand, size, condition, etc.)
 * - Photo URLs are available in multiple resolutions
 *
 * Usage:
 *   npx tsx scripts/scrape-vinted.ts
 *
 * Output:
 *   scripts/vinted-data/products.json  — all product data
 *   scripts/vinted-data/images/        — downloaded product photos (f1600x1600)
 */

import { chromium, type Page, type BrowserContext } from "playwright";
import * as fs from "fs";
import * as path from "path";

// --- Config ---
const MEMBER_ID = "149371637";
const MEMBER_URL = `https://www.vinted.cz/member/${MEMBER_ID}`;
const OUTPUT_DIR = path.join(__dirname, "vinted-data");
const IMAGES_DIR = path.join(OUTPUT_DIR, "images");
const PRODUCTS_FILE = path.join(OUTPUT_DIR, "products.json");
const RAW_API_FILE = path.join(OUTPUT_DIR, "raw-api-responses.json");
const DELAY_MS = 2000; // between page loads for detail pages
const MAX_RETRIES = 3;
const PHOTO_RESOLUTION = "f1600x1600"; // highest quality

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
  photoUrls: string[]; // original Vinted URLs (full res)
  status: string;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function downloadImage(
  url: string,
  filepath: string,
  retries = MAX_RETRIES
): Promise<boolean> {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
          Referer: "https://www.vinted.cz/",
        },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const buffer = Buffer.from(await response.arrayBuffer());
      fs.writeFileSync(filepath, buffer);
      return true;
    } catch (e) {
      if (attempt === retries - 1) {
        console.error(`  Failed to download ${url}: ${e}`);
        return false;
      }
      await sleep(1000 * (attempt + 1));
    }
  }
  return false;
}

/**
 * Convert a Vinted photo URL to full resolution.
 * Vinted URLs look like: https://images1.vinted.net/t/{hash}/{size}/{id}.webp?s=...
 * We replace the size segment with f1600x1600 for max quality.
 */
function toFullResUrl(url: string): string {
  // Replace any resolution pattern like /310x310/, /f800x800/, /150x150/ etc.
  return url.replace(/\/(?:f?\d+x\d+)\//, `/${PHOTO_RESOLUTION}/`);
}

/**
 * Extract item data from Vinted's API response format.
 * Vinted's internal API returns items in a specific structure.
 */
function parseApiItem(item: any): Partial<VintedProduct> | null {
  try {
    const vintedId = String(item.id || "");
    if (!vintedId) return null;

    // Extract photo URLs
    const photoUrls: string[] = [];
    if (item.photos && Array.isArray(item.photos)) {
      for (const photo of item.photos) {
        const url =
          photo.full_size_url ||
          photo.url ||
          photo.thumbnails?.[0]?.url ||
          "";
        if (url) {
          photoUrls.push(toFullResUrl(url));
        }
      }
    } else if (item.photo) {
      // Single photo from list view
      const url =
        item.photo.full_size_url ||
        item.photo.url ||
        item.photo.thumbnails?.[0]?.url ||
        "";
      if (url) photoUrls.push(toFullResUrl(url));
    }

    // Extract colors
    const colors: string[] = [];
    if (item.color1) colors.push(item.color1);
    if (item.color2) colors.push(item.color2);

    return {
      vintedId,
      url: `https://www.vinted.cz/items/${vintedId}`,
      title: item.title || "",
      description: item.description || "",
      price: parseFloat(item.price?.amount || item.price || "0"),
      currency: item.price?.currency_code || item.currency || "CZK",
      originalPrice: item.original_price?.amount
        ? parseFloat(item.original_price.amount)
        : null,
      brand: item.brand_dto?.title || item.brand?.title || item.brand_title || "",
      size: item.size_title || item.size?.title || "",
      condition:
        item.status?.replace(/_/g, " ") ||
        item.disposal_conditions?.toString() ||
        "",
      color: colors,
      category:
        item.catalog_id?.toString() ||
        item.category?.title ||
        "",
      material: item.material?.title || "",
      measurements: "",
      views: item.view_count || 0,
      favorites: item.favourite_count || item.favorite_count || 0,
      uploadedAt: item.created_at_ts
        ? new Date(item.created_at_ts * 1000).toISOString()
        : item.created_at || "",
      photoUrls,
      status: item.status || "active",
    };
  } catch (e) {
    console.error(`  Error parsing item: ${e}`);
    return null;
  }
}

/**
 * Strategy 1: Intercept API responses while browsing the profile page.
 * Vinted's frontend fetches items via internal API calls.
 */
async function scrapeViaNetworkInterception(
  context: BrowserContext
): Promise<Map<string, Partial<VintedProduct>>> {
  const items = new Map<string, Partial<VintedProduct>>();
  const rawResponses: any[] = [];
  const page = await context.newPage();

  // Set up response interception BEFORE navigating
  page.on("response", async (response) => {
    const url = response.url();

    // Capture user items API responses
    if (
      url.includes("/api/v2/users/") &&
      url.includes("/items") &&
      response.status() === 200
    ) {
      try {
        const json = await response.json();
        rawResponses.push({ url, data: json });

        const itemsList =
          json.items || json.user_items || json.data?.items || [];
        if (Array.isArray(itemsList)) {
          for (const item of itemsList) {
            const parsed = parseApiItem(item);
            if (parsed?.vintedId) {
              items.set(parsed.vintedId, parsed);
            }
          }
          console.log(
            `  Captured ${itemsList.length} items from API (total: ${items.size})`
          );
        }
      } catch {
        // Not JSON or parse error — skip
      }
    }

    // Also capture individual item detail responses
    if (
      url.match(/\/api\/v2\/items\/\d+/) &&
      !url.includes("/items/") &&
      response.status() === 200
    ) {
      try {
        const json = await response.json();
        const item = json.item || json;
        const parsed = parseApiItem(item);
        if (parsed?.vintedId) {
          // Merge with existing (detail has richer data)
          const existing = items.get(parsed.vintedId) || {};
          items.set(parsed.vintedId, { ...existing, ...parsed });
        }
      } catch {
        // Skip
      }
    }
  });

  console.log("Navigating to member profile...");
  try {
    await page.goto(MEMBER_URL, { waitUntil: "domcontentloaded", timeout: 30000 });
  } catch (e) {
    console.log(`  Navigation timeout (expected for heavy page): ${e}`);
  }

  // Accept cookies if banner appears
  try {
    const cookieBtn = page.locator("#onetrust-accept-btn-handler");
    if (await cookieBtn.isVisible({ timeout: 5000 })) {
      await cookieBtn.click();
      console.log("  Accepted cookies");
      await sleep(1000);
    }
  } catch {
    // Try alternative cookie button
    try {
      const altBtn = page.locator(
        '[data-testid="cookie-consent-banner-accept"], [id*="accept"], button:has-text("Souhlasím"), button:has-text("Přijmout")'
      );
      if (await altBtn.first().isVisible({ timeout: 2000 })) {
        await altBtn.first().click();
        console.log("  Accepted cookies (alt button)");
        await sleep(1000);
      }
    } catch {
      // No cookie banner
    }
  }

  // Wait for initial content to load
  await sleep(3000);

  // Scroll down to trigger lazy loading / infinite scroll / pagination
  console.log("Scrolling to load all items...");
  let lastItemCount = 0;
  let stableRounds = 0;

  for (let scroll = 0; scroll < 50; scroll++) {
    await page.evaluate(() =>
      window.scrollTo(0, document.body.scrollHeight)
    );
    await sleep(1500);

    const currentCount = items.size;
    if (currentCount === lastItemCount) {
      stableRounds++;
      if (stableRounds >= 5) {
        console.log(
          `  No new items after ${stableRounds} scrolls, done scrolling.`
        );
        break;
      }
    } else {
      stableRounds = 0;
      console.log(`  Items so far: ${currentCount}`);
    }
    lastItemCount = currentCount;
  }

  // Also try clicking "load more" / pagination buttons
  try {
    const loadMoreBtn = page.locator(
      'button:has-text("Načíst další"), button:has-text("Zobrazit více"), [data-testid*="load-more"], [data-testid*="show-more"]'
    );
    let clickCount = 0;
    while (await loadMoreBtn.first().isVisible({ timeout: 2000 })) {
      await loadMoreBtn.first().click();
      clickCount++;
      await sleep(2000);
      console.log(`  Clicked "load more" (${clickCount}x, items: ${items.size})`);
      if (clickCount > 20) break; // Safety limit
    }
  } catch {
    // No load more button
  }

  // Save raw API responses for debugging
  fs.writeFileSync(RAW_API_FILE, JSON.stringify(rawResponses, null, 2));
  console.log(`  Saved ${rawResponses.length} raw API responses`);

  // Take a screenshot for debugging
  await page
    .screenshot({
      path: path.join(OUTPUT_DIR, "profile-screenshot.png"),
      fullPage: false,
    })
    .catch(() => {});

  await page.close();
  return items;
}

/**
 * Strategy 2: If network interception didn't capture items,
 * try fetching the API directly using cookies from the browser session.
 */
async function scrapeViaDirectApi(
  context: BrowserContext
): Promise<Map<string, Partial<VintedProduct>>> {
  const items = new Map<string, Partial<VintedProduct>>();

  // Get cookies from the browser context
  const cookies = await context.cookies("https://www.vinted.cz");
  const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join("; ");

  console.log(
    `  Using ${cookies.length} cookies for direct API access`
  );

  // Try paginated API requests
  let page = 1;
  const perPage = 96; // Vinted's max per page

  while (page <= 20) {
    // Safety limit
    const apiUrl = `https://www.vinted.cz/api/v2/users/${MEMBER_ID}/items?page=${page}&per_page=${perPage}&order=relevance`;

    try {
      const response = await fetch(apiUrl, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
          Accept: "application/json",
          Cookie: cookieHeader,
          Referer: MEMBER_URL,
          "X-Requested-With": "XMLHttpRequest",
        },
      });

      if (response.status === 403) {
        console.log(`  API returned 403 (Datadome) on page ${page}`);
        break;
      }

      if (!response.ok) {
        console.log(`  API returned ${response.status} on page ${page}`);
        break;
      }

      const json = await response.json();
      const itemsList =
        json.items || json.user_items || json.data?.items || [];

      if (!Array.isArray(itemsList) || itemsList.length === 0) {
        console.log(`  No more items on page ${page}`);
        break;
      }

      for (const item of itemsList) {
        const parsed = parseApiItem(item);
        if (parsed?.vintedId) {
          items.set(parsed.vintedId, parsed);
        }
      }

      console.log(
        `  Page ${page}: ${itemsList.length} items (total: ${items.size})`
      );

      if (itemsList.length < perPage) break; // Last page
      page++;
      await sleep(DELAY_MS);
    } catch (e) {
      console.error(`  API error on page ${page}: ${e}`);
      break;
    }
  }

  return items;
}

/**
 * Strategy 3: Scrape individual product detail pages for richer data.
 * Only for items we already know about (from strategies 1/2).
 */
async function enrichWithDetailPages(
  context: BrowserContext,
  items: Map<string, Partial<VintedProduct>>
): Promise<void> {
  if (items.size === 0) return;

  console.log(`\nEnriching ${items.size} items with detail page data...`);
  const page = await context.newPage();

  // Set up interception for detail API calls
  page.on("response", async (response) => {
    const url = response.url();
    const match = url.match(/\/api\/v2\/items\/(\d+)/);
    if (match && response.status() === 200) {
      try {
        const json = await response.json();
        const item = json.item || json;
        const parsed = parseApiItem(item);
        if (parsed?.vintedId) {
          const existing = items.get(parsed.vintedId) || {};
          items.set(parsed.vintedId, {
            ...existing,
            ...parsed,
            // Keep existing photos if detail page has fewer
            photoUrls:
              (parsed.photoUrls?.length || 0) >=
              (existing.photoUrls?.length || 0)
                ? parsed.photoUrls
                : existing.photoUrls,
          });
        }
      } catch {
        // Skip
      }
    }
  });

  const itemEntries = Array.from(items.entries());
  for (let i = 0; i < itemEntries.length; i++) {
    const [id, item] = itemEntries[i];

    // Skip if we already have rich data (description + multiple photos)
    if (
      item.description &&
      item.description.length > 10 &&
      (item.photoUrls?.length || 0) >= 2
    ) {
      continue;
    }

    const detailUrl = `https://www.vinted.cz/items/${id}`;
    console.log(
      `  [${i + 1}/${items.size}] Enriching: ${item.title || id}`
    );

    try {
      await page.goto(detailUrl, {
        waitUntil: "domcontentloaded",
        timeout: 15000,
      });
      await sleep(1500); // Wait for API response to be captured
    } catch {
      console.log(`    Timeout on detail page (data may still be captured)`);
    }

    if (i < itemEntries.length - 1) {
      await sleep(DELAY_MS);
    }
  }

  await page.close();
}

async function main() {
  // Create output directories
  fs.mkdirSync(IMAGES_DIR, { recursive: true });

  console.log("=== Vinted Profile Scraper (Network Interception) ===");
  console.log(`Target: ${MEMBER_URL}`);
  console.log(`Output: ${OUTPUT_DIR}`);
  console.log();

  // Launch browser
  const browser = await chromium.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-blink-features=AutomationControlled",
      "--disable-dev-shm-usage",
    ],
  });

  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    viewport: { width: 1920, height: 1080 },
    locale: "cs-CZ",
    timezoneId: "Europe/Prague",
    extraHTTPHeaders: {
      "Accept-Language": "cs-CZ,cs;q=0.9,en;q=0.8",
    },
  });

  // Block unnecessary resources to speed up loading
  await context.route(
    /\.(woff2?|ttf|eot|svg|gif|mp4)(\?|$)/,
    (route) => route.abort()
  );
  await context.route(
    /google-analytics|gtag|facebook|sentry|datadome.*\.js/,
    (route) => route.abort()
  );

  try {
    // Strategy 1: Network interception while browsing profile
    console.log("--- Strategy 1: Network Interception ---");
    const interceptedItems = await scrapeViaNetworkInterception(context);
    console.log(`\nNetwork interception captured: ${interceptedItems.size} items`);

    // Strategy 2: Direct API if interception didn't get enough
    let allItems = interceptedItems;
    if (interceptedItems.size === 0) {
      console.log("\n--- Strategy 2: Direct API Access ---");
      const apiItems = await scrapeViaDirectApi(context);
      console.log(`Direct API captured: ${apiItems.size} items`);
      allItems = apiItems.size > interceptedItems.size ? apiItems : interceptedItems;
    }

    if (allItems.size === 0) {
      console.error(
        "\nNo products found! Possible causes:"
      );
      console.error("  - Datadome is blocking the browser");
      console.error("  - The member has no active listings");
      console.error("  - Vinted changed their API structure");
      console.error(
        "\nCheck the debug screenshot at: scripts/vinted-data/profile-screenshot.png"
      );
      console.error(
        "Check raw API responses at: scripts/vinted-data/raw-api-responses.json"
      );
      await browser.close();
      return;
    }

    // Strategy 3: Enrich items that need more data
    await enrichWithDetailPages(context, allItems);

    // Download photos for all items
    console.log(`\n--- Downloading Photos ---`);
    const products: VintedProduct[] = [];

    // Load existing progress for resume support
    const existingIds = new Set<string>();
    if (fs.existsSync(PRODUCTS_FILE)) {
      try {
        const existing = JSON.parse(fs.readFileSync(PRODUCTS_FILE, "utf-8"));
        if (Array.isArray(existing)) {
          for (const p of existing) {
            if (p.vintedId && p.photos?.length > 0) {
              existingIds.add(p.vintedId);
              products.push(p);
            }
          }
          console.log(`Resuming: ${existingIds.size} products already complete`);
        }
      } catch {
        // Corrupted — start fresh
      }
    }

    const entries = Array.from(allItems.entries());
    for (let i = 0; i < entries.length; i++) {
      const [id, itemData] = entries[i];

      if (existingIds.has(id)) {
        continue; // Already downloaded
      }

      console.log(
        `\n[${i + 1}/${entries.length}] "${itemData.title}" — ${itemData.photoUrls?.length || 0} photos`
      );

      // Download photos
      const photos: string[] = [];
      const productImagesDir = path.join(IMAGES_DIR, id);
      fs.mkdirSync(productImagesDir, { recursive: true });

      for (let j = 0; j < (itemData.photoUrls?.length || 0); j++) {
        const photoUrl = itemData.photoUrls![j];
        const ext = photoUrl.match(/\.(jpe?g|png|webp)/i)?.[1] || "webp";
        const filename = `${j + 1}.${ext}`;
        const filepath = path.join(productImagesDir, filename);

        const success = await downloadImage(photoUrl, filepath);
        if (success) {
          photos.push(filepath);
          process.stdout.write(
            `  Photo ${j + 1}/${itemData.photoUrls!.length} ✓  \r`
          );
        }
      }
      console.log(
        `  Downloaded ${photos.length}/${itemData.photoUrls?.length || 0} photos`
      );

      const product: VintedProduct = {
        vintedId: itemData.vintedId || id,
        url: itemData.url || `https://www.vinted.cz/items/${id}`,
        title: itemData.title || "",
        description: itemData.description || "",
        price: itemData.price || 0,
        currency: itemData.currency || "CZK",
        originalPrice: itemData.originalPrice || null,
        brand: itemData.brand || "",
        size: itemData.size || "",
        condition: itemData.condition || "",
        color: itemData.color || [],
        category: itemData.category || "",
        material: itemData.material || "",
        measurements: itemData.measurements || "",
        views: itemData.views || 0,
        favorites: itemData.favorites || 0,
        uploadedAt: itemData.uploadedAt || "",
        photos,
        photoUrls: itemData.photoUrls || [],
        status: itemData.status || "active",
      };

      products.push(product);

      // Save progress after each product
      fs.writeFileSync(PRODUCTS_FILE, JSON.stringify(products, null, 2));
    }

    // Final save
    fs.writeFileSync(PRODUCTS_FILE, JSON.stringify(products, null, 2));

    console.log("\n=== SCRAPING COMPLETE ===");
    console.log(`Total products: ${products.length}`);
    console.log(
      `Photos downloaded: ${products.reduce((sum, p) => sum + p.photos.length, 0)}`
    );
    console.log(`Output: ${PRODUCTS_FILE}`);
    console.log(`Images: ${IMAGES_DIR}`);
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
