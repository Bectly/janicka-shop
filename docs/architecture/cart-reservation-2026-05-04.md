# Cart Reservation — sliding TTL + UX completion

**Date**: 2026-05-04
**Author**: Bolt
**Status**: DRAFT — awaiting bectly approval

## TL;DR

Stávající rezervační systém **funguje korektně po backendové stránce** (atomic conditional update, visitor scoping, thread-safe extend, transaction-bound sold flip + reservation cleanup, payment cancel un-sells products). Co chybí je **aktivně se prodlužující rezervace při činnosti uživatele** a **graceful UX při expiraci** — což přesně odpovídá bectlyho pocitu „nedokončené".

Tento doc je o **dotažení UX a sliding TTL**, ne o přepisu základu.

---

## Audit current state

### Co existuje ✅

**Schema** (`prisma/schema.prisma:54-55, 72-73` + `schema.postgres.prisma`):
- `Product.reservedUntil DateTime?` + index
- `Product.reservedBy String?` (visitor ID) + index

**Backend** (`src/lib/actions/reservation.ts`):
- `reserveProduct(id)` — atomic `updateMany` s `where: { OR: [reservedUntil:null, reservedUntil:<now, reservedBy:visitor] }` → race-safe TOCTOU prevention
- `releaseReservation(id)` — visitor-scoped clear
- `extendReservations(ids)` — **threshold-based** sliding refresh: extends jen když zbývá < 5 min ze 15 (drží countdown stabilní při refresh)
- `checkAvailability(ids)` — public PDP status

**Visitor identity** (`src/lib/visitor.ts`): httpOnly cookie, 30 dní.

**TTL constants**: `RESERVATION_MINUTES = 15`, `MIN_REFRESH_MINUTES = 5`.

**Cart UI** (`src/app/(shop)/cart/page.tsx`):
- Reservation info banner ("rezervovány na 15 minut")
- Per-item countdown badge (`useCountdown` hook, tick každou sekundu)
- Urgent state < 2 min (animate-pulse, destructive color)
- "Rezervace vypršela" badge na 0:00
- `extendReservations` call on cart mount

**Add-to-cart** (`src/components/shop/add-to-cart-button.tsx`):
- Calls `reserveProduct` před `addItem`
- "Rezervováno" disabled stav když reservation patří jinému visitorovi

**Checkout** (`src/app/(shop)/checkout/actions.ts`):
- Tx re-checks `reservedUntil > now && reservedBy !== visitorId` → throws `UnavailableError`
- Atomicky markuje `sold:true` + clearuje `reservedUntil/reservedBy` v jedné transakci
- Comgate fail → rollback (un-sells products)

**Payment cancel webhook** (`src/lib/payments/process-status.ts:113-145`):
- CANCELLED → `sold:false, stock:1` (uvolní produkt zpátky)

### Mezery ❌

| # | Gap | Důsledek |
|---|---|---|
| **G1** | `extendReservations` se volá **jen na cart mount** | Když user dwelluje na PDP, klikne na další produkt, dwelluje na checkout — rezervace se neprodlužuje. Po 15 min EXPIRE i kdyby byl pořád aktivní. |
| **G2** | **Checkout page nemá countdown ani extend trigger** | User vyplňuje formulář 12 min, rezervace mu vyprší, submit hodí hard error „Tyto produkty už bohužel nejsou dostupné". |
| **G3** | **Žádný auto-refresh ping při expiraci** | Cart countdown hits 0:00, badge řekne „Rezervace vypršela", ale nic se nenabídne. User musí ručně přidat produkt zpátky. |
| **G4** | **Žádný heartbeat při dwell** | Když user nechá tab otevřený 15+ min bez akce, propadne — i když se vrátil 1 min před expiry. |
| **G5** | **Hard error na expired-during-checkout** | `UnavailableError` skončí jen jako error string. Žádná retry path, žádný jasný „rezervaci obnovit" CTA. |
| **G6** | **Žádný cron / lazy release** | _Tohle je vlastně OK._ `reserveProduct` má `OR: [reservedUntil:null, reservedUntil:<now, ...]` — expirovaná rezervace je transparentně dostupná dalšímu visitorovi. Cron by byl redundantní. ALE: PDP `Product.reservedUntil` může v DB svítit i u dávno expirované rezervace, což matete admin UI a SEO feedy (fakticky available kus má `reservedUntil` v minulosti). Cosmetic, ne functional. |

---

## Best practice — relevant findings

- **15 min default** je standard (Reservit Shopify app, Conversion Pro Plus) — neměnit.
- **Sliding refresh na aktivitu** je ten správný model pro unikátní kusy (second-hand). User aktivně pracuje s košíkem → drží si ho. Tab zavřel/zapomněl → uvolní se za 15 min.
- **Nesmí se prodlužovat tiše** — countdown musí zůstat viditelný, jinak user neví že má omezený čas. Vizuální urgency = conversion lever (Once Again case study, scarcity emails). Prodlužuj jen když < threshold (už máme MIN_REFRESH_MINUTES=5 — udržujeme).
- **Soft expire UX**: mark item dim + offer „Obnovit rezervaci" (one-click `reserveProduct` retry). Pokud DB řekne `reserved_by_other` nebo `sold` → upgrade message + offer odebrat.
- **Race condition při concurrent buyers**: tx layer to už řeší (sold transition je atomic). UX vrstva potřebuje jen čistou message — žádný 500.

---

## Návrh

### Princip
1. **Trigger refresh na všech meaningful cart actions** — ne časem, ale událostí. Když user **něco dělá**, rezervace se updatuje (kde má smysl).
2. **Heartbeat ping** — light interval (1× za 60 s) jen když je cart otevřený / checkout otevřený a tab visible. Bez aktivity se neping. Vrací identický `extendReservations` payload, threshold-based, takže countdown nedrká.
3. **Soft-expire UX** — když countdown hits 0:00, místo „Rezervace vypršela" badge + nic dál, nabídnout **„Obnovit rezervaci"** button. On click → `reserveProduct` retry. 3 outcome:
   - success → reservation refresh, item v cart pokračuje
   - `reserved_by_other` → message „Někdo už si tento kus rezervoval první. Zobrazit podobné kusy?" + remove button
   - `sold` → message „Tento kus byl právě prodán" + remove button
4. **Checkout countdown banner** — top-of-page sticky banner na `/checkout` se nejmenším remaining timer napříč všemi cart items. Same heartbeat refresh. Když < 2 min, pulsing urgency.

### Schema

**Žádné změny.** Stávající `reservedUntil + reservedBy` stačí. Prisma migrate skip.

### Backend

**`src/lib/actions/reservation.ts`** — žádné nové funkce, jen použít existující:
- `extendReservations(productIds)` — už existuje, threshold-based, idempotent. Heartbeat ji volá s celým cart payloadem.
- `reserveProduct(id)` — pro „Obnovit rezervaci" CTA.
- `checkAvailability(ids)` — pro distinguish reservedByOther vs sold v error UI.

### Hooks / klient

**Nový hook** `src/hooks/use-reservation-heartbeat.ts`:
```ts
// Pings extendReservations every 60s while:
//  - tab visible (Page Visibility API)
//  - cart non-empty
//  - cart store hydrated (mounted gate)
// Updates store with returned reservedUntil → countdown smoothly continues.
// Skips ping if last ping < 30s ago (rate-limit friendly).
```
Mountován na `/cart` page i `/checkout` page (a optionally cart drawer kdyby existoval — neexistuje, jen mini cart button).

**Cart store update**: `cart-store.ts` už má `updateReservation(productId, reservedUntil | null)`. Stačí ho volat z heartbeat callback.

### UI komponenty

**Cart page** (`src/app/(shop)/cart/page.tsx`):
1. Mount `useReservationHeartbeat` (heartbeat ping 60s).
2. `CartItemRow` při `isExpired` (countdown 0:00):
   - Replace „Rezervace vypršela" passive badge **+** add „Obnovit rezervaci" button.
   - Click → `reserveProduct(item.productId)`.
   - On success → `updateReservation(id, newUntil)`.
   - On `reserved_by_other` → toast + show inline „kdo dřív zaplatí" message + remove button (item stays in cart unless user removes).
   - On `sold` → toast + auto-remove from cart.

**Checkout page** (`src/app/(shop)/checkout/page.tsx`):
1. Mount `useReservationHeartbeat`.
2. **New component** `ReservationCountdownBanner` — sticky pod headerem, ukazuje shortest remaining countdown napříč items. Když < 2 min, pulsing destructive border. Když 0:00 → „Některá rezervace vypršela. [Zkontrolujte košík]" link na `/cart`.
3. Submit error handler — když `createOrder` vrátí `error: "Tyto produkty už bohužel nejsou dostupné..."`, místo plain text show modal s **„Zkontrolovat košík"** CTA → redirect `/cart` s expired highlight.

### Cron / lazy release

**Vynechat.** Důvod: `reserveProduct` už transparently re-claimuje expirovaný slot. Cron by jen kosmeticky NULLoval `reservedUntil` na expirovaných řádcích, což pro funkci ničemu nepomůže. Pokud někdy budeme potřebovat čistý feed pro adminky/SEO, přidám lazy release jako pre-read ve `getProducts*` (filter via `reservedUntil < now → treat as null`). Now is fine.

### Race condition matrix

| Scenario | Behavior | OK? |
|---|---|---|
| Visitor A reserves → Visitor B clicks ATC | DB conditional update fails on B → "Rezervováno jiným" badge, ATC disabled | ✅ existující |
| Visitor A reserves → 15 min expire → Visitor B reserves | A's slot je passe; B získá; A na cart page heartbeat dorazí výsledek `null` z extendReservations → item zmizí z A's cart (`updateReservation(id, null)` filteruje) | ⚠ stávající behavior je „silently remove". Lepší by bylo soft-expire UX (viz výš), aby A viděl proč. **TO FIX** v tomto sprintu. |
| Visitor A reserves → submits checkout → tx markuje sold; current Visitor B čeká na ten samý kus | B's heartbeat → `extendReservations` returns `null` (B not owner) → item odstraněn z B's cart store. A dokončí. | ✅ matches existing pattern, just polish UX message. |
| Visitor A submits checkout → Comgate platba selže → rollback un-sells | Product zpátky available, žádná residual reservation | ✅ existující |
| Visitor A pays → CANCELLED webhook | `process-status.ts` un-sells | ✅ existující |

### Edge cases

- **User closes tab during heartbeat**: Page Visibility hook stops ping. Reservation expire after 15 min naturally. ✅
- **User offline mid-heartbeat**: `extendReservations` rejects → catch block, no-op (countdown ticks down naturally, no exception). ✅
- **Multiple tabs open**: Each tab pings independently. Same visitor cookie → same `reservedBy`, idempotent. ✅
- **Cookie cleared mid-session**: New visitor ID generated → server returns `null` for items reserved under old ID → soft-expire UX kicks in, "Obnovit" attempts, succeeds (no-one else holds it). ✅

### Rate-limit risk

`extendReservations` is gated by `rateLimitReservation` (already in code). Heartbeat 60 s with Page Visibility gating + 30 s min interval = max 1 call/min/visitor. With 50-item cap. No abuse vector worsening.

### Performance

Per-heartbeat: 1× `updateMany` (no-op when nothing < threshold) + 1× `findMany` for read-back. Indexed on `reservedBy` + `reservedUntil`. Negligible at our scale (1 visitor, 1-3 items typically).

---

## Implementation plan

| Step | Files | Commit |
|---|---|---|
| 1 | `src/hooks/use-reservation-heartbeat.ts` (new) | `feat(cart): heartbeat extends reservations on cart/checkout while tab visible` |
| 2 | `src/components/shop/reservation-countdown-banner.tsx` (new) — used by checkout | `feat(checkout): sticky reservation countdown banner` |
| 3 | `src/app/(shop)/cart/page.tsx` — mount heartbeat + soft-expire CTA on row | `feat(cart): soft-expire UX with one-click rezervaci obnovit` |
| 4 | `src/app/(shop)/checkout/page.tsx` (or layout) — mount heartbeat + banner | `feat(checkout): mount reservation heartbeat + countdown banner` |
| 5 | Checkout submit error handler — modal with "Zkontrolovat košík" CTA | `feat(checkout): graceful expired-reservation modal on submit` |
| 6 | E2E test `e2e/cart-reservation-sliding.spec.ts` | `test(e2e): sliding reservation refresh + expiry recovery` |

Each step ends with `npm run build` EXIT=0 confirmation. Every commit standalone, revertible.

## Acceptance match

- ✅ Aktivita v košíku prodlužuje rezervaci → heartbeat při tab visible + on action.
- ✅ User vidí countdown → existing per-row + new banner on checkout.
- ✅ Po expiraci graceful prompt → soft-expire CTA + checkout submit modal.
- ✅ Race: Visitor A pays první → B's heartbeat returns null → soft-expire UX, ne 500.
- ✅ `npm run build` EXIT=0 + Playwright pass.

## Out of scope (explicit)

- **Postgres cutover** — schema beze změn, cutover blocker stays as-is.
- **Cron release** — opt-out (zdůvodněno výš).
- **Drawer cart** — neexistuje v projektu, neimplementujeme.
- **Vícekusové rezervace / quantity > 1** — second-hand byznys = unikát qty=1, nedotýkat.
