-- Reactive Admin design — 5 phase tasks for Bolt dispatch
-- ARIA #1047 design, 2026-05-03
-- Run via:  sqlite3 ~/.claude/jarvis-gym/jarvis.db < docs/specs/reactive-admin-phases.sql

-- Phase R1 — endpoint + TanStack Query setup (4h, no deps)
INSERT INTO task_queue (
  project, agent, title, prompt, status, priority, created_at
) VALUES (
  'janicka-shop', 'bolt',
  'Reactive Admin R1: /api/admin/live-state endpoint + TanStack Query hook',
  'Implementuj polling backbone podle docs/specs/reactive-admin-2026-05-03.md §5 + §7 R1.

DELIVERABLES:
1. src/app/api/admin/live-state/route.ts — GET handler, export const dynamic = ''force-dynamic'', vrací LiveState shape (mailbox/workspace/manager/orders/drafts), 401 pro non-admin, < 50ms p95.
2. src/lib/admin-live.ts — useAdminLive() React Query hook, focusMs=15000, blurMs=60000, document.visibilityState handling, queryKey [''admin-live''].
3. src/lib/stores/admin-live-store.ts — Zustand store s lastSeen { mailbox, workspace: Record<string,string>, manager, orders }, persist do localStorage.
4. Pokud TanStack Query není v deps: npm install @tanstack/react-query @tanstack/react-query-devtools.
5. src/app/(admin)/admin/providers.tsx — QueryClientProvider wrapper (RSC-safe pattern: ''use client'').
6. src/app/(admin)/admin/layout.tsx — wire providers.

ACCEPTANCE:
- npm run build EXIT=0
- endpoint vrací shape z spec §5 přesně, validace zod schema
- 401 pro anon, 200 pro admin session
- e2e: e2e/admin-live-state.spec.ts — GET as admin → 200 + shape; GET as anon → 401
- payload < 2KB

NEPOUŽÍVAT SSE/Redis/LISTEN-NOTIFY. JEN polling. Spec §3 obhájil rozhodnutí.',
  'pending', 1, datetime('now')
);

-- Phase R2 — mailbox live (3h, deps R1)
INSERT INTO task_queue (
  project, agent, title, prompt, status, priority, created_at
) VALUES (
  'janicka-shop', 'bolt',
  'Reactive Admin R2: Mailbox bez F5 — sidebar badge + toast + auto-prepend',
  'Závisí na R1 (useAdminLive hook + admin-live-store). Spec §7 R2.

DELIVERABLES:
1. src/components/admin/sidebar.tsx — Doručené link gets count badge ze useAdminLive() pokud unread > 0 (nebo new since lastSeen).
2. src/app/(admin)/admin/mailbox/page.tsx (klient část) — useAdminLive() detekuje nový thread (latestMessageAt > lastSeen.mailbox), invaliduje query [''admin-mailbox-threads''], zobrazí toast (shadcn sonner) "Nová zpráva od {fromAddress}" s click handler na /admin/mailbox?thread={id}.
3. Auto-prepend nového threadu do listu s subtle pulse animation (Tailwind animate-pulse po 800ms).
4. markSeen(''mailbox'') v useEffect při mount /admin/mailbox.
5. localStorage persist přes Zustand persist middleware.

ACCEPTANCE:
- npm run build EXIT=0
- e2e: e2e/admin-mailbox-live.spec.ts — simulate 2 EmailMessage rows insert → polling tick → badge appears + toast + thread auto-prepended
- žádný "Live" wording v UI
- focus → 15s polling, blur → 60s polling (assert via dev tools logs)',
  'pending', 2, datetime('now')
);

-- Phase R3 — workspace tabs live (3h, deps R1)
INSERT INTO task_queue (
  project, agent, title, prompt, status, priority, created_at
) VALUES (
  'janicka-shop', 'bolt',
  'Reactive Admin R3: Workspace tabs live — per-tab badges + sticky scroll',
  'Závisí na R1. Spec §7 R3.

DELIVERABLES:
1. src/components/admin/manazerka/tab-switcher.tsx — per-tab dot/count badge když workspace.tabs[i].lastActivityAt > lastSeen.workspace[tabId].
2. Active tab message list — sticky scroll pattern: pokud user byl scrolled to bottom (within 50px), auto-scroll on nová message; jinak nech být.
3. Click na tab → markTabSeen(tabId) → badge zmizí.
4. localStorage key admin-live-lastseen-tabs (per-tab map).
5. Polling endpoint /api/admin/live-state už vrací workspace.tabs array z R1 — tady jen klient.

ACCEPTANCE:
- npm run build EXIT=0
- e2e: e2e/admin-workspace-live.spec.ts — insert TabMessage do non-active tab → badge appears po pollu; switch tab → badge gone
- žádný scroll-jump když user scrolloval nahoru',
  'pending', 2, datetime('now')
);

-- Phase R4 — manager threads + dashboard live (3h, deps R1)
INSERT INTO task_queue (
  project, agent, title, prompt, status, priority, created_at
) VALUES (
  'janicka-shop', 'bolt',
  'Reactive Admin R4: Manager inbox + /admin dashboard widgets bez F5',
  'Závisí na R1. Spec §7 R4.

DELIVERABLES:
1. src/app/(admin)/admin/manazerka — inbox tab dostane unread badge z useAdminLive().manager.unreadThreadCount.
2. src/app/(admin)/admin/page.tsx (dashboard) — widgets pro:
   - paidNotShippedCount (orders awaiting fulfillment)
   - latestOrderAt (toast "Nová objednávka #{n}" když změna)
   - salesTodayCzk (live update)
   - low-stock widget (refresh přes invalidate query)
3. Toast pro nové order použij shadcn sonner s rose accent.

ACCEPTANCE:
- npm run build EXIT=0
- e2e: e2e/admin-dashboard-live.spec.ts — insert paid Order → dashboard count++ po pollu, toast appears
- manager inbox badge po insert ManagerThread',
  'pending', 3, datetime('now')
);

-- Phase R5 — drafts batch progress + roadmap closeout (2h, deps R1)
INSERT INTO task_queue (
  project, agent, title, prompt, status, priority, created_at
) VALUES (
  'janicka-shop', 'bolt',
  'Reactive Admin R5: Drafts batch progress live + closeout',
  'Závisí na R1. Spec §7 R5. Nice-to-have, ale uzavírá design.

DELIVERABLES:
1. src/app/(admin)/admin/products/drafts/page.tsx — progress bar získává data z useAdminLive().drafts.activeBatch.
2. Custom polling override: 5s když activeBatch != null, pause polling když null (batch dokončený) + jednorázový router.refresh() na finalizaci.
3. Progress bar smooth animation (CSS transition 300ms) mezi polly.
4. Error count display (červený badge pokud errors > 0).

ACCEPTANCE:
- npm run build EXIT=0
- e2e: e2e/admin-drafts-batch-live.spec.ts — start batch → progress updates without F5 → completes → page refreshes once
- pause na background tab respect (60s místo 5s když blur)

CLOSEOUT po R5:
- update docs/specs/reactive-admin-2026-05-03.md §10 checklist
- ověř Lighthouse admin pages CWV nepoklesly
- Janička UAT — "vidíš nový email hned bez F5?"',
  'pending', 4, datetime('now')
);
