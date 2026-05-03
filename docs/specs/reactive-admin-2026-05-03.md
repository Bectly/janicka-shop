# Reactive Admin — Live updates pro mailbox / workspace / orders

**Status**: design only, ne implementace
**Datum**: 2026-05-03
**Autor**: Bolt (DEV) podle ARIA #1047
**Předpoklad**: Postgres cutover proběhne (HT#48). Polling endpoint funguje stejně na Turso i Postgres.

---

## 1. Problem statement

Po `migrate-deploy` fix (commit `68ae1a3`) má prod konzistentní DB schema. Admin (Janička) ale musí zmáčknout F5 aby viděla:

- nový email v `/admin/mailbox`
- novou zprávu od Manager-tactical v `/admin/manazerka`
- nový order v dashboardu
- progress draft batch jobu v `/admin/products/drafts`

Cíl: nové entity se objeví **bez refresh** — badge, toast, případně auto-prepend do listu. Bez "live updates" buzzwordu v UI.

---

## 2. Tři přístupy — srovnání

### A) SSE (Server-Sent Events)

Jeden GET na `/api/admin/stream` drží `text/event-stream` connection, server pushuje
`event: thread.new\ndata: {...}\n\n`. Klient `EventSource('/api/admin/stream')`.

| Atribut | Hodnota |
|---|---|
| Setup effort | **18–24h** (stream endpoint, broadcast bus, reconnect, auth, heartbeat) |
| Latency | **<200ms** (push) |
| Server load | 1 open connection / admin tab × N admins. Pro 1–3 adminy zanedbatelné, ale Vercel serverless **kill connection po 60s** (Edge: 25s, Node: 60s default). Hetzner pm2 OK. |
| Failure modes | Reconnect storm po networku, Vercel timeout, proxy buffering (nginx `proxy_buffering off` nutný), CSP `connect-src` |
| pm2 cluster (1 inst) | OK. Při škálování na N instancí potřebuješ Redis pubsub broker. |
| Compatibility Next.js 16 | Funguje přes Route Handler s `ReadableStream`. Cache Components irelevantní (stream není cachovaný). |

### B) TanStack Query polling

Klient každých 15–60s GET na `/api/admin/live-state`, vrací snapshot timestamps + counts.
Klient porovná s `lastSeenTs` v Zustand storu, zobrazí badge / toast / refetch detail query.

| Atribut | Hodnota |
|---|---|
| Setup effort | **6–10h** (1 endpoint + 1 hook + per-page wiring) |
| Latency | **15s** (admin focus) / **60s** (background) — průměr ~7.5s při 15s pollu |
| Server load | 1 admin × 4 polls/min = **240 req/h/admin**. 1 query, indexed, ~5ms. Naprosto zanedbatelné. |
| Failure modes | Žádné kritické. Backoff při 5xx. Při ztrátě sítě prostě neaktualizuje. |
| pm2 cluster | OK (stateless GET). Škáluje s app servery. |
| Compatibility Next.js 16 | Endpoint v `app/api/admin/live-state/route.ts` s `dynamic = 'force-dynamic'`. Cache Components revalidateTag použité na detail queries (`revalidateTag('admin-mailbox')` po `markRead` → další refetch má fresh data). |

### C) Postgres LISTEN/NOTIFY → Redis → SSE

Postgres trigger `NOTIFY admin_event, '{...}'`, Node listener (`pg.LISTEN`) přepošle do Redis pubsub, SSE endpoint poslouchá Redis a streamuje klientovi.

| Atribut | Hodnota |
|---|---|
| Setup effort | **40–60h** (pg triggers, Node listener daemon, Redis, SSE, Vercel limity, fallback) |
| Latency | **<50ms** |
| Server load | Konstantní 1 LISTEN connection k Postgres + N SSE connections. |
| Failure modes | Listener crash → silent loss (potřebuješ supervisor). NOTIFY payload max 8KB. Redis SPOF. Vercel serverless to nepustí (potřebuješ Hetzner long-running process). |
| pm2 cluster | Listener musí běžet jako 1 instance (pm2 `instances: 1`), SSE může škálovat. |
| Compatibility Next.js 16 | App level OK, ale infrastruktura mimo Next.js (Hetzner daemon + Redis instance). |

---

## 3. Doporučení: **B (TanStack Query polling)**

**Proč:**

1. **Setup 6–10h vs. 24h vs. 60h.** Janička potřebuje feature tento týden, ne za měsíc.
2. **Latency 15s je pro admin OK.** Nejde o trading platform. Email od zákazníka, který přišel před 15s, je stále "okamžitě vidět" z lidského hlediska.
3. **Žádná nová infrastruktura.** Žádný Redis, žádný daemon, žádný Postgres trigger. 1 endpoint + 1 hook.
4. **Robustní napříč Vercel/Hetzner.** SSE na Vercel serverless má 25–60s timeout — nutné implementovat reconnect; na Hetzner pm2 funguje. Polling fnguje **identicky všude**.
5. **Kompatibilita s Cache Components.** `revalidateTag('admin-mailbox')` po server actionu (markRead, send) zajistí, že další `live-state` poll dostane čerstvá data bez extra logiky.
6. **Snadný upgrade na A.** Když Janička za 6 měsíců řekne "lag mě sere", endpoint zachováš, jen přidáš SSE feed `/api/admin/stream` který emituje stejné delta payloads. Klient si vybere podle env flagu.

**Cons přijaty:**

- 240 req/h/admin — irelevantní (1 admin, indexed query)
- Lag až 15s — akceptovatelný pro use-case
- Žádné instant typing indicators (ale to nikdo nepožaduje)

**Roadmap upgrade kritérium**: pokud Janička kdy nebo > 1 admin a stěžuje si na lag, upgrade na B+SSE delta hybrid (polling jako fallback).

---

## 4. Reactive scope mapping

| Page | Priorita | Polling interval (focus / blur) | Live entities |
|---|---|---|---|
| `/admin/mailbox` | **P0** | 15s / 60s | new EmailThread, new EmailMessage v thread, unread count |
| `/admin/manazerka` workspace tabs | P0 | 15s / 60s | nové TabMessage od Manager-tactical, lastActivityAt |
| `/admin/manazerka` inbox (manager_threads) | P0 | 15s / 60s | nové ManagerThread, nové ManagerMessage |
| `/admin` dashboard | P1 | 30s / 120s | new Order, paid-not-shipped count, sales today, low-stock |
| `/admin/products/drafts` | P2 | 5s / 30s (jen když batch běží) | activeBatch progress (processed/total), errors |

Ne-reactive (necháme s `revalidate`):
- /admin/customers, /admin/products list, /admin/settings — Janička je otevírá ad-hoc, ne real-time monitoring.

---

## 5. Endpoint design — `/api/admin/live-state`

**Method**: GET
**Auth**: NextAuth admin session (existing middleware)
**Cache**: `dynamic = 'force-dynamic'`, `Cache-Control: no-store`
**Payload size target**: < 2KB (jen counts + timestamps, ne full entities)

### Response shape

```typescript
type LiveState = {
  ts: string;                          // server timestamp ISO8601
  mailbox: {
    unreadCount: number;
    latestMessageAt: string | null;    // ISO timestamp nejnovější příchozí zprávy
    newSinceLastSeen?: number;         // computed klient-side z lastSeenTs
  };
  workspace: {
    tabs: Array<{
      tabId: string;
      lastActivityAt: string;
      unreadCount: number;
    }>;
  };
  manager: {
    unreadThreadCount: number;
    latestReplyAt: string | null;
  };
  orders: {
    paidNotShippedCount: number;
    latestOrderAt: string | null;
    salesTodayCzk: number;
  };
  drafts: {
    activeBatch: {
      id: string;
      processed: number;
      total: number;
      errors: number;
    } | null;
  };
};
```

### Klient state (Zustand)

```typescript
type AdminLiveStore = {
  lastSeen: {
    mailbox: string | null;
    workspace: Record<string, string>;  // per tabId
    manager: string | null;
    orders: string | null;
  };
  markSeen(category: 'mailbox' | 'manager' | 'orders'): void;
  markTabSeen(tabId: string): void;
};
```

Hook `useAdminLive()` vrací `{ data, newCounts: { mailbox, manager, orders } }` — komponenta zobrazí badge `newCounts.mailbox > 0`.

### SQL queries (per category, all indexed)

```sql
-- mailbox
SELECT COUNT(*) FILTER (WHERE "isRead" = false) AS unread,
       MAX("createdAt") FILTER (WHERE direction = 'inbound') AS latest
FROM "EmailMessage";

-- workspace (existing tabs cached, per-tab last activity)
SELECT "tabId", MAX("createdAt") AS lastActivityAt,
       COUNT(*) FILTER (WHERE "readAt" IS NULL) AS unread
FROM "TabMessage" GROUP BY "tabId";

-- manager threads
SELECT COUNT(*) FILTER (WHERE "hasUnreadAdmin" = true) AS unread,
       MAX("lastReplyAt") AS latest
FROM "ManagerThread";

-- orders
SELECT COUNT(*) FILTER (WHERE status = 'PAID' AND "shippedAt" IS NULL) AS paid_unshipped,
       MAX("createdAt") AS latest_order_at,
       COALESCE(SUM("totalCzk") FILTER (WHERE DATE("createdAt") = CURRENT_DATE), 0) AS sales_today
FROM "Order";

-- drafts
SELECT id, processed, total, errors
FROM "DraftBatch" WHERE status = 'running' ORDER BY "startedAt" DESC LIMIT 1;
```

Total query time target: **< 30ms** (indexed counts on 5 small tables). Pokud se to ukáže pomalé, denormalizujeme do `AdminLiveSnapshot` row updateované server-actiony.

---

## 6. UX details

- **Polling interval**: `useAdminLive({ focusMs: 15000, blurMs: 60000 })`. Hook hooks na `document.visibilityState`.
- **Subtle pulse**: nový item v listu fade-in + 1× ring animace (Tailwind `animate-pulse` po 800ms, pak off). Žádné scroll-jump.
- **Toast**: shadcn `<Toaster>` "Nová zpráva od X" s click → `router.push(/admin/mailbox?thread=...)`.
- **Badge**: `<span class="size-5 rounded-full bg-rose-500 text-white text-xs">{n}</span>` v sidebar item.
- **Žádný "live" wording**: žádné "Live!", žádný "real-time" v UI. Janička nemusí vědět že je polling. Jen prostě se objeví.
- **Quiet hours**: pokud `document.hidden && Date.now() - lastFocus > 30min` → pause polling úplně. Pokračuje při refocusu.

---

## 7. Phasing — 5 implementation tasků

| Phase | Title | Effort | Dependencies | Acceptance |
|---|---|---|---|---|
| **R1** | `/api/admin/live-state` + TanStack Query setup | 4h | — | endpoint vrací shape z §5, < 50ms p95, 401 pro non-admin, hook `useAdminLive()` v `src/lib/admin-live.ts`, focus/blur interval switching |
| **R2** | Mailbox live | 3h | R1 | sidebar badge "Doručené (N)" se updatuje, nová příchozí zpráva → toast + auto-prepend do thread listu, lastSeen v Zustand persistován v localStorage |
| **R3** | Workspace tabs live | 3h | R1 | per-tab unread badge v `TabSwitcher`, click → markTabSeen, auto-scroll na new message v aktivním tabu |
| **R4** | Manager threads + Dashboard live | 3h | R1 | manazerka inbox unread count badge, /admin dashboard order count + sales today se updatuje, low-stock widget refresh |
| **R5** | Drafts batch progress + cleanup | 2h | R1 | /admin/products/drafts progress bar bez F5, polling 5s jen když `activeBatch != null`, jinak pause |

**Total**: 15h core (R1–R4), R5 nice-to-have. Parita s ARIA estimátem 18–24h pro SSE bez většiny benefitů.

### Per-phase Bolt task acceptance criteria

**R1**:
- `src/app/api/admin/live-state/route.ts` exports GET, dynamic force-dynamic
- payload matches `LiveState` type, all 5 categories present
- 401 if `auth()` returns no admin session
- `npm run build` exit 0
- e2e test: GET endpoint as authenticated admin → 200 + valid shape; as anon → 401

**R2**:
- `useAdminLive()` hook wired in `(admin)/admin/layout.tsx`
- sidebar `Doručené` link gets count badge (only if > 0)
- new thread arriving while user on `/admin/mailbox` shows toast + prepends
- `markSeen('mailbox')` called on entering /admin/mailbox

**R3**:
- TabSwitcher component shows per-tab dot/count when other tab has new message
- Active tab auto-scrolls to bottom on new message (only if was scrolled to bottom — sticky scroll pattern)
- localStorage key `admin-live-lastseen-tabs` persists per-tab lastSeen

**R4**:
- `/admin` page widgets (orders, sales) updatuje bez F5
- `/admin/manazerka` inbox tab gets badge
- low-stock widget refresh respects polling interval

**R5**:
- `/admin/products/drafts` page polls every 5s WHEN `activeBatch != null` (vrací z endpointu)
- when batch done (`activeBatch == null` v response), polling stop, refresh page once
- progress bar smooth animation between polls

---

## 8. Compatibility check — Next.js 16 Cache Components

Next.js 16 `"use cache"` direktiva a `revalidateTag()` plně kompatibilní s naším designem:

1. **Endpoint `/api/admin/live-state` MUSI být uncached.** `export const dynamic = 'force-dynamic'`. Žádný `"use cache"`. Čteme čerstvé counts z DB každý poll.

2. **Server actions invalidují tagy.** Když admin pošle email, action volá `revalidateTag('admin-mailbox')`. Detail queries (Server Components s `"use cache"` + `cacheTag('admin-mailbox')`) se invalidují. Polling endpoint sám tagy ignoruje (force-dynamic).

3. **Klient TanStack Query cache je vrstva navíc** nad RSC cache. Když polling vidí novou zprávu, hook volá `queryClient.invalidateQueries(['admin-mailbox'])` → React Query refetchuje detail (který stejně dorazí z RSC fresh, protože server-actiona to už revalidovala).

4. **Žádný konflikt s `revalidate = N`.** Polling endpoint má `force-dynamic`; ostatní stránky můžou mít `revalidate = 60` jako fallback pro otevření stránky cold (před prvním pollem).

---

## 9. Open questions / risks

- **Multi-admin badge sync**: pokud bude víc adminů, `markSeen` je per-browser (localStorage). To je OK — každý admin má svůj inbox view. Pro shared "team inbox" koncept bychom potřebovali server-side `EmailMessage.readByAdminIds` array. Není v scope teď.
- **Drafts batch polling tightening (5s)**: pokud běží víc batch současně, server load roste lineárně. Pro 1 batch v 1 čas zanedbatelné.
- **Endpoint auth performance**: NextAuth `auth()` ~10ms overhead. Zvážit `getToken()` light-path pokud bude problém.
- **Visibility API edge cases**: Safari iOS nedělá `visibilitychange` reliable v PWA. Acceptable — nejhůř Janička dostane 60s lag místo 15s.

---

## 10. Hotová kritéria pro implementation closeout

- [ ] R1 endpoint + hook v prod, e2e green
- [ ] R2 mailbox bez F5 funguje na Hetzner staging
- [ ] R3 workspace bez F5 funguje
- [ ] R4 dashboard bez F5 funguje
- [ ] Janička potvrdí že "uvidí věci hned" (subjektivní acceptance)
- [ ] Lighthouse CWV nepoklesne (polling nesmí blokovat hlavní vlákno — mass 240 req/h to nedělá, ale measure)
- [ ] No new infrastructure deps (Redis/SSE odsunuty na "pokud Janička stěžuje")
