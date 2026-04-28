# Wishlist (Liked Items) State Audit — 2026-04-28

**Task**: #869 (Aria audit) — duplicitní zdroj pravdy + pomalé postupné načítání pro přihlášené zákazníky.

## TL;DR

**Single source of truth musí být DB tabulka `CustomerWishlist`** pro přihlášené
zákazníky; Zustand store `janicka-wishlist` smí být zdroj pravdy **jen pro
anonymní návštěvníky**. Dnes Zustand a DB jedou paralelně se třemi různými
write-path strategiemi a jednou polorozbitou merge logikou — výsledkem je
přesně ten symptom, který bectly popisuje (položka jen na jednom místě, občas
duplicita, občas se odebraný kus vrátí). Pomalost je důsledkem dvojitého
fetche + `router.refresh()` na `/account/oblibene` mountu.

## Architektura — jak je to dnes

### Zdroje dat

| Vrstva | Lokace | Klíč | Persistuje |
|---|---|---|---|
| DB tabulka | `prisma/schema.prisma:156` `CustomerWishlist` | `(customerId, productId)` unique | server-side, autoritativní pro přihlášené |
| Zustand store | `src/lib/wishlist-store.ts` | `janicka-wishlist` (localStorage) | client-side, sdílený mezi anon i přihlášenými |
| (nepřímé) | `WishlistSubscription` tabulka (`prisma/schema.prisma:298`) | per email × productId | **separátní koncept** — email notifikace na vyprodání. Není to wishlist, neplést. |

### Zobrazovací místa

1. `/oblibene` — `src/app/(shop)/oblibene/page.tsx` + `wishlist-content.tsx`
   - Public/anon. SSR `connection()` + redirect přihlášeného na `/account/oblibene`.
   - Pro anon: čte Zustand IDs → klient fetchuje `getWishlistProducts(ids)` (server action) **až po hydrataci**.
2. `/account/oblibene` — `src/app/(shop)/account/oblibene/page.tsx` + `wishlist-grid.tsx` + `merge-client.tsx`
   - Logged-in. SSR načítá `db.customerWishlist.findMany` (s `"use cache"` + `cacheLife("minutes")` + `customerTag`).
   - Mount spustí `WishlistMergeClient`, který POSTuje localOnly IDs na `/api/wishlist/sync` a pak volá `setItems(...)` zpět do Zustandu.
3. `/oblibene/sdilej?ids=…` — `src/app/(shop)/oblibene/sdilej/page.tsx` (sdílený seznam, read-only z URL).
4. Admin: `src/app/(admin)/admin/customers/[id]/page.tsx:510` (read-only DB výpis).

### Badge zdroje

| Komponenta | Cesta | Čte z |
|---|---|---|
| Header badge | `src/components/shop/wishlist-header-button.tsx:11` | `useWishlistStore.count()` (Zustand) |
| Bottom-nav badge | `src/components/shop/bottom-nav.tsx:34` | `useWishlistStore.count()` (Zustand) |
| Card / PDP heart toggle | `src/components/shop/wishlist-button.tsx:30` | `useWishlistStore.has(productId)` (Zustand) |

### Write-path matice

| Akce přihlášeného | Co se zapíše do Zustandu? | Co se zapíše do DB? |
|---|---|---|
| Klik na ❤︎ na product card / quick-view / recently-viewed | ✅ `toggle()` | ❌ **nikdy** |
| Klik na ❤︎ "Oblíbit" na PDP (`variant="detail"`) | ✅ `toggle()` | ❌ — pouze upsertne `WishlistSubscription` (sold notify), **ne** `CustomerWishlist` |
| Klik na X na kartě v `/account/oblibene` (WishlistGrid) | ✅ `toggleLocal()` (jen pokud `hasLocal`) | ✅ `removeFromWishlist` server action |
| Mount `/account/oblibene` (`merge-client`) | ✅ `setItems(dbIds + localOnly)` | ✅ `/api/wishlist/sync` POST upsertuje localOnly |
| Login + dosud nikdy nenavštívené `/account/oblibene` | ❌ — Zustand zůstává prázdný (anon stav) | ✅ DB má co měla |
| Logout | ❌ — Zustand neresetuje | ❌ |

## Diagnóza — proč to diverguje

### Bug #1 — odebrání ❤︎ z PDP/karty se NIKDY nedostane do DB
`WishlistButton.handleClick` (`wishlist-button.tsx:38-65`) volá pouze
`toggle(productId)` v Zustandu. Pro `variant="detail"` na PDP se navíc volá
`subscribeSingleWishlistNotification`, ale to píše do **jiné** tabulky
(`WishlistSubscription`, ne `CustomerWishlist`). DB tedy přihlášeného neodebere.

**Důsledek**: po odebrání z karty/PDP zmizí z headeru/bottom-navu (Zustand), ale
zůstává v `/account/oblibene` (DB). Když uživatel pak navštíví
`/account/oblibene`, `merge-client` udělá `setItems(dbIds + localOnly)` — a
protože odebraný produkt je stále v `dbIds`, **Zustand ho zase přidá zpátky**.
Header badge skočí o jedna nahoru, kus "ožije". Tohle je 1:1 s "občas položka
jen na jednom místě, občas duplicitně, občas se vrátí".

### Bug #2 — přidání ❤︎ z PDP/karty se nedostane do DB až do návštěvy `/account/oblibene`
Stejný kořen. Položka je v Zustandu, badge svítí, ale když se zákazník přihlásí
na druhém zařízení, vidí prázdno. Až po `merge-client` mountu se dohraje.

### Bug #3 — `merge-client` přepisuje lokální mazání
`merge-client.tsx:31` při `localOnly.length === 0` volá `setItems(dbIds)` — to
**přepíše** Zustand DB stavem a tím **anuluje** všechna client-side odebrání,
která Bug #1 nedoručil do DB. Jinými slovy: bug #1 (žádný DB write na remove)
+ bug #3 (overwrite z DB) = "kus se vrátil sám od sebe".

### Bug #4 — header / bottom-nav badge pro přihlášeného začíná na 0
Login → header badge ukazuje 0, dokud uživatel nezajde na `/account/oblibene`.
Je to proto, že badge čte čistě Zustand (`count()`), který je prázdný (anon
stav), a `setItems` se spustí až mountem account stránky. Wishlist v DB při
tom existuje, ale UI o něm neví.

### Bug #5 — `/oblibene` (anon path) na anon uživateli má serial fetch + visible flicker
- `/oblibene/page.tsx` SSR forsuje `connection()` (dynamic) → server vrátí jen
  HTML s `<WishlistContent />` shellem.
- `WishlistContent` čeká na hydrate (`useSyncExternalStore`) → spustí
  `useEffect` → fetchne `getWishlistProducts(wishlistIds)` server actionem.
- Mezitím se renderuje skeleton.
- Effect má v deps `wishlistIds` (Zustand vrací nový array reference na každý
  toggle / setItems) → v StrictMode dev double-mount + případný `setItems` z
  paralelní stránky způsobí re-fetch.

### Bug #6 — `await connection()` defeats `"use cache"` v `/account/oblibene`
`/account/oblibene/page.tsx:50` volá `await connection()` před `auth()`. To
celou stránku označí jako dynamic, takže `"use cache"` + `cacheLife("minutes")`
v `getCustomerWishlist` se sice technicky aplikuje na tu funkci, ale rodičovský
SSR je tak jako tak dynamic → každá návštěva = `findMany` v Tursu. Plus
`merge-client` na konci dělá `router.refresh()` (jen když mergoval localOnly),
což stránku znovu re-renderuje → druhý DB hit. To je ten "postupný re-render".

## Kořenová příčina, jednou větou

**WishlistButton (jediná akce-iniciující komponenta) píše jen do Zustandu, takže
DB pro přihlášeného žije v jiné realitě než UI badge a Zustand. `merge-client`
to maskuje jen tak napůl: domerguje localOnly do DB, ale na zpáteční cestě
přepíše lokální mazání DB stavem.**

## Doporučení

### Single source of truth strategy

| Stav uživatele | SSoT | Zustand role |
|---|---|---|
| Anonymní | Zustand (`janicka-wishlist`) | jediný zdroj |
| Přihlášený zákazník | DB `CustomerWishlist` | **mirror only** — read-cache pro instant UI badge, **ne** zdroj pravdy |

### Konsolidační plán (pořadí pro implementační task)

1. **Server actions pro mutace** v `/account/oblibene/actions.ts` (rozšířit, už
   tam `removeFromWishlist` je):
   - `addToWishlist(productId)` — upsertne `CustomerWishlist`, `revalidateTag(customerTag)`.
   - `toggleWishlist(productId)` — wrapper, vrátí nový stav.
2. **WishlistButton session-aware**:
   - Pokud `useSession` ⇒ `customer`: volá server action + `useOptimistic` na
     UI; po success synchronizuje Zustand mirror přes `setItems(...)`.
   - Pokud anon: dnešní Zustand-only chování.
   - (Alternativa: nový hook `useWishlist(productId)` který skryje branch.)
3. **Zrušit `merge-client.tsx` jako "page-mount" akci**:
   - Merge spustit **jednou při loginu** (callback v `/api/auth/callback` nebo
     server action `mergeAnonWishlist` volaná z login formu po success). Pak
     `useWishlistStore.getState().clear()` na klientu, aby Zustand u
     přihlášeného nezačínal duplikovat DB.
   - V layoutu `/account/*` přidat malý RSC `<WishlistMirror>` který do Zustandu
     pošle aktuální `dbIds` přes `setItems` **bez** `router.refresh()` a **bez**
     overwrite, pokud Zustand a DB nesedí (pak je třeba diff a domergeovat
     přes server action, ne přes `setItems` v obou směrech).
4. **Header / bottom-nav badge pro přihlášené**:
   - Přidat do shop layoutu RSC fetch `count` z DB (cached, `customerTag`) a
     předat jako initial prop do badge komponenty. Badge použije
     `Math.max(initialCount, zustandCount)` aby mezi navigacemi necukal.
5. **Smazat `await connection()`** z `/account/oblibene/page.tsx:50` (a nechat
   jen `auth()` které samo dynamic markuje), nebo naopak smazat `"use cache"` —
   tyhle dvě věci jsou v konfliktu a `cacheLife("minutes")` dnes nic nedělá.
6. **`/oblibene` (anon)** může zůstat jak je, ale po kroku 3 už pro
   přihlášeného nikdy nezahoří (je to jen redirect target). Pokud chceme
   zrychlit i anon, dá se předfetchnout `getWishlistProducts` v Server Action +
   stream přes RSC s URL params nebo cookie ID listem (low priority).
7. **`router.refresh()` v `merge-client`** vyhodit. Po kroku 3 už merge na
   `/account/oblibene` mountu nezůstane, takže to padne přirozeně.

## Komponenty / soubory dotčené úklidem

### Komponenty zobrazující wishlist
- `src/app/(shop)/oblibene/page.tsx` — anon entrypoint (zůstává)
- `src/app/(shop)/oblibene/wishlist-content.tsx` — anon klient (zůstává)
- `src/app/(shop)/account/oblibene/page.tsx` — logged-in stránka **(úprava: smazat `connection()`, vyřešit cache vs dynamic)**
- `src/app/(shop)/account/oblibene/wishlist-grid.tsx` — logged-in klient (úprava: po server action volat refresh přes `revalidateTag`, ne přes `router.refresh()` v merge-client)
- `src/app/(shop)/account/oblibene/merge-client.tsx` — **přesunout do login callback / smazat z page-mount**
- `src/app/(shop)/oblibene/sdilej/page.tsx` — share view, OK
- `src/app/(admin)/admin/customers/[id]/page.tsx` — admin read-only, OK
- `src/components/shop/wishlist-button.tsx` — **session-aware refactor (kritické)**
- `src/components/shop/wishlist-header-button.tsx` — **přidat initial prop / RSC wrapper**
- `src/components/shop/bottom-nav.tsx` — **přidat initial prop / RSC wrapper**
- `src/components/shop/wishlist-card.tsx` — OK (presentational)
- `src/components/shop/wishlist-empty.tsx` — OK
- `src/components/shop/product-card.tsx`, `quick-view-modal.tsx`, `product-list-item.tsx`, `recently-viewed.tsx`, `shuffle-overlay.tsx` — používají `<WishlistButton>`, žádná změna v nich není potřeba (změna je uvnitř buttonu)

### API / actions
- `src/app/api/wishlist/sync/route.ts` — zachovat, ale volat z login flow, ne z page-mount
- `src/app/(shop)/account/oblibene/actions.ts` — **rozšířit o `addToWishlist` / `toggleWishlist`**
- `src/app/(shop)/oblibene/actions.ts` — `getWishlistProducts` zůstává pro anon; `subscribeSingleWishlistNotification` zůstává (separátní koncept)

### Stores
- `src/lib/wishlist-store.ts` — beze změny chování, ale doplnit dokumentační
  komentář, že u přihlášeného slouží jen jako mirror

### Dead code / "zákeřný" kód k odstranění
1. `await connection()` v `/account/oblibene/page.tsx:50` — defeats `"use cache"`.
2. `setItems(dbIds)` v `merge-client.tsx:31` při `localOnly.length === 0` — overwritne client-side mazání. **Aktivní bug, smazat.**
3. `router.refresh()` v `merge-client.tsx:44` — po refactoru nebude potřeba (revalidateTag stačí).
4. (Po refactoru kroku 3) celý `merge-client.tsx` jako page-component — přesunout logiku do `/api/auth/callback` nebo loginAction.

## Co toto NENÍ
- `WishlistSubscription` (`prisma/schema.prisma:298`) je email-notify-on-sold,
  ne wishlist. Nezapojovat ji do tohohle úklidu.
- Cron `wishlist-sold-notify` a `email/wishlist-sold.ts` čtou z
  `WishlistSubscription`, nikoli z `CustomerWishlist` — ponechat jak je.

## Měřitelné akcept-kritérium pro Bolt task

- Po loginu přihlášeného uživatele jsou `count()` z Zustandu a `db.customerWishlist.count({ where: { customerId } })` rovny **ve všech bodech** UI (header / bottom-nav / `/account/oblibene` / PDP `has`).
- Klik ❤︎ na PDP → DB row přibyl/zmizel **synchronně** (server action), bez nutnosti návštěvy `/account/oblibene`.
- Po odebrání z PDP a okamžité návštěvě `/account/oblibene` se kus **nevrátí**.
- `/account/oblibene` neudělá víc než **1** DB hit per nav (žádný `router.refresh()` race).
- E2E spec: "logged-in remove from PDP persists across reload + across `/account/oblibene` visit".
