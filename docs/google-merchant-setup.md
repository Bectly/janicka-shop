# Google Merchant Center — Setup Guide (bectly self-registration)

**Goal:** register janicka-shop in Google Merchant Center before the April 30 deadline,
unlocking Google Shopping listings, Performance Max campaigns, and Doppl-into-Search
Virtual Try-On (VTO) eligibility.

**Context:** the feed endpoint is production-ready — handling time, video links, custom
labels, product highlights, measurements, condition mapping, and all required apparel
attributes are already shipped. This doc closes the last gap: plugging the feed URL into
Merchant Center and verifying the account.

**Effort:** ~10–15 min of bectly self-service work in Google Merchant Center.
No code changes required.

**Hard deadline:** April 30, 2026 — Doppl-into-Search VTO fast-shipping eligibility
requires the feed to be registered and verified before this date.

---

## 0. Prerequisites

| Item | Check |
| --- | --- |
| Production site `https://jvsatnik.cz` returning 200 | ✅ |
| `/api/feed/google-merchant` live and token-gated | ✅ (code on `main`) |
| `FEED_SECRET` set in Vercel prod env | verify in Vercel → Settings → Environment Variables |
| Google account for Janička | **bectly must use/create** |

The feed URL for step 4 is:

```
https://jvsatnik.cz/api/feed/google-merchant?token=<FEED_SECRET>
```

Pull `FEED_SECRET` from Vercel or JARVIS `api_keys` table — do not paste
it into this doc or any public ticket.

---

## 1. Create / open the Merchant Center account

1. Go to <https://merchants.google.com/> → **Get started**.
2. If a Google account exists for the shop, sign in with it. Otherwise create a new one.
3. Business name: `Janička` (matches the shop brand).
4. Country: **Česká republika**. Time zone: **Europe/Prague**.
5. Click **Create account**.

---

## 2. Verify and claim jvsatnik.cz

> Google requires domain ownership before accepting feed data.

**Recommended: HTML meta tag method (fastest)**

1. In Merchant Center: **Business info → Website** → enter `https://jvsatnik.cz` → click **Continue**.
2. Google shows a `<meta name="google-site-verification" content="...">` tag.
3. Add it to the `<head>` of your homepage. In Next.js, add to `app/layout.tsx`:
   ```tsx
   export const metadata: Metadata = {
     verification: { google: "PASTE_TOKEN_HERE" },
     // ...existing metadata
   };
   ```
4. Deploy to Vercel (automatic on push to `main`).
5. Back in Merchant Center → **Verify** → **Claim**. ✅

---

## 3. Configure business info

1. **Business info → About your business**:
   - Business type: **Individual seller / Sole trader** (fyzická osoba)
   - Category: **Apparel & Accessories → Women's Clothing → Pre-owned**
2. **Shipping settings** → **Add shipping service**:
   - Service name: `Standardní doručení`
   - Countries: **Czech Republic**
   - Currency: **CZK**
   - Delivery time: 2–4 business days
   - Rate: fixed / by order value (match what the feed says)
   > Note: the feed already includes per-item `<g:shipping>` tags — these take
   > precedence. The account-level setting is the fallback/verification step.
3. **Return policy** → add a basic 14-day return window (legal requirement CZ).

---

## 4. Register the product feed

1. **Products → Feeds → Add feed** (blue `+` button).
2. Configure:
   | Field | Value |
   | --- | --- |
   | Country | Czech Republic |
   | Language | Czech |
   | Destinations | Shopping ads, Free listings, Surfaces across Google |
   | Feed name | `janicka-main-feed` |
   | Input method | **Scheduled fetch** |
3. Feed URL:
   ```
   https://jvsatnik.cz/api/feed/google-merchant?token=<FEED_SECRET>
   ```
4. Fetch frequency: **Daily**. Fetch time: `03:00` (low-traffic window).
5. File type: **XML / RSS** (auto-detected from Content-Type header).
6. Click **Create feed** → Merchant Center fetches immediately for the first review.

---

## 5. Fix common initial errors

After the first fetch, check **Products → Diagnostics** for warnings.
Expected items for a second-hand apparel shop:

| Warning | Resolution |
| --- | --- |
| Missing GTIN / UPC | ✅ Already handled — feed sets `<g:identifier_exists>false</g:identifier_exists>` |
| Condition not set | ✅ Feed maps to `new` / `used` per GMC spec |
| Missing gender / age_group | ✅ Set to `female` / `adult` in all items |
| Missing brand | Warn-only for pre-owned; feed includes brand where available |
| Image too small (<250px) | Check R2 bucket — prod images should be ≥800px |

---

## 6. Enable free listings and Shopping ads

1. **Growth → Manage programs** → enable **Free product listings**. Free, immediate.
2. If Google Ads account exists: link via **Settings → Linked accounts → Google Ads**.
3. Optional now, needed for paid traffic: create a **Performance Max** campaign targeting
   the `janicka-main-feed`.

---

## 7. Doppl-into-Search VTO eligibility (April 30 deadline)

Virtual Try-On requires the feed to satisfy Google's fast-shipping signals:

| Signal | Status |
| --- | --- |
| `<g:min_handling_time>1</g:min_handling_time>` | ✅ In feed |
| `<g:max_handling_time>2</g:max_handling_time>` | ✅ In feed |
| `<g:video_link>` where video exists | ✅ In feed |
| Account verified + feed registered | **pending bectly action** |

Once the feed is registered and passes initial review (usually within 24–48h),
the fast-shipping badge and VTO eligibility activate automatically.

**Complete steps 1–4 by April 28 to leave a 48h buffer before the April 30 cutoff.**

---

## 8. Smoke test the feed URL

Before registering, confirm the feed returns valid XML:

```bash
# Replace TOKEN with your FEED_SECRET
curl -s "https://jvsatnik.cz/api/feed/google-merchant?token=TOKEN" | \
  python3 -c "import sys,xml.etree.ElementTree as ET; ET.parse(sys.stdin); print('XML valid')"
```

Or open the URL in a browser — you should see an RSS/XML document with `<item>` entries
for each published product.

---

## Done checklist

- [ ] Merchant Center account created
- [ ] jvsatnik.cz verified and claimed
- [ ] Shipping settings configured
- [ ] Feed URL registered (scheduled daily fetch)
- [ ] First fetch completed without critical errors
- [ ] Free listings enabled
- [ ] (Optional) Google Ads linked for paid campaigns
