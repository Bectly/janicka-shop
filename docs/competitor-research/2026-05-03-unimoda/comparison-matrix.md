# Comparison Matrix — Unimoda vs Janička

| # | Feature | Unimoda | Janička | Why interesting | Effort | Priority |
|---|---|---|---|---|---|---|
| 1 | Per-product cm measurements on PDP (Délka/Šířka přes prsa/Šířka pasu/Rukáv) | ✅ Full, 4-6 measurements per item, manually entered | ❌ None — only size enum | Sizing trust = #1 second-hand return driver. Memory C2289 already flagged this. | M (schema + admin form + PDP UI + per-category template) | **P0** |
| 2 | "Moje míry" — saved user measurements + comparison on PDP | ✅ Account-gated profile, "+ Add" button per measurement row | ❌ None | Multiplies F1 value. After 1 saved profile, every PDP becomes self-personalising. | M (User schema + profile UI + comparison render) | **P1** (post-F1) |
| 3 | Per-category garment diagram icon next to measurements | ✅ Static SVG/icon per type (dress/top/pants/skirt etc.) | ❌ None | Visual shortcut to interpret which measurement is which. ~6 icons cover 95% of inventory. | S (6 SVGs + category-icon mapping) | **P2** (paired with F1) |
| 4 | Item reservation system (10-day hold, prepaid credit) | ✅ Full | ❌ None (cart != hold) | Lets buyers consolidate multiple items → 1 Packeta package = save shipping. | L (wallet + Reservation table + cron + checkout flow) | **P3** (validate need first) |
| 5 | Soft cart-lock for logged-in users (lite reservation, no credit) | ❌ N/A — they require credit | ❌ None | 70% of reservation value at 20% build cost. Locks unique item for 30 min after auth cart-add. | S | **P2** |
| 6 | "Notify on price drop" subscription per item | ✅ CTA on PDP | ❌ None (we have wishlist sold-item notify per memory C2299) | Easy CRO win — users opt-in for emails when item drops. | S (subscriber table + price-change cron + email template) | **P2** |
| 7 | Dutch auction (`/holandska-aukce`) — auto-decreasing prices | ✅ Sub-category | ❌ None | Solves inventory rot at 25k+ items. **Janička at 340 items doesn't have this problem.** | L | **SKIP** |
| 8 | Brand index page `/znacky/` + per-brand SEO landing | ✅ Full | ⚠ Brand filter only, no dedicated brand pages | SEO long-tail wins ("Zara second hand"). Useless until inventory has multiple items per brand. | M | **P3** (defer until 1000+ items) |
| 9 | Inline category counts in nav ("Dámské Oblečení 25990") | ✅ Every category | ❌ None on shop nav | Trust signal at scale. Works against Janička at small inventory. | XS | **SKIP for now** |
| 10 | "Připravujeme" / pre-launch teaser category | ✅ 542 items, notify-on-publish | ❌ None | Builds anticipation. Janička drop cadence too slow to need it. | S | **SKIP** |
| 11 | Reservation/cart expiry timer copy on PDP | ✅ "10 days hold, option to extend" | ❌ None | Urgency without scammy tactics. Only works if reservation ships. | XS (paired with F4) | P3 |
| 12 | Cart consolidation copy ("save shipping by adding more") | ✅ Active nudges throughout | ⚠ Shipping shown in cart, no nudge | Tiny CRO copy lift. Easy to add. | XS | **P2** |
| 13 | Firmy.cz trust badge persistent | ✅ 4.8/95 reviews | ❌ None | Czech equivalent of Trustpilot. Need ratings first. | XS | **P3** (post-launch) |
| 14 | First-order coupon banner (FREESHIP) | ✅ Persistent top bar | ⚠ Announcement strip exists but currently buggy (C5180) | Standard incentive. We're already on this path. | XS | **P2** (fix existing) |
| 15 | Vertical thumbnail gallery on PDP | ✅ Static OpenCart | ✅ Better — swipe + lightbox + zoom/pan (commit 43e2e9c) | We win — don't change. | — | **DON'T COPY** |
| 16 | Hero / editorial homepage | ❌ Wall of products | ✅ Hero exists (per recent C5180 sweep) | We win on positioning ("discover" vs "bargain bin"). | — | **DON'T COPY** |
| 17 | Mobile-first responsive | ❌ Cramped 5-col grid on m | ✅ 2-col grid, larger cards | We win on mobile UX | — | **DON'T COPY** |
| 18 | Prepaid wallet/credit system | ✅ Required for reservation | ❌ None | Heavy friction. If we ship reservation, do it without prepaid gate. | L | **DON'T COPY** |

**Legend**:
- ✅ implemented and good
- ⚠ partial / has issues
- ❌ none
- Effort: XS (<2h) / S (1d) / M (2-4d) / L (1+ week)
- Priority: P0 (next sprint) / P1 (next 2 sprints) / P2 (next quarter) / P3 (someday) / SKIP / DON'T COPY
