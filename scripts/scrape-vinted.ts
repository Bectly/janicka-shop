/**
 * Vinted Profile Scraper — Migrate products from Vinted to Janička Shop
 *
 * Uses Playwright to:
 * 1. Navigate to the member profile page
 * 2. Accept cookies, scroll to load all products
 * 3. Extract product URLs from the rendered DOM
 * 4. Visit each product detail page and capture data via API interception + DOM
 * 5. Download all product photos at full resolution
 *
 * Usage:
 *   npx tsx scripts/scrape-vinted.ts
 *
 * Output:
 *   scripts/vinted-data/products.json  — all product data
 *   scripts/vinted-data/images/        — downloaded product photos
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
const DELAY_MS = 2500; // between detail page loads
const MAX_RETRIES = 3;
const PHOTO_RESOLUTION = "f1600x1600";

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
  photos: string[];
  photoUrls: string[];
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

function toFullResUrl(url: string): string {
  return url.replace(/\/(?:f?\d+x\d+)\//, `/${PHOTO_RESOLUTION}/`);
}

/**
 * Step 1: Collect all product URLs from the member profile page.
 * Products are server-rendered, so we extract from the DOM.
 */
async function collectProductUrls(page: Page): Promise<string[]> {
  console.log("Navigating to member profile...");
  await page.goto(MEMBER_URL, { waitUntil: "load", timeout: 30000 });
  await sleep(2000);

  // Accept cookies — try multiple selectors
  const cookieSelectors = [
    "#onetrust-accept-btn-handler",
    '[data-testid="cookie-consent-banner-accept"]',
    'button:has-text("Přijmout vše")',
    'button:has-text("Souhlasím")',
    'button:has-text("Accept")',
    'button:has-text("Přijmout")',
  ];

  for (const selector of cookieSelectors) {
    try {
      const btn = page.locator(selector).first();
      if (await btn.isVisible({ timeout: 1500 })) {
        await btn.click();
        console.log(`  Accepted cookies via: ${selector}`);
        await sleep(1500);
        break;
      }
    } catch {
      // Try next selector
    }
  }

  // Take screenshot after cookie acceptance
  await page.screenshot({
    path: path.join(OUTPUT_DIR, "after-cookies.png"),
    fullPage: false,
  });

  // Scroll to load all items (infinite scroll)
  let previousCount = 0;
  let stableRounds = 0;

  for (let scroll = 0; scroll < 50; scroll++) {
    await page.evaluate(() =>
      window.scrollTo(0, document.body.scrollHeight)
    );
    await sleep(1500);

    // Count product links on page
    const count = await page.evaluate(() => {
      const links = document.querySelectorAll('a[href*="/items/"]');
      return new Set(
        Array.from(links)
          .map((a) => (a as HTMLAnchorElement).href)
          .filter((h) => h.match(/\/items\/\d+/))
      ).size;
    });

    if (count === previousCount) {
      stableRounds++;
      if (stableRounds >= 4) {
        console.log(`  Loaded all items (${count} found)`);
        break;
      }
    } else {
      stableRounds = 0;
      console.log(`  Scrolling... ${count} items found`);
    }
    previousCount = count;
  }

  // Extract unique product URLs
  const urls = await page.evaluate(() => {
    const links = document.querySelectorAll('a[href*="/items/"]');
    const uniqueUrls = new Set<string>();
    links.forEach((link) => {
      const href = (link as HTMLAnchorElement).href;
      const match = href.match(/(https:\/\/www\.vinted\.cz\/items\/\d+)/);
      if (match) {
        uniqueUrls.add(match[1]);
      }
    });
    return Array.from(uniqueUrls);
  });

  console.log(`Found ${urls.length} unique product URLs`);
  return urls;
}

/**
 * Step 2: Scrape a single product detail page.
 * Uses both DOM scraping and API interception (whichever provides richer data).
 */
async function scrapeProductDetail(
  page: Page,
  url: string,
  index: number,
  total: number
): Promise<VintedProduct | null> {
  const vintedIdMatch = url.match(/\/items\/(\d+)/);
  const vintedId = vintedIdMatch ? vintedIdMatch[1] : "";

  console.log(`\n[${index}/${total}] ${url}`);

  // Set up API interception for this page
  let apiData: any = null;
  const responseHandler = async (response: any) => {
    const rUrl = response.url();
    if (
      rUrl.includes(`/items/${vintedId}`) &&
      !rUrl.includes("/items/" + vintedId + "/") &&
      response.status() === 200
    ) {
      try {
        const json = await response.json();
        apiData = json.item || json;
      } catch {
        // Not JSON
      }
    }
  };
  page.on("response", responseHandler);

  try {
    await page.goto(url, { waitUntil: "load", timeout: 20000 });
  } catch {
    console.log(`  Navigation timeout (continuing with partial data)`);
  }
  await sleep(2000);

  // Extract data from the DOM — use string evaluation to avoid tsx __name injection
  const domData = await page.evaluate(`(function() {
    // Title — use reliable sources first: og:title, document.title, then h1/h2
    var title = "";
    // 1. og:title meta tag (most reliable — Vinted always sets this)
    var ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) {
      title = (ogTitle.getAttribute("content") || "").trim();
      // Strip " | Vinted" suffix
      title = title.replace(/\\s*\\|\\s*Vinted$/i, "").trim();
    }
    // 2. Page title (usually "Product Name | Vinted")
    if (!title && document.title) {
      var parts = document.title.split("|");
      if (parts.length > 0) title = parts[0].trim();
    }
    // 3. itemprop="name"
    if (!title) {
      var nameEl = document.querySelector('[itemprop="name"]');
      if (nameEl) title = (nameEl.textContent || "").trim();
    }
    // 4. Fallback to first short h1 that isn't navigation
    if (!title) {
      var h1s = document.querySelectorAll("h1");
      for (var i = 0; i < h1s.length; i++) {
        var t = (h1s[i].textContent || "").trim();
        if (t.length > 2 && t.length < 200 && t.indexOf("Vinted") === -1 && t.indexOf("Hledat") === -1 && t.indexOf("šatník") === -1 && t.indexOf("Předměty") === -1) {
          title = t;
          break;
        }
      }
    }

    // Description
    var description = "";
    var descEls = document.querySelectorAll('[data-testid="item-description"], [itemprop="description"]');
    for (var i = 0; i < descEls.length; i++) {
      var t = (descEls[i].textContent || "").trim();
      if (t.length > 5) { description = t; break; }
    }

    // Price
    var price = 0;
    var priceEls = document.querySelectorAll('[data-testid="item-price"], [itemprop="price"], [class*="price"], [class*="Price"]');
    for (var i = 0; i < priceEls.length; i++) {
      var t = (priceEls[i].textContent || "").trim();
      var m = t.match(/(\\d[\\d\\s,.]*)\\s*(?:Kč|CZK|€)/);
      if (m) {
        price = parseFloat(m[1].replace(/\\s/g, "").replace(",", ".")) || 0;
        if (price > 0) break;
      }
    }

    // Details from body text
    var allText = document.body.innerText;
    var brand = "", size = "", condition = "", material = "";
    var color = [];

    var brandMatch = allText.match(/Značka\\s*\\n\\s*(.+)/);
    if (brandMatch) brand = brandMatch[1].trim();
    var sizeMatch = allText.match(/Velikost\\s*\\n\\s*(.+)/);
    if (sizeMatch) size = sizeMatch[1].trim();
    var condMatch = allText.match(/Stav\\s*\\n\\s*(.+)/);
    if (condMatch) condition = condMatch[1].trim();
    var matMatch = allText.match(/Materiál\\s*\\n\\s*(.+)/);
    if (matMatch) material = matMatch[1].trim();
    var colorMatch = allText.match(/Barva\\s*\\n\\s*(.+)/);
    if (colorMatch) color = colorMatch[1].trim().split(",").map(function(c) { return c.trim(); });

    // Category from breadcrumbs
    var category = "";
    var breadcrumbs = document.querySelectorAll('[data-testid*="breadcrumb"] a, nav[aria-label*="breadcrumb"] a, [class*="Breadcrumb"] a');
    if (breadcrumbs.length > 1) {
      var parts = [];
      for (var i = 1; i < breadcrumbs.length; i++) {
        var txt = (breadcrumbs[i].textContent || "").trim();
        if (txt) parts.push(txt);
      }
      category = parts.join(" > ");
    }

    // Photo URLs
    var photoUrls = [];
    var seenHashes = {};
    var allImgs = document.querySelectorAll("img");
    for (var i = 0; i < allImgs.length; i++) {
      var src = allImgs[i].src || "";
      if (src.indexOf("vinted.net") !== -1 &&
          src.indexOf("logo") === -1 &&
          src.indexOf("avatar") === -1 &&
          src.indexOf("badge") === -1 &&
          src.indexOf("app-store") === -1 &&
          src.indexOf("google-play") === -1 &&
          src.indexOf("20x20") === -1 &&
          src.indexOf("50x50") === -1 &&
          src.indexOf("100x100") === -1 &&
          src.indexOf("assets") === -1) {
        var hashMatch = src.match(/\\/t\\/([^\\/]+)\\//);
        var hash = hashMatch ? hashMatch[1] : src;
        if (!seenHashes[hash]) {
          seenHashes[hash] = true;
          photoUrls.push(src);
        }
      }
    }

    // Views / favorites
    var views = 0, favorites = 0;
    var statsMatch = allText.match(/(\\d+)\\s*(?:zobrazení|zhlédnutí)/i);
    if (statsMatch) views = parseInt(statsMatch[1]);
    var favsMatch = allText.match(/(\\d+)\\s*(?:oblíben|to se líbí)/i);
    if (favsMatch) favorites = parseInt(favsMatch[1]);

    // Upload date
    var uploadedAt = "";
    var dateMatch = allText.match(/(?:Přidáno|Nahráno)\\s*(?:dne\\s*)?(\\d{1,2}[\\.\\/ ]\\s*\\d{1,2}[\\.\\/ ]\\s*\\d{2,4}|\\d+\\s*(?:minut|hodin|dní|dnů|dny|den|měsíc|rok)\\s*(?:zpět|nazpět))/i);
    if (dateMatch) uploadedAt = dateMatch[1].trim();

    // JSON-LD
    var jsonLd = null;
    var ldScript = document.querySelector('script[type="application/ld+json"]');
    if (ldScript) {
      try { jsonLd = JSON.parse(ldScript.textContent || "{}"); } catch(e) {}
    }

    return {
      title: title,
      description: description,
      price: price,
      brand: brand,
      size: size,
      condition: condition,
      color: color,
      category: category,
      material: material,
      views: views,
      favorites: favorites,
      uploadedAt: uploadedAt,
      photoUrls: photoUrls,
      jsonLd: jsonLd
    };
  })()`
  ) as any;

  // Remove the response handler
  page.off("response", responseHandler);

  // Merge DOM data with API data (if captured)
  const title = apiData?.title || domData.title || "";
  const description =
    apiData?.description || domData.description || "";

  // Photo URLs — prefer API data (has all photos), fallback to DOM
  let photoUrls: string[] = [];
  if (apiData?.photos && Array.isArray(apiData.photos)) {
    for (const photo of apiData.photos) {
      const pUrl =
        photo.full_size_url || photo.url || "";
      if (pUrl) photoUrls.push(toFullResUrl(pUrl));
    }
  }
  if (photoUrls.length === 0 && domData.photoUrls.length > 0) {
    photoUrls = domData.photoUrls.map(toFullResUrl);
  }

  // Also try JSON-LD for additional data
  const jsonLd = domData.jsonLd;
  if (jsonLd) {
    if (!title && jsonLd.name) domData.title = jsonLd.name;
    if (!description && jsonLd.description)
      domData.description = jsonLd.description;
    if (jsonLd.offers?.price && !domData.price) {
      domData.price = parseFloat(jsonLd.offers.price);
    }
    if (jsonLd.brand?.name && !domData.brand)
      domData.brand = jsonLd.brand.name;
    if (jsonLd.image && photoUrls.length === 0) {
      const images = Array.isArray(jsonLd.image)
        ? jsonLd.image
        : [jsonLd.image];
      photoUrls = images.map(toFullResUrl);
    }
  }

  // Build the product
  const product: VintedProduct = {
    vintedId,
    url,
    title: title || domData.title,
    description: description || domData.description,
    price:
      (apiData?.price?.amount
        ? parseFloat(apiData.price.amount)
        : null) ||
      domData.price ||
      (jsonLd?.offers?.price ? parseFloat(jsonLd.offers.price) : 0),
    currency:
      apiData?.price?.currency_code || domData.jsonLd?.offers?.priceCurrency || "CZK",
    originalPrice: apiData?.original_price?.amount
      ? parseFloat(apiData.original_price.amount)
      : null,
    brand:
      apiData?.brand_dto?.title || apiData?.brand?.title || domData.brand,
    size:
      apiData?.size_title || apiData?.size?.title || domData.size,
    condition:
      apiData?.status || domData.condition,
    color:
      apiData?.color1
        ? [apiData.color1, apiData.color2].filter(Boolean)
        : domData.color,
    category:
      domData.category || apiData?.catalog_id?.toString() || "",
    material:
      apiData?.material?.title || domData.material,
    measurements: "",
    views: apiData?.view_count || domData.views,
    favorites:
      apiData?.favourite_count || apiData?.favorite_count || domData.favorites,
    uploadedAt: apiData?.created_at_ts
      ? new Date(apiData.created_at_ts * 1000).toISOString()
      : domData.uploadedAt,
    photos: [], // Will be filled after download
    photoUrls,
    status: apiData?.status || "active",
  };

  console.log(
    `  "${product.title}" | ${product.price} ${product.currency} | ${product.brand} | ${product.size} | ${photoUrls.length} photos`
  );

  return product;
}

async function main() {
  fs.mkdirSync(IMAGES_DIR, { recursive: true });

  console.log("=== Vinted Profile Scraper ===");
  console.log(`Target: ${MEMBER_URL}`);
  console.log(`Output: ${OUTPUT_DIR}\n`);

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

  try {
    const page = await context.newPage();

    // Step 1: Collect product URLs from profile
    const productUrls = await collectProductUrls(page);

    if (productUrls.length === 0) {
      console.error("\nNo product URLs found on the profile page!");
      console.error("Taking full-page debug screenshot...");
      await page.screenshot({
        path: path.join(OUTPUT_DIR, "debug-full.png"),
        fullPage: true,
      });

      // Dump page HTML for debugging
      const html = await page.content();
      fs.writeFileSync(
        path.join(OUTPUT_DIR, "debug-page.html"),
        html
      );
      console.error("Debug files saved to scripts/vinted-data/");
      return;
    }

    // Load existing progress for resume
    const existingProducts: VintedProduct[] = [];
    const existingIds = new Set<string>();
    if (fs.existsSync(PRODUCTS_FILE)) {
      try {
        const existing = JSON.parse(
          fs.readFileSync(PRODUCTS_FILE, "utf-8")
        );
        if (Array.isArray(existing)) {
          for (const p of existing) {
            if (p.vintedId && p.photos?.length > 0) {
              existingProducts.push(p);
              existingIds.add(p.vintedId);
            }
          }
          if (existingIds.size > 0) {
            console.log(`Resuming: ${existingIds.size} products already done`);
          }
        }
      } catch {
        // Start fresh
      }
    }

    // Step 2: Scrape each product detail page
    const products: VintedProduct[] = [...existingProducts];
    let scraped = 0;
    let failed = 0;

    for (let i = 0; i < productUrls.length; i++) {
      const pUrl = productUrls[i];
      const idMatch = pUrl.match(/\/items\/(\d+)/);
      const id = idMatch ? idMatch[1] : "";

      if (existingIds.has(id)) {
        console.log(`[${i + 1}/${productUrls.length}] Already done, skipping`);
        continue;
      }

      const product = await scrapeProductDetail(
        page,
        pUrl,
        i + 1,
        productUrls.length
      );

      if (product) {
        // Download photos
        const productImagesDir = path.join(
          IMAGES_DIR,
          product.vintedId
        );
        fs.mkdirSync(productImagesDir, { recursive: true });

        for (let j = 0; j < product.photoUrls.length; j++) {
          const photoUrl = product.photoUrls[j];
          const ext =
            photoUrl.match(/\.(jpe?g|png|webp)/i)?.[1] || "webp";
          const filename = `${j + 1}.${ext}`;
          const filepath = path.join(productImagesDir, filename);

          const success = await downloadImage(photoUrl, filepath);
          if (success) {
            product.photos.push(filepath);
          }
        }

        console.log(
          `  Downloaded ${product.photos.length}/${product.photoUrls.length} photos`
        );

        products.push(product);
        scraped++;

        // Save progress after each product
        fs.writeFileSync(
          PRODUCTS_FILE,
          JSON.stringify(products, null, 2)
        );
      } else {
        failed++;
      }

      // Rate limiting
      if (i < productUrls.length - 1) {
        await sleep(DELAY_MS);
      }
    }

    // Final save
    fs.writeFileSync(PRODUCTS_FILE, JSON.stringify(products, null, 2));

    console.log("\n=== SCRAPING COMPLETE ===");
    console.log(`Total products: ${products.length}`);
    console.log(`Newly scraped: ${scraped}`);
    console.log(`Failed: ${failed}`);
    console.log(
      `Photos downloaded: ${products.reduce(
        (sum, p) => sum + p.photos.length,
        0
      )}`
    );
    console.log(`Output: ${PRODUCTS_FILE}`);
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
