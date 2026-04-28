# Audit — Proč přepínání sekcí trvá 3-5 s na Vercelu

**Cycle:** #5128 · **Agent:** Bolt · **Task:** #904 · **Datum:** 2026-04-28
**Symptom (bectly):** „na Vercelu je to pomalé… přepínání sekcí trvá 3-5 s". Není to cold start (<2 s).
**Metoda:** kódový audit (žádný kód) — repo HEAD `e04a40c`. Live network capture nedostupný (CLI prostředí), proto reálná měření jsou hypotézy stavěné na statické analýze + dostupných manifestech (`.next/prerender-manifest.json`, `.next/static/chunks/*`).

---

## 1. Smoking gun — Turso DB je v **us-west-1**

`grep TURSO_DATABASE_URL .env.local` vrací host končící `…-west-1.turso.io`.
Vercel `vercel.json` neobsahuje `"regions"` → Vercel funkce běží v defaultním regionu (Hobby/Pro = `iad1`, deployer-based, často EU pro CZ účet).

| Vercel region | RTT k Turso us-west-1 | Komentář |
|---|---|---|
| `iad1` (Virginia) | ~70 ms | nejlepší dostupný case |
| `cdg1` / `fra1` (EU) | ~140-160 ms | transatlantický single-hop |
| `arn1` (Stockholm) | ~150-170 ms | reálně blízký CZ uživateli |

**Každá Prisma query = jeden sériový round-trip.** Pokud route udělá 6 sekvenčních dotazů, přidává to **840-960 ms** čistého netto wait time bez ohledu na velikost dat. To je ~⅓ celého rozpočtu „3-5 s".

> Citace: `src/lib/db.ts:40-49` — `PrismaLibSQL` adapter se pokaždé inicializuje na cold start (`await import("@prisma/adapter-libsql/web")`), což je dalších 200-400 ms při studené funkci.

---

## 2. Top 5 podezřelých routes — breakdown

### 2.1 `/` (homepage) — **střední riziko**

`src/app/(shop)/page.tsx`

* `await connection()` (line 562) — celá page je dynamic.
* Každá sekce má **vlastní `"use cache"`** (`getNewProducts`, `getFeaturedProducts`, `CategoriesSection`, `SaleProducts`, `PopularBrands`, `FeaturedCollections`, `RecentlySold`) → 7+ samostatných cache wrapperů.
* Při studeném cache (po deployu, po `revalidateTag('products')`): **7 sekvenčních volání `getDb()` + Prisma queries** → 7× ~150 ms = **~1 s server-side** jen na DB.
* Sekce jsou ve vlastních `<Suspense>`, takže streamy jdou paralelně po prvním flush. Static shell přijde rychle, ale RSC payload pro chybějící sekce (server-render → klient) **na navigaci** (klik z PDP zpět na home) musí dojet všechen.
* `JsonLdSection` (line 504) reusuje cached fetches — OK, žádný extra cost.

### 2.2 `/products` (katalog) — **vysoké riziko, RSC payload bloat**

`src/app/(shop)/products/page.tsx:98-103`

```ts
db.product.findMany({
  where: { active: true, sold: false },
  include: { category: { select: { slug: true, name: true } } },
  orderBy: { createdAt: "desc" },
  take: 2000,                  //  ← !!
});
```

* Posílá až **2000 produktů** v RSC payloadu kvůli klient-side filtrování v `<ProductsClient>`.
* Po trim (max 2 obrázky per produkt, popis 160 znaků) je payload **odhadem 0.8-1.5 MB JSON** (před gzip; po gzip ~250-400 KB).
* Druhotný plus: `getLowestPrices30d` se volá **uvnitř cache wrapperu** přes `priceHistory.findMany` + `product.findMany` po IDs → další 2 round-tripy do Turso při cache miss.
* Když je `params.category` zadán, line 191 **dělá další netto Prisma query mimo cache** (`db.category.findUnique`) — neoptimalizovaný hot path.

### 2.3 `/admin/orders` — **vysoké riziko**

`src/app/(admin)/admin/orders/page.tsx:40-58`

* `take: 200` orderů s vnořeným join na customer + `_count: items` → 1 query, ale včetně relations je to **velký payload**.
* Cache je `cacheLife("minutes")` + tag `admin-orders` → revalidováno často.
* Layout `AdminAuthGate` (`src/app/(admin)/admin/layout.tsx`) má **3 sekvenční dynamic operace** před každým paint:
  1. `auth()` — NextAuth session decode
  2. `db.admin.findUnique({ email })` — onboardedAt check **bez `cache()` wrapperu** (line 53)
  3. `getAdminBadges()` — 3 paralelní queries (cached)

   Ad 2: `findUnique` po `email` query běží **na každou admin navigaci** v každé funkci. Layout sice persistuje napříč klienty, ale RSC route fetch znovu ověří layout-level dynamic holes, takže to **běží skutečně na každý klik** v admin UI.

### 2.4 `/admin/orders/[id]` (detail objednávky) — **střední riziko, duplicitní query**

`src/app/(admin)/admin/orders/[id]/page.tsx`

* `generateMetadata` (line 32-42) volá `db.order.findUnique({ select: { orderNumber } })`.
* `default export` (line 49-77) **znovu** volá `db.order.findUnique` se širším include.
* **Žádný `cache()` wrapper** → 2 nezávislé round-tripy do Turso pro stejný order. ~150-300 ms zbytečně.

### 2.5 `/products/[slug]` (PDP) — **nízké riziko**

* `getProduct(slug)` má `"use cache"` + Redis cache-aside (`@/lib/products-cache.ts`) → cold path = 1 Redis GET + Prisma fallback. OK.
* `RelatedProductsSection` je v `<Suspense>` → streamuje. Ale když je produkt `sold`, dělá **dvě sekvenční Prisma queries** (line 150-154: `findUnique` pro condition, pak `findMany` candidates) → 2 round-tripy. Drobný over-fetch.

---

## 3. Header — **dynamic hole na každý shop nav**

`src/components/shop/header.tsx:17-22`

```ts
async function HeaderNav() {
  await connection();
  const categories = await getCategoriesWithCounts();
  const session = await auth();
  …
}
```

`src/lib/category-counts.ts` — **NENÍ** wrapped v `"use cache"` ani `cache()`. Header je v shop layoutu → s App Router layout sice persistuje, ale s `cacheComponents: true` (PPR) je tahle dynamic hole součástí každého RSC payloadu pro nové route. Tj. **každá shop navigace platí 1 Prisma query na kategorie + 1 NextAuth decode**.

---

## 4. Bundle bloat — minor, ne hlavní příčina

`.next/static/chunks/`:
* Total: **4.0 MB / 112 chunks** (server build).
* Top 2 chunks: `0y3xj~v2ilc_x.js` 388 KB, `01etl1k70ekbs.js` 388 KB (duplikáty? podezřelé — nejspíš framework + react vendor).
* CSS chunk: `0b4ncys1n41ed.css` 253 KB — velké, ale to je už po `optimizeCss` + critical inline.

**Bundle není hlavní viník 3-5 s** (parse + execute na moderním CPU sub-100 ms). Ale 388 KB shared chunk je nadprůměr — stojí za hlubší rozbor přes `ANALYZE=true npm run build` (next bundle analyzer je už nakonfigurovaný v `next.config.ts:6`).

---

## 5. Top 3 hypotézy + jak rychle ověřit

| # | Hypotéza | Verifikace (≤30 min) | Očekávané saving |
|---|---|---|---|
| **H1** | **Turso v us-west-1 + Vercel v EU = 100-160 ms per query.** Hlavní příčina ~50-60 % zpoždění. | `vercel inspect <deploy-url>` → vrátí region funkce. Pak v Vercel logu `RESPONSE_TIME` u `/admin/orders` versus počet Prisma queries. Alternativně: dočasné `console.time` v `getDb` + jedna query, log na Vercel. | **1.5-2.5 s** kdyby se DB přesunul do EU regionu (Turso → fra/lhr replika) |
| **H2** | **Header `getCategoriesWithCounts` + `auth()` jsou non-cached dynamic holes** na každou shop nav (~150-300 ms blokuje RSC paint). | Přidat `console.time('header-nav')` v `HeaderNav`, deploy preview, klikat. Vercel log ukáže per-render čas. | **200-400 ms** (zabalit do `"use cache" + cacheLife("hours") + cacheTag("categories")`, invalidovat při category mutation) |
| **H3** | **`/products` posílá 2000-řádkový RSC payload** → 250-400 KB gzip, 1-2 s parse + hydration na střední Android. | Chrome DevTools → Network → filter `?_rsc` → měřit transfer + parsing time. Lighthouse mobile score. | **800-1200 ms** kdyby se přepnulo na server-paginaci (25-50 produktů per page) + `revalidateTag('products')` na adminu |

---

## 6. Top 3 quick wins (každý ~1 den, kvalifikovaný odhad)

### QW-1: Cache `getCategoriesWithCounts` v Header (~2 h)

`src/lib/category-counts.ts` — wrap v `"use cache" + cacheLife("hours") + cacheTag("categories")`. Invalidovat ve všech `categories/actions.ts` mutacích.
**Odhadovaný gain:** −200-400 ms na **každou** shop navigaci.

### QW-2: Dedup `db.order.findUnique` v `/admin/orders/[id]` (~1 h)

Wrap v `import { cache } from "react"` + sjednotit fields tak, aby `generateMetadata` četl ze stejného volání jako page.
**Odhadovaný gain:** −150-300 ms na detail objednávky.

### QW-3: Turso embedded replica nebo regionální replika (~1 den, **největší dopad**)

Buď:
* Přepnout `@libsql/client` → `@libsql/client/web` s **embedded replikou v `/tmp`** (Vercel funkce má `/tmp` writable) — RTT klesne z 100-160 ms na **<5 ms** (čte z lokální SQLite kopie, sync v pozadí).
* Nebo požádat Turso o repliku v EU regionu (`fra`, `ams`) a v `db.ts` použít `syncUrl` pattern.

**Odhadovaný gain:** −1.5-2.5 s na cold cache misses. Nejúčinnější jediný change.

> Pozor: embedded replika znamená čtení = lokální, zápisy = stále primary (write přes net). Pro admin mutace si přidá ~150 ms na write — akceptovatelné, admin akcí je řád.

---

## 7. Verdikt — kód vs. infrastruktura

| Příčina | Doba | Řešení |
|---|---|---|
| **Turso us-west-1 latence** (H1, QW-3) | **1.5-2.5 s** | infrastruktura — replika v EU nebo embedded replica |
| Non-cached header DB query (H2, QW-1) | 200-400 ms | kód — 1 cache wrapper |
| Non-cached layout DB queries (admin onboardedAt) | 100-200 ms | kód — `cache()` wrapper nebo přidat na session |
| RSC payload bloat /products (H3) | 800-1200 ms (mobile) | kód + UX — server pagination |
| Duplicitní `findUnique` v order detail (QW-2) | 150-300 ms | kód — `cache()` wrapper |
| **CELKEM kódové fixy** | **~1.2-2.0 s** | 1-3 dny implementace |
| **CELKEM infrastruktura** | **~1.5-2.5 s** | 1 den (Turso replika) |

**Závěr:** **~50-60 % problému (1.5-2.5 s) je infrastruktura — Turso v us-west-1.** Zbytek (~1.2-2.0 s) jsou kódové fixy.

**Doporučení Manageru:**
1. **Před** Hetzner migrací zkusit **Turso EU repliku / embedded replica** — to je nejlevnější win s největším dopadem. Když to vyřeší 50 % bolesti, Hetzner přestává být urgent.
2. Paralelně QW-1 + QW-2 (≤4 h celkem) → −500-700 ms na běžnou navigaci.
3. QW-3 katalog server-pagination — větší refaktor, samostatný sprint.

---

## Appendix — co by měl Bolt / Trace ověřit naměřením

* Zapnout `PERF_PROFILE=1` (už existuje hook v `admin/layout.tsx:14`) + `PERF_PROFILE_PRISMA=1` (existuje v `db.ts:11`) na preview deploy. Vercel log → wall-clock per stage.
* Vercel Speed Insights → CRUX p75 LCP/TBT/FID per route (pokud má bectly přístup, screenshot — REST API není dostupné, vizjarvis projekt #621).
* `ANALYZE=true npm run build` → bundle analyzer, identifikovat duplicitní 388 KB chunks.
* `npx wrangler tail` na produkci nebo `vercel logs --follow` během kliknutí.
