# Unimoda.cz — Competitive Feature Analysis

**Date**: 2026-05-03
**Researcher**: Scout (Cycle #5180, task #959)
**Target**: https://unimoda.cz — czech second-hand designer shop, online since 2004
**Stack (fingerprint)**: OpenCart (URL routes `index.php?route=`, `.html` SEO URLs, classic PHP template structure)
**Inventory**: ~34,400 items live (25,990 women / 5,319 men / 1,000 children / 1,170 shoes / 925 accessories)
**Trust signals**: Firmy.cz badge 4.8 (95 hodnocení), 21-year track record, "actress endorsement" testimonial (Vlastina Svátková)

---

## Executive Summary

Unimoda is **20× larger than Janička in inventory** and 21 years older, but visually feels like a 2010-era OpenCart store: dense product grid, no hero, brutal information density. They beat us on **two real differentiators** that bectly correctly flagged:

1. **Per-product physical measurements (in cm) on PDP** with a per-category diagram icon and a "Moje míry" personal measurement profile that auto-compares.
2. **Reservation system** — 10-day hold via prepaid credit, lets buyers consolidate multiple items into one shipment (saves shipping cost).

They also operate a **Dutch auction** sub-category, **Příhozy** (bidding) and **Příhozy/Notify-on-price-drop** subscriptions on individual items.

We beat them on: visual design, mobile UX, PDP gallery polish, modern checkout, SEO structured data, performance. Their dense grid is hostile on mobile (cards cramped, sub-200px wide).

**Bottom line for Manager-tactical**: of the 5 features below, **#1 (measurements + Moje míry)** and **#2 (reservation system)** are worth implementing. The others are either business-model mismatches (Dutch auction) or already-on-roadmap (back-in-stock, wishlist).

---

## Feature Inventory

### F1 — Per-product measurements (CM) on PDP
**Screenshots**: `pdp-dress-d.png`, `pdp-measurements-d.png`, `pdp-measurements-m.png`
**What**: Below the size selector, the PDP lists physical garment measurements:
- Délka: 86 cm
- Šířka přes prsa: 41 cm
- Šířka vrchního pasu: 42 cm
- Délka rukávu: 44 cm

Each measurement row has a tiny **"+ Add"** button (adds to user's personal measurement profile for comparison) and the section is anchored to the right side with a **small black-line diagram icon of the garment type** (a dress silhouette in this case) — not labelled measurement points on the diagram, just a category-typing visual.

**Tech guess**: OpenCart custom attribute fields (per product, manually entered by admin). The diagram is one static SVG/PNG per category. The "Add to Moje míry" button posts to user-account API.

**Janička equivalent**: ❌ NONE. We have `condition`, `size`, `brand`, `color`. No physical measurements field on Product, no "My measurements" user profile.

**Value**: 🔥 HIGH. For second-hand unique pieces, sizing is the #1 trust gap (Baymard: 90% of apparel PDPs fail size/fit). Every refund avoided = repacking + reshipping cost (~120 Kč) + potential resale loss (item may sit weeks before re-selling). Memory `measurements_cm_field` confirms this is already in our backlog as task added in C2289.

### F2 — "Moje míry" personal measurement profile
**Screenshots**: `pdp-moje-miry-modal-d.png` (modal redirected to login wall — confirms gated by user account)
**What**: Logged-in users save their own measurements once (chest, waist, hip, sleeve, length per garment-type). On every PDP, system compares product measurements vs theirs and (presumably) shows fit indicator. Anonymous users see CTA to register.

**Tech guess**: User profile JSON field (`measurements: { chest_cm, waist_cm, hip_cm, sleeve_cm, body_length_cm }`). Client-side comparison renders a "fits/tight/loose" badge per measurement.

**Janička equivalent**: ❌ NONE. We have NextAuth + customer accounts (memory `customer_portal_c3709` shows the dashboard infra exists), but no measurements profile.

**Value**: 🔥 HIGH but second-order — only useful AFTER F1 ships. Combined, F1+F2 are the killer second-hand sizing combo.

### F3 — Reservation system (10-day hold via prepaid credit)
**Screenshots**: `rezervace-d.png`, `rezervace-m.png`, PDP shows "Rezervace" button next to "Add to cart"
**What**: User pre-loads credit on account → reserves item for up to 10 days → buys when ready, or cancels (credit refunded). Primary use case: **consolidate multiple second-hand items into one Packeta package** to save shipping. Reservation badge counter visible in nav (`Rezervace 0`).

**Tech guess**: `Reservation` table {userId, productId, expiresAt, creditHoldId}. Cron expires + releases. Wallet model on User.

**Janička equivalent**: ❌ NONE. Cart != reservation (cart doesn't lock inventory for unique items beyond session). We have abandoned-cart capture but no formal hold.

**Value**: 🟡 MEDIUM-HIGH. Solves a real second-hand pain (browse one piece at a time, want to bundle ship). But the **prepaid credit gate is friction** — Janička's 18-35 demo won't pre-load funds. A simpler "30-min cart-lock for logged-in users" could hit 70% of the value at 20% of the build cost.

### F4 — Příhozy (bidding) on individual items + Notify-on-price-drop
**Screenshots**: `aukce-d.png`, `aukce-m.png` (the `/aukce` URL is just a discount category — actual auctions are at `/holandska-aukce` which we couldn't fully scrape)
**What**: PDPs surface 3 CTAs: Add to cart / Reserve / **Notify-on-price-drop**. Separate "Holandská aukce" (Dutch auction) section where prices auto-decrease until bought.

**Tech guess**: Price-drop subscription = email subscriber table {userId, productId}. Dutch auction = scheduled price-decrement cron per item.

**Janička equivalent**: ❌ no price-drop notify. We have wishlist (`oblibene` route exists per memory). Memory `lead_research_c2299` referenced "wishlist sold-item email 40% CR" already — adjacent territory.

**Value**: 🟡 MEDIUM. Price-drop notify = easy win (1-day backend + email template), real CRO impact. Dutch auction = NO for Janička: works for Unimoda's 26k inventory churn problem (sit-too-long pieces), Janička's ~340 unique pieces doesn't have inventory rot at that scale.

### F5 — Brand-page navigation ("Značky")
**Screenshots**: `brands-d.png`, `brands-m.png` (8.8 MB shot — page is monstrous)
**What**: Dedicated `/znacky/` page listing all 200+ brands with item counts. Each brand → its own filtered PLP `/znacka/zara/`. SEO gold for long-tail "Zara second hand" searches.

**Tech guess**: Static brand pages auto-generated from product.brand field, each with H1 = brand name + brand description.

**Janička equivalent**: 🟡 PARTIAL. We have brand filter on PLP but no dedicated brand index page or per-brand SEO page (need to verify in `docs/STRUCTURE.md`).

**Value**: 🟡 MEDIUM. SEO long-tail wins for popular brands (Zara, H&M, Mango). At 340 items though, most brands have 1-2 pieces — pages would be empty. Wait until inventory crosses 1000+.

### F6 — Reservation/cart EXPIRY TIMER on PDP
**Screenshots**: visible in `pdp-dress-d.png` ("10 days hold")
**What**: Above the price, copy says "10 days hold with 'option to extend'". Creates urgency without being scammy because it's tied to the genuine reservation feature.

**Janička equivalent**: ❌ none. No hold mechanic.

**Value**: 🟢 NICE-TO-HAVE. Only meaningful if F3 (reservation) ships first.

### F7 — Vertical thumbnail gallery (left rail) on PDP
**Screenshots**: `pdp-dress-d.png`
**What**: 3 thumbnails stacked vertically left of the main image. Click to swap. Main image has zoom on hover.

**Janička equivalent**: ✅ WE WIN. Janička has horizontal swipe gallery + lightbox + recent zoom/pan/wheel improvements (commit 43e2e9c by Sage). Unimoda's static OpenCart gallery is inferior.

**Value**: SKIP — we already do this better.

### F8 — Cart consolidation messaging ("save shipping by reserving more pieces")
**Screenshots**: implied throughout — copy on `rezervace-info.html` says "ušetříte na poštovném pokud pošlete více kousků v jednom balíku"
**What**: Active copy nudge: every reservation page, cart page, and checkout step reminds you that bundling = cheaper shipping.

**Janička equivalent**: ⚠ partial — we have shipping cost shown in cart but no "add more to save" framing.

**Value**: 🟡 LOW-MEDIUM. Easy copy win on cart page ("Přidejte ještě 1 kus a zaplatíte stejně poštovné"). Tiny copy lift.

### F9 — Firmy.cz trust badge (95 hodnocení, 4.8/5)
**Screenshots**: visible left rail, every page
**What**: Persistent third-party rating badge. Czech equivalent of Trustpilot.

**Janička equivalent**: ❌ none. We have no third-party review badge.

**Value**: 🟡 LOW NOW (we don't have 95 reviews to show), HIGH LATER (post-launch). Track in growth roadmap.

### F10 — "Připravujeme" (preparing) category — pre-launch teaser inventory (542 items)
**Screenshots**: visible in left nav — `Připravujeme 542`
**What**: Items being processed for sale. Visible to logged-in users; "Notify when published" subscription.

**Janička equivalent**: ❌ none. We dump items live immediately.

**Value**: 🟢 NICE-TO-HAVE. Builds anticipation for repeat customers, but our drop cadence is too slow to need a queue page.

### F11 — Inline category counts in nav ("Dámské Oblečení 25990")
**Screenshots**: every page, left sidebar
**What**: Every nav category has its inventory count next to the label.

**Janička equivalent**: ❌ none on shop nav.

**Value**: 🟢 NICE-TO-HAVE. Subtle trust signal ("they have stuff") — but at 340 items the count works against us. Wait until 1000+.

### F12 — Free-shipping coupon code on first order (FREESHIP banner)
**Screenshots**: top bar of `home-d.png`
**What**: Persistent top-bar promo: "Get free shipping on first order with code FREESHIP".

**Janička equivalent**: ⚠ partial (we have announcement strip per recent C5180 visual sweep — currently buggy).

**Value**: 🟡 LOW. Free-shipping incentive is well known; we're roadmapped on this.

---

## Comparison Matrix

See `comparison-matrix.md`.

---

## Top 5 Recommendations

See `TOP5_RECOMMENDATIONS.md`.

---

## Anti-patterns — explicit DON'TS

These are things Unimoda does that **Janička should NOT copy**:

1. **Dense 5-column grid with sub-200px cards on mobile** (`plp-women-m.png`) — products crammed, badges illegible, Czech text wraps to 4 lines. Janička's larger 2-column grid is more shoppable for our demographic.
2. **No hero / no editorial / no aspiration** (`home-d.png` is wall-of-products) — works for Unimoda's "find a bargain" customer, fails for Janička's "discover something special" positioning. Don't drift toward bargain-bin.
3. **OpenCart cookie modal at bottom-left blocks "Add to cart" CTA on mobile** — they just leave it there. Janička's cookie modal is also flagged P1 in C5180 sweep — we should fix ours, not mimic theirs.
4. **/aukce/ is just a discount category, not auctions** — confusing IA. The actual Dutch auction lives at `/holandska-aukce`. Don't introduce new top-level routes that don't match the literal feature name.
5. **8.8 MB brands page** (`brands-d.png` is fully expanded brand list) — no pagination, no scroll virtualization. Slow on mobile. Build per-brand pages, not one mega-page.
6. **Prepaid credit gate on reservation** is heavy friction. If we ship reservation, **don't require credit upfront** — just lock the item for X minutes after authenticated cart-add.
7. **"Skladem"** language ("In stock") on second-hand unique items is misleading — implies restockability. Janička should keep "1 ks dostupný" or "Poslední kus" framing.
8. **Login required to use 'Moje míry'** — anonymous users get hard wall. Better UX: localStorage-first, save when account created.

---

## Methodology notes

- 22 screenshots captured (≥12 required) via Playwright headless: 10 base routes × 2 viewports + 2 mobile detail + 1 desktop measurements + 1 modal + 1 filter clip.
- Cookie modal dismissed via "Souhlasím/Přijmout" selector where present.
- WebFetch used for content extraction where Playwright DOM inspection wasn't needed.
- "Moje míry" modal click revealed login wall — confirms feature is account-gated.
- Auction mechanics for `/holandska-aukce` not deeply scraped — page returned thin content; would need authenticated session to see live bidding state. Documented as known gap.
- Checkout flow not entered (would require fake-customer registration + cart add) — documented from `/cart` empty state only.

## Files in this report
- `REPORT.md` (this file)
- `comparison-matrix.md`
- `TOP5_RECOMMENDATIONS.md`
- `screenshots/` — 22 PNGs, total ~50 MB (mobile screenshots are full-page captures, hence size)
