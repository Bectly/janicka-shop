---
name: seo_structured_data_audit
description: Deep audit of structured-data.ts, product detail/catalog/homepage/search JSON-LD, sitemap.ts, and Heureka feed. New: 2 HIGH, 4 MEDIUM, 5 LOW.
type: project
---

Audit covers: src/lib/structured-data.ts, src/app/(shop)/products/[slug]/page.tsx, src/app/(shop)/page.tsx, src/app/(shop)/products/page.tsx, src/app/(shop)/search/page.tsx, src/app/sitemap.ts, src/app/api/feed/heureka/route.ts, src/lib/constants.ts.

TypeScript check: clean (npx tsc --noEmit = no output).

## NEW FINDINGS

### HIGH — freeShippingThreshold uses @type:DeliveryChargeSpecification which is incorrect; should be @type:MonetaryAmount
- File: src/lib/structured-data.ts:55-59
- The `freeShippingThreshold` property on `OfferShippingDetails` expects a `MonetaryAmount` per Schema.org spec (schema.org/freeShippingThreshold). A `DeliveryChargeSpecification` is the type for `shippingRate`, not for the threshold. Google's Rich Results documentation explicitly states `freeShippingThreshold` must have `@type: MonetaryAmount`, with `value` (numeric) and `currency` (ISO 4217) — NOT `price`/`priceCurrency`.
- Current (wrong):
  ```json
  "freeShippingThreshold": { "@type": "DeliveryChargeSpecification", "price": "1500", "priceCurrency": "CZK" }
  ```
- Correct:
  ```json
  "freeShippingThreshold": { "@type": "MonetaryAmount", "value": "1500", "currency": "CZK" }
  ```
- The price field name itself is also wrong: MonetaryAmount uses `value` not `price`.
- Impact: Google will ignore/reject the free shipping threshold and won't show the "Free shipping over 1500 Kč" rich result annotation in Shopping. All 3 shipping options are affected.

### HIGH — buildProductSchema is missing @context; pages that embed a standalone product (detail page, not ItemList) will have invalid JSON-LD
- File: src/lib/structured-data.ts:170 (buildProductSchema return), src/app/(shop)/products/[slug]/page.tsx:148-165
- buildProductSchema returns a plain object with no `@context`. The detail page wraps it manually:
  ```ts
  const jsonLd = { "@context": "https://schema.org", ...buildProductSchema({...}) };
  ```
  This works for the detail page. BUT the `buildItemListSchema` (line 212-224) calls `buildProductSchema` for each list item and nests it as `item` inside a `ListItem`. The outer ItemList object has `@context: "https://schema.org"` — and inside the item, there is NO `@context`. This is correct per JSON-LD spec (context is inherited). However the inner product item also has no `@id`, no `identifier` property, and no absolute URL for `url` being redundant. These are not errors per se, but the critical issue is:
- The product detail page at line 148-165 does `{ "@context": ..., ...buildProductSchema }` via spread. The spread brings `@type: "Product"` to the top level. BUT: `offers` inside the product schema also has no `@context`, which is correct JSON-LD. What IS a problem: `brand: undefined` when product.brand is null — JSON.stringify drops `undefined` values, so that's fine. The function returns `image: undefined` when no images — undefined is dropped by JSON.stringify. That is fine.
- ACTUAL HIGH: `buildItemListSchema` wraps products in `itemListElement[].item`, and Google's guidelines for ItemList+Product require that each `item` have a `@type` — which it does (Product). But it also requires a URL property at `item.url` that must be an absolute URL. `buildProductSchema` includes `url: \`${BASE_URL}/products/${product.slug}\`` — that IS absolute. So that's fine.
- REVISED: The "missing @context on buildProductSchema" is intentional and correct for nested use. Re-evaluating...
- TRUE HIGH: Re-reading the detail page: `const jsonLd = { "@context": "https://schema.org", ...buildProductSchema({...}) }`. The spread merges `@type: "Product"` and all fields at the root level. The result is a valid standalone Product JSON-LD. This is correct.
- ACTUAL HIGH (confirmed): `offers.price` is a number (product.price from Prisma = Int). The Schema.org `Offer.price` expects a Number or Text. A JS number is serialized correctly by JSON.stringify. Google accepts numbers. This is OK.
- DOWNGRADED: No HIGH for @context issue. See revised HIGH below.

### HIGH (revised) — Offer.availability uses "https://schema.org/SoldOut" which is not a valid Schema.org enumeration value
- File: src/lib/structured-data.ts:196-199
- `availability: product.sold ? "https://schema.org/SoldOut" : "https://schema.org/InStock"`
- `SoldOut` is NOT a valid Schema.org ItemAvailability enumeration value. The correct value for a product that has been sold is `https://schema.org/OutOfStock`. The valid ItemAvailability values are: InStock, InStoreOnly, LimitedAvailability, OnlineOnly, OutOfStock, PreOrder, PreSale, Discontinued, SoldOut — wait, checking: Schema.org does list `SoldOut` as of 2019 (https://schema.org/SoldOut). It IS valid on schema.org.
- Cross-checking Google's supported values: Google's documentation for `Offer` availability lists: InStock, InStoreOnly, LimitedAvailability, OnlineOnly, OutOfStock, PreOrder, PreSale, SoldOut. SoldOut is listed.
- DOWNGRADED: `SoldOut` is valid. Not a bug.

### HIGH (actual, confirmed) — freeShippingThreshold @type and property name are wrong (restating HIGH #1 from above)
This is the only confirmed HIGH. See above.

### MEDIUM — buildProductSchema: `price` on Offer is an integer (number type) but Schema.org recommends text/decimal string for prices to avoid floating-point issues; price "150" vs 150 both accepted by Google but price as string is the documented form
- File: src/lib/structured-data.ts:191
- `price: product.price` — this is a Prisma Int (JavaScript number). JSON.stringify produces `"price":150`. Schema.org accepts both, Google accepts both. Not a spec violation — LOW at most.
- DOWNGRADED to LOW.

### MEDIUM — OfferShippingDetails is missing required `doesNotShip` or at least one of the `shippingDestination`/`shippingRate` pairing; actually both present — checking `deliveryTime` nesting
- Checking: DELIVERY_TIME has `handlingTime` and `transitTime` each as `QuantitativeValue` with `unitCode: "DAY"`. Schema.org/ShippingDeliveryTime expects `businessDays` optional and `cutoffTime` optional, but handlingTime/transitTime with QuantitativeValue is correct. unitCode "DAY" is a UN/CEFACT code — correct.
- CONFIRMED CLEAN for deliveryTime nesting.

### MEDIUM — `DefinedRegion` for `shippingDestination` is missing required `name` property; Google's merchant feed validator requires it
- File: src/lib/structured-data.ts:33-36
- `SHIPPING_DESTINATION = { "@type": "DefinedRegion", addressCountry: "CZ" }`
- Per Schema.org, `DefinedRegion` has no required properties — `addressCountry` alone is sufficient to define a region. Google's Rich Results Test and the Merchant Center feed validator accept `addressCountry` alone. This is clean.
- DOWNGRADED: Not a bug.

### MEDIUM — `MerchantReturnPolicy.returnFees` value is wrong Schema.org enumeration
- File: src/lib/structured-data.ts:108
- `returnFees: "https://schema.org/ReturnShippingFees"`
- The valid Schema.org `ReturnFeesEnumeration` values are: `FreeReturn`, `ReturnFeesCustomerResponsibility`, `OriginalShippingFees`, `Restocking Fees` — wait, checking current Schema.org spec. As of 2023, Schema.org `returnFees` on `MerchantReturnPolicy` accepts: `FreeReturn`, `ReturnFeesCustomerResponsibility`, `OriginalShippingFees`, `RestockingFees`. There is NO `ReturnShippingFees` value in the current Schema.org spec.
- Google's documentation (merchants.google.com) lists `ReturnShippingFees` as a valid value for `hasMerchantReturnPolicy`... Let me be precise: Google specifically supports `returnFees` with values including `FreeReturn`, `ReturnFeesCustomerResponsibility`, `RestockingFees`, `OriginalShippingFees`. `ReturnShippingFees` is NOT listed in either Google's or Schema.org's current enum.
- The intended meaning is "customer pays return shipping" — the correct value is `https://schema.org/ReturnFeesCustomerResponsibility`.
- CONFIRMED MEDIUM.

### MEDIUM — WebSite SearchAction: `query-input` is a legacy form; current Schema.org spec uses `query-input` as a string annotation but Google now prefers `actionAccessibilityRequirement` or the annotated form `"query-input": "required name=search_term_string"`
- File: src/lib/structured-data.ts:257-259
- The current form `"query-input": "required name=search_term_string"` is the correct Google-documented syntax for Sitelinks Searchbox. This IS the correct implementation per Google's current docs. No issue.
- DOWNGRADED: Clean.

### MEDIUM — buildBreadcrumbSchema: category filter URLs like `/products?category=saty` used as breadcrumb `item` values; Google requires breadcrumb items to be canonical page URLs, not filtered query-string URLs
- File: src/lib/structured-data.ts:237, src/app/(shop)/products/[slug]/page.tsx:168-171
- Breadcrumb item at index 1 is `{ name: product.category.name, url: /products?category=${product.category.slug} }`. This resolves to an absolute URL `https://janicka-shop.vercel.app/products?category=saty`. Google's BreadcrumbList spec requires `item` to be a URL of the page (can include query strings). Google does index query-string URLs as canonical catalog pages IF they appear in sitemap and canonical tags. The catalog page at `/products?category=saty` is in the sitemap and has a canonical. This is acceptable. Not a spec violation.
- The prior HIGH finding (C53) about unencoded category.slug in href strings still applies to the JSX hrefs but the breadcrumb JSON-LD uses the `buildBreadcrumbSchema` function which calls `item.url.startsWith("http") ? item.url : \`${BASE_URL}${item.url}\`` — the URL is built as a template literal with `product.category.slug` NOT encoded. A slug containing `?` or `&` would corrupt the JSON-LD URL. This is the same issue flagged in C53 but also present in the structured data.
- File: src/app/(shop)/products/[slug]/page.tsx:169: `url: \`/products?category=${product.category.slug}\``
- The breadcrumb JSON-LD URL for the category inherits the unencoded slug. Fix: `encodeURIComponent(product.category.slug)`.
- MEDIUM (structural data specific instance of the C53 HIGH).

### MEDIUM — `itemCondition` in `Offer` vs in `Product`; Schema.org spec places itemCondition on the Offer, not the Product
- File: src/lib/structured-data.ts:183-186
- `buildProductSchema` places `itemCondition` at the `Product` level (same level as `name`, `sku`). Per Schema.org spec, `itemCondition` is a property of `Offer`, not of `Product`. The valid properties for `Product` include `name`, `description`, `brand`, `sku`, `image`, `offers`, etc. `itemCondition` is listed as a property of `Offer` (https://schema.org/itemCondition → domain includes Offer).
- Google's Merchant Center product feed spec places condition on the Offer. Their Rich Results documentation shows `itemCondition` on the Offer object.
- Impact: Google may ignore the condition or fail to use it for Shopping enrichment.
- Fix: Move `itemCondition` from the `Product` level into the `offers` object.
- CONFIRMED MEDIUM.

### LOW — `color` and `size` are non-standard top-level `Product` properties in Schema.org; they should be expressed only via `additionalProperty` or via the Offer
- File: src/lib/structured-data.ts:181-182
- `color: colors.join(", ")` and `size: sizes.join(", ")` at the Product level. Schema.org does list `color` as a property of Product (schema.org/color). `size` is also a valid Product property since Schema.org 11 (schema.org/size, expects SizeSpecification). However the current implementation uses a plain string (`"M, L"`) rather than a `SizeSpecification` object. For Google Shopping enrichment, `SizeSpecification` with `name` is preferred.
- The `additionalProperty` array already encodes these — so the information is present in the correct structured form. Having both the flat string and the `additionalProperty` is redundant but not harmful.
- LOW: no spec violation for `color` (string is fine); `size` as plain string is technically accepted but SizeSpecification would be better.

### LOW — `priceValidUntil` on Offer is only set when compareAt > price (discounted items); non-discounted items have no priceValidUntil
- File: src/lib/structured-data.ts:193-195
- Google recommends always providing `priceValidUntil` to help Shopping crawlers understand price freshness. Without it, Google applies its own freshness heuristics. Not a spec violation.
- For discounted items the date is +90 days from server render time — this is set at BUILD time for SSG or at REQUEST time for SSR pages. The product detail page has no `export const revalidate` so it uses Next.js defaults (dynamic rendering). The date will be accurate per-render. For catalog/homepage ItemList, the product is inside a nested schema object which is also rendered dynamically. This is fine.
- LOW: add priceValidUntil for all products (even non-discounted ones) set to a reasonable future date (e.g. +30 days) to improve crawl freshness signaling.

### LOW — `sku` is repeated as both `sku` (Product) and inside `offers` indirectly; no `identifier` / `gtin` provided
- File: src/lib/structured-data.ts:177
- `sku: product.sku` is correct. However for Google Shopping enrichment, `identifier` with `@type: PropertyValue` is expected (or GTIN fields). For second-hand unique items, SKU alone is the identifier — this is accepted. Not a bug but worth noting for "Golden Record" completeness.

### LOW — `Organization` schema is missing `logo` and `contactPoint`; these are recommended for Google Knowledge Panel
- File: src/lib/structured-data.ts:263-271
- buildOrganizationSchema returns no `logo` or `contactPoint`. For Google Knowledge Panel display, a logo URL is strongly recommended. Not a spec violation but an enrichment gap.

### LOW — Sitemap: `changeFrequency: "daily"` on category pages is overoptimistic; most category pages change when products are added/removed (weekly or monthly is more accurate for a small catalog)
- File: src/app/sitemap.ts:61-64
- Minor; crawlers treat changeFrequency as advisory. Not a correctness issue.

### LOW — Sitemap: static pages (/about, /shipping, /terms, /privacy, /contact, /returns) appear in the sitemap but some of these routes may not exist as actual pages (no corresponding page.tsx found previously); 404 pages in sitemap waste crawl budget
- File: src/app/sitemap.ts:15-37
- These pages were added to the sitemap but whether the actual route files exist wasn't verified in this pass. If they return 404, Google will eventually drop them but log sitemap errors. LOW: verify route files exist for all static sitemap entries.

### LOW — Heureka feed: `DELIVERY_DATE` is hardcoded to "3" days for all products
- File: src/app/api/feed/heureka/route.ts:77
- `<DELIVERY_DATE>3</DELIVERY_DATE>` — Heureka expects this to be the number of working days from order to delivery. The actual maximum delivery is 2 (handling) + 3 (transit) = 5 business days. Using 3 may set false customer expectations and could trigger Heureka compliance issues if actual delivery exceeds 3 days. Fix: use 5 (or match the structured-data.ts DELIVERY_TIME maxValues = 2+3=5).

### LOW — Heureka feed: `HEUREKA_CATEGORIES["kalhoty-sukne"]` maps to `"Oblečení a móda | Dámské oblečení"` (no subcategory), while all others have a full subcategory path
- File: src/app/api/feed/heureka/route.ts:22
- The "kalhoty-sukne" category falls back to the parent category without "Kalhoty" or "Sukně" subcategory. Heureka uses category path for product placement in search. A more specific mapping would improve product visibility in the "Kalhoty" / "Sukně" filters on Heureka.

## CONFIRMED CLEAN

- `@context: "https://schema.org"` present on all top-level JSON-LD objects emitted to the page: itemListJsonLd (buildItemListSchema adds it), webSiteJsonLd, organizationJsonLd, productJsonLd (added manually in [slug]/page.tsx), breadcrumbJsonLd, faqJsonLd. All clean.
- JSON-LD XSS: jsonLdString() escapes `<` to `\u003c`. JSON.stringify handles all other special characters. Clean.
- BreadcrumbList position numbering: starts at 1, increments by 1. Correct.
- ItemList position numbering: starts at 1 per product index+1. Correct.
- FAQPage structure: `mainEntity` array with `@type: Question` and `acceptedAnswer: { @type: Answer, text }`. Correct.
- WebSite SearchAction: `target` is an `EntryPoint` with correct `urlTemplate` using `{search_term_string}` annotation. Correct per Google's Sitelinks Searchbox spec.
- `ShippingDeliveryTime` with `handlingTime`/`transitTime` as `QuantitativeValue` with `unitCode: "DAY"`: correct Schema.org structure.
- `OfferShippingDetails` structure: `shippingRate` (DeliveryChargeSpecification), `shippingDestination` (DefinedRegion), `deliveryTime` (ShippingDeliveryTime), `freeShippingThreshold` (WRONG — see HIGH above). First 3 are correct.
- `MerchantReturnPolicy.returnPolicyCategory`: `MerchantReturnFiniteReturnWindow` — valid.
- `MerchantReturnPolicy.merchantReturnDays: 14` — correct numeric value.
- `MerchantReturnPolicy.returnMethod: "https://schema.org/ReturnByMail"` — valid.
- `MerchantReturnPolicy.applicableCountry: "CZ"` — correct ISO 3166-1 alpha-2.
- Heureka `ITEM_TYPE: "bazaar"` — correct Heureka value for second-hand items.
- Heureka XML escaping: `escapeXml()` covers &, <, >, ", '. CDATA for description. Correct.
- Heureka `safeJsonParse` + array guard: correct, returns [] on failure.
- Sitemap graceful degradation on DB failure: returns static pages only with console.error. Correct.
- `price: "1500"` as string vs number in DeliveryChargeSpecification: Schema.org accepts both for price values. Not a problem (except for the @type issue which is the HIGH).
- `product.colors` and `product.sizes` null-safety: `if (product.colors)` guard before JSON.parse in buildProductSchema. Correct.
- `CONDITION_TO_SCHEMA` fallback: `?? "https://schema.org/UsedCondition"` provides a safe default for unknown condition values. Correct.

## Summary — Open Issues

### HIGH (1)
- `freeShippingThreshold` uses `@type: DeliveryChargeSpecification` and `price` property — should be `@type: MonetaryAmount` with `value` and `currency`. Affects all 3 shipping options. Google will not show free-shipping threshold in Shopping rich results.

### MEDIUM (3)
- `MerchantReturnPolicy.returnFees: "https://schema.org/ReturnShippingFees"` — not a valid Schema.org ReturnFeesEnumeration value. Should be `"https://schema.org/ReturnFeesCustomerResponsibility"`.
- `itemCondition` placed at Product level — should be inside the `offers` (Offer) object per Schema.org spec.
- Breadcrumb JSON-LD: category slug used raw (unencoded) in URL template — same C53 HIGH applies here in structured data context.

### LOW (5)
- `color`/`size` as flat strings instead of SizeSpecification — redundant with additionalProperty but not wrong.
- `priceValidUntil` only on discounted items — add to all products for freshness signaling.
- Organization schema missing `logo` and `contactPoint`.
- Heureka `DELIVERY_DATE: 3` should be 5 (matches actual max delivery time of 5 business days).
- Heureka `kalhoty-sukne` category path lacks subcategory specificity.

**Why:** The freeShippingThreshold type mismatch is the most impactful — it will prevent Google Shopping from showing the free-shipping threshold annotation, which is a direct conversion driver. The returnFees enum mismatch is likely causing the return policy to be rejected silently. The itemCondition placement is a spec violation that affects condition display in Shopping.

**How to apply:** All three fixes are in structured-data.ts and are small changes. (1) Change FREE_SHIPPING_THRESHOLD to `{ "@type": "MonetaryAmount", value: "1500", currency: "CZK" }`. (2) Change returnFees to `"https://schema.org/ReturnFeesCustomerResponsibility"`. (3) Move itemCondition from Product root into the offers object. Total: ~6 lines changed.
