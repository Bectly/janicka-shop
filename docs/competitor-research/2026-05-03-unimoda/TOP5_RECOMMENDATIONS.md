# Top 5 Recommendations — Unimoda → Janička

**Sorted by ROI (value × effort⁻¹). Manager-tactical to pick which to dispatch as task_ai bundles.**

---

## ★ #1 — Per-product physical measurements (cm) on PDP

**Verdict**: ✅ **YES — implement**
**Effort**: M (2-3 days, full-stack)
**ROI**: Highest. Sizing trust is the #1 driver of returns in second-hand fashion (Baymard 90% PDP fail rate). Each avoided refund saves ~120 Kč round-trip + reshelf cost.

### Why it works for Janička's business model
- **Concern raised**: "znamená to i jiný obrázek pro každý typ oblečení" — yes, but only **6-8 SVG icons total** (šaty / top / kalhoty / sukně / bunda / kabát / overal / doplněk). One-time asset cost, then reused per product.
- **Manual measurement burden**: Janička already photographs each item manually — adding a 30-second measure step (tape measure, 4 numbers) into the existing flow is incremental, not a new workflow.
- **Janička's qty=1 unique-piece model is PERFECT for measurements** — every item is uniquely measured, no SKU-scaling problem like fast fashion has.

### Acceptance criteria
- [ ] `Product` schema gets `measurements: Json` field (or `ProductMeasurement` table for normalisation): keys per category (e.g., dress = `{lengthCm, chestCm, waistCm, sleeveCm}`, pants = `{lengthCm, waistCm, hipCm, inseamCm}`).
- [ ] Admin form (`src/app/(admin)/admin/products/[id]/edit`) renders the right input set based on selected category, with cm validation (10-200).
- [ ] PDP component (`src/components/shop/product-detail.tsx` or sim.) renders measurements section below size selector when populated. Each row: label + value + unit. Section title "Rozměry kusu" with helper text "Měřeno na položeném oblečení".
- [ ] Per-category garment SVG icon rendered next to measurements (small, ~80px). 6-8 SVGs in `public/icons/garment/` — assets done by Sage.
- [ ] Mobile: collapsible accordion (default expanded since this is the trust signal).
- [ ] If measurements absent, section hidden (no empty state).
- [ ] Backfill script for top 50 best-selling categories (manual data entry — bectly task or admin onboarding).
- [ ] Heureka/GMC structured data updated: include measurements as `additionalProperty`.

**Janička feature is ready when**: a customer can see "Délka 86 cm, Šířka přes prsa 41 cm" on any newly-listed dress, and admin can enter these in <30s during product creation.

---

## ★ #2 — "Moje míry" personal measurements profile + PDP fit comparison

**Verdict**: 🟡 **PARTIAL — implement but only AFTER #1**
**Effort**: M (2-3 days)
**ROI**: Multiplier on #1. Solo it is useless; combined it's the killer feature.

### Why it works
- We have NextAuth + customer accounts (memory `customer_portal_c3709` confirms dashboard exists).
- LocalStorage-first approach lets anonymous users save measurements without registering — better UX than Unimoda's hard login wall.
- Comparison badges ("padne", "trochu volné", "trochu těsné") give instant fit signal per measurement row, directly addressing the #1 sizing concern.

### Acceptance criteria
- [ ] User profile field: `User.measurements: Json { chestCm, waistCm, hipCm, sleeveCm, bodyLengthCm }`.
- [ ] Anonymous fallback: localStorage key `janicka_my_measurements_v1` with same shape.
- [ ] Profile editor at `/ucet/mire` (logged-in) and inline modal "Vyplnit moje míry" on PDP for anonymous (saves to localStorage, prompts to register after).
- [ ] PDP comparison: each product measurement row shows tolerance badge based on diff from user value (±2cm = padne, +3-5 = volné, -3-5 = těsné, beyond = ⚠ vrátíte).
- [ ] Migration: when anon user registers, prompt "Uložit vaše míry do účtu?" → migrates from localStorage to DB.
- [ ] Privacy: measurements never sent to analytics; admin cannot view (PII).

**Janička feature is ready when**: a logged-in user with saved measurements visits any PDP with measurements populated, and sees fit badges next to each measurement row within 100 ms of page load.

---

## ★ #3 — "Notify on price drop" subscription per item

**Verdict**: ✅ **YES — quick win**
**Effort**: S (1 day backend + 1 email template)
**ROI**: High. Memory `lead_research_c2299` already cited "wishlist sold-item email 40% CR" — adjacent territory, same email-flow infrastructure.

### Why it works
- Janička's unique-piece inventory means price drops happen (admin lowers price after 30+ days unsold). Currently silent — buyers don't know.
- Email infrastructure is live (Resend wired, templates surfaced in admin per commit 95ac37e).
- Zero conflict with existing wishlist; this is "notify by item, not by tag".

### Acceptance criteria
- [ ] PDP CTA "Sledovat cenu" (next to wishlist heart) — opens email-prompt modal for anonymous users, one-click subscribe for logged-in.
- [ ] `PriceWatch` table: {userId|email, productId, currentPrice, createdAt}.
- [ ] On product price update in admin, trigger background job: find watchers with `currentPrice > newPrice`, send email "Cena snížená — {brand} {title} teď za {newPrice}".
- [ ] Unsubscribe link in email.
- [ ] Auto-expire watchers when product is sold (notify with "Bohužel prodáno" + 3 similar items).

**Janička feature is ready when**: an anonymous visitor enters their email in the price-watch modal, admin lowers the price in admin panel, the watcher receives an email within 5 minutes with the new price + product link.

---

## ★ #4 — Lite cart-lock for logged-in users (no prepaid wallet)

**Verdict**: 🟡 **PARTIAL — simplified version of Unimoda's reservation**
**Effort**: S-M (1-2 days)
**ROI**: Medium-high. Solves the "I want to keep browsing without losing this piece" problem without the friction of prepaid credit.

### Why this beats Unimoda's full reservation
- Unimoda requires prepaid credit on the wallet to reserve. Janička's 18-35 demo will not pre-load funds — we'd build the feature and nobody would use it.
- A 30-min auth-gated cart-lock captures 70% of the value (anti-FOMO browsing) at 20% of the build cost.
- Aligns with our existing cart abandonment infrastructure (commit 5e25138).

### Acceptance criteria
- [ ] When a logged-in user adds an item to cart, set `Product.lockedUntil = now + 30min, lockedBy = userId`.
- [ ] Other users see "Aktuálně v košíku jiného zákazníka, zkuste za chvíli" if they try to add.
- [ ] Lock auto-extends on cart interaction (any cart page hit), expires 30 min after last activity.
- [ ] Lock released on order completion (move to permanent sold) OR cart removal OR expiry cron.
- [ ] PDP shows countdown badge "Drženo pro vás 28:42" only to the lock owner.
- [ ] Cron job every 5 min sweeps expired locks.
- [ ] Anonymous users get current behaviour (no lock — they race for it).

**Janička feature is ready when**: User A (logged in) adds item X to cart, User B in another browser tries to add X within 30 min and sees "drženo" message + can sign up for back-in-stock if A abandons.

---

## ★ #5 — Per-category garment diagram icons (paired with #1)

**Verdict**: ✅ **YES — quick win, asset-only work**
**Effort**: XS-S (4-6 hours, mostly Sage / SVG asset)
**ROI**: Low cost, real polish. Makes measurements section feel professional vs raw text.

### Why it's a separate item
- Splittable from #1 — measurements ship first as text-only, icons added in follow-up cycle.
- Pure asset work: 6-8 SVGs (dress / top / pants / skirt / jacket / coat / overall / accessory) + a category→icon mapping.
- Unimoda uses this exact pattern; visually it converts a "boring data list" into a "this brand cares about fit" signal.

### Acceptance criteria
- [ ] 6-8 monoline SVG icons in `public/icons/garment/` matching Janička's design system (thin stroke, neutral colour).
- [ ] Mapping in `src/lib/garment-icons.ts`: `categorySlug → iconPath`.
- [ ] PDP measurements section renders icon to right of measurement list (desktop) or above (mobile), max 80×80px.
- [ ] Fallback: generic clothing icon if category not mapped.
- [ ] No measurement-point labels on the icon (Unimoda doesn't do this either) — just a category-typing visual.

**Janička feature is ready when**: a PDP for a dress shows the dress silhouette icon next to its measurements, a PDP for pants shows the pants icon — and Sage signs off on visual consistency with the rest of the design system.

---

## Recommendations summary for Manager-tactical

If you can dispatch 1 thing this cycle: **#1** (measurements). Largest ROI, addresses #1 second-hand pain, no business-model conflict.

If you can dispatch 3: **#1 + #3 + #5**. Measurements + price-drop watcher + diagram icons — all S/M effort, complementary, all touch the PDP that's currently broken anyway (per C5180 P0-1 sold-out empty-state bug — fix that first).

If you can dispatch 5: add **#2** (Moje míry, after #1 lands) and **#4** (lite cart-lock — verify with bectly that the friction tradeoff makes sense before building).

**Do NOT dispatch**: Dutch auction, prepaid wallet system, mega-brands page (defer until 1000+ items), category-count nav (defer until inventory growth).
