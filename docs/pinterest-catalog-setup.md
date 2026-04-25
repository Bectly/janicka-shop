# Pinterest Catalog — Setup Guide (bectly self-registration)

**Goal:** ship the live Pinterest Catalog for Janička, unlocking Shopping Pins,
Rich Pins, and Pinterest Ads against 3.15 M CZ Pinterest users (per Scout
April 2026 research). Currently zero Czech second-hand fashion shops operate
a Pinterest Catalog — first-mover advantage.

**Context:** the feed endpoint is already production-ready and has been in
`main` for weeks. This doc closes the last gap — claiming the domain and
plugging the source URL into Pinterest Business.

**Effort:** ~30–45 min of bectly self-service work in Pinterest's dashboard.
No code changes required. Parallel path to the GMC registration (#14) —
neither blocks the other.

---

## 0. Prerequisites

| Item | Check |
| --- | --- |
| Production site `https://jvsatnik.cz` returning 200 | ✅ |
| `/api/feed/pinterest` live and token-gated | ✅ (code on `main`) |
| `FEED_SECRET` set in Vercel prod env | verify in Vercel → Settings → Environment Variables |
| Pinterest Business account | **bectly must self-register** (step 1) |

The feed URL for step 5 is:

```
https://jvsatnik.cz/api/feed/pinterest?token=<FEED_SECRET>
```

Pull `FEED_SECRET` from Vercel or the JARVIS `api_keys` table — do not paste
it into this doc or any public ticket.

---

## 1. Create a Pinterest Business account

1. Go to <https://business.pinterest.com/> → **Join as a business** (free).
2. Business name: `Janička — Vaše šatník` (or whatever matches the shop brand).
3. Country: **Česko**. Language: **Čeština**. Currency: **CZK**.
4. Business type: **Retailer** → **Apparel & Accessories** → **Used / Pre-owned clothing**.
5. Website: `https://jvsatnik.cz`.

If a personal Pinterest account already exists, convert it via
**Settings → Account management → Convert to business** instead of creating a
second one — keeps any accumulated activity.

## 2. Claim the jvsatnik.cz domain

Pinterest gates Catalog + Rich Pins behind a claimed domain. Two options —
**use the HTML tag method**, it's the one the codebase already supports.

1. In Pinterest: **Settings → Claimed accounts → Claim website → Add HTML tag**.
2. Pinterest shows a tag like:
   ```html
   <meta name="p:domain_verify" content="abc123def456..."/>
   ```
   Copy just the `content` value (the `abc123def456...` token).
3. Add it to Vercel env:
   - Dashboard → `janicka-shop` project → Settings → Environment Variables.
   - Name: `PINTEREST_SITE_VERIFICATION`, value: the token from step 2.
   - Environments: **Production** (not preview/dev).
4. Redeploy (push a no-op commit or hit **Redeploy** in Vercel dashboard on
   the latest production deployment).
5. Back in Pinterest → **Submit for review**. Verification usually completes
   in <5 min; worst case 24 h.

**Why this works:** `src/app/layout.tsx` reads `PINTEREST_SITE_VERIFICATION`
and emits the meta tag via Next.js' `metadata.verification.other` field when
the env var is set. Leave the env var unset and no tag is emitted — no
leakage on preview deploys.

**Fallback** (only if env approach misbehaves): Pinterest also accepts DNS
TXT record (`_pinterest-domain-verify.jvsatnik.cz`) or a file upload to
`/public/pinterest-<hash>.html`. Prefer the env-var path — cleaner rollback.

## 3. Verify Rich Pins

Rich Pins are auto-enabled once Pinterest sees product structured data on the
site. Janička already emits `Product` JSON-LD on every PDP
(`src/lib/structured-data.ts`).

1. Validator URL: <https://developers.pinterest.com/tools/url-debugger/>.
2. Paste any PDP URL, e.g. `https://jvsatnik.cz/products/<slug>` — pick an
   in-stock piece from the active catalog (homepage has the newest).
3. Expected output: **"This URL is valid for a Product Rich Pin"** with
   name, price, availability, brand populated from the JSON-LD.
4. If validation fails, open devtools → Network → response HTML, search
   `application/ld+json`, confirm the block contains `"@type":"Product"`
   with `offers.price` + `offers.availability`. If it's missing, bectly
   should file a bug (unlikely — covered by Trace #367).

Rich Pins do not need separate enablement after this — Pinterest enables
them domain-wide once the first URL validates.

## 4. Create the Catalog data source

1. Pinterest → **Ads → Catalogs → Create data source**.
2. Data source type: **Feed file**.
3. Name: `Janička — Second hand — CZ`.
4. Feed URL:
   ```
   https://jvsatnik.cz/api/feed/pinterest?token=<FEED_SECRET>
   ```
   Paste the real `FEED_SECRET` from Vercel. Pinterest fetches the URL
   server-side; the token never leaks to users.
5. Format: **TSV** (tab-separated). Pinterest auto-detects from the
   `Content-Type` header (`text/tab-separated-values`).
6. Encoding: **UTF-8**.
7. Currency: **CZK**.
8. Country: **Czech Republic**.
9. Fetch schedule: **Daily** at 04:00 UTC (pre-morning traffic).
10. Submit. First ingest runs immediately — takes 5–15 min for the first
    few hundred items.

## 5. Monitor the first ingest

Pinterest → **Catalogs → [your source] → Overview** shows:

- **Total products submitted** — should match `active=true AND sold=false`
  in the DB (query: `SELECT COUNT(*) FROM Product WHERE active=1 AND sold=0`).
- **Approved** — green count that become shoppable.
- **Rejected** — check the **Diagnostics** tab for reason. Common first-run
  issues:
  - `invalid_image_link` → R2 public URL not reachable (verify CDN is warm).
  - `missing_required_field` → run `tsx scripts/test-pinterest-feed.ts` to
    audit locally.
  - `invalid_gtin` → ignore; second-hand uniques don't have GTINs.

Re-ingest after fixes: **Catalogs → data source → Fetch now**.

## 6. Pre-flight schema validation (dev / before each big catalog change)

Run the schema test before submitting the source URL, and anytime the feed
route changes:

```bash
# against local dev (npm run dev must be running)
FEED_URL="http://localhost:3000/api/feed/pinterest" \
  tsx scripts/test-pinterest-feed.ts

# against production (needs FEED_SECRET in env)
FEED_URL="https://jvsatnik.cz/api/feed/pinterest?token=$FEED_SECRET" \
  tsx scripts/test-pinterest-feed.ts
```

Exit code 0 = Pinterest-schema-compliant. Exit code 1 = fix before upload.
Script asserts column headers, required fields, enum values, price format,
link/image URL shape, and Google taxonomy ID.

## 7. Post-launch — Shopping + Ads

Once the catalog is approved:

- **Shopping Pins**: auto-generated from the catalog. Track impressions in
  Pinterest Analytics → Organic reach.
- **Product groups**: create in Pinterest UI for campaign targeting
  (e.g. `Šaty pod 1000 Kč`, `Kožené bundy`). No code needed.
- **Ads**: **Shopping campaign** type uses the catalog directly. Bectly
  budget call — recommend small test (100–200 Kč/day) on top 20 pinned
  items once organic reach proves category fit.

---

## Checklist — hand-off for bectly

- [ ] **Step 1** — create Pinterest Business account at business.pinterest.com
- [ ] **Step 2** — claim domain via `PINTEREST_SITE_VERIFICATION` env in Vercel → redeploy → submit for review
- [ ] **Step 3** — validate one PDP via <https://developers.pinterest.com/tools/url-debugger/>
- [ ] **Step 4** — create Catalog data source pointing at `/api/feed/pinterest?token=<FEED_SECRET>`
- [ ] **Step 5** — first ingest: check approved count in Diagnostics
- [ ] **Step 6** — (dev-side, already done) `tsx scripts/test-pinterest-feed.ts` green
- [ ] **Step 7** — (later) set up Shopping campaign once organic reach proves traction

---

## Reference

- Pinterest Catalog docs: <https://help.pinterest.com/en/business/article/data-source-ingestion>
- Rich Pins: <https://help.pinterest.com/en/business/article/rich-pins>
- URL debugger: <https://developers.pinterest.com/tools/url-debugger/>
- Feed endpoint (code): `src/app/api/feed/pinterest/route.ts`
- Schema validator: `scripts/test-pinterest-feed.ts`
- Scout research context: `.claude/projects/.../memory/scout_research_april_2026_update8.md`
  (Pinterest Rich Pins deep-dive — 3.15 M CZ users, zero competition)
