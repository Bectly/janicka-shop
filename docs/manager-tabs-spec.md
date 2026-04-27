# Manager Admin Page — Tabbed Refactor Spec

**Status**: DRAFT — awaiting Lead + Sage review before implementation
**Owner task**: J20 (parent), J21-J27 (sub-impl)
**Date**: 2026-04-27

## Problem

Current `/admin/manager` page is one long stack of 4 sections (trigger / human tasks / devloop tasks / artifact feed). Janička writes into the "Spustit manažerku" textarea thinking it's a chat input — but that textarea is the trigger for a full strategic AI session, not for asking quick questions. Mismatch between mental model and UI.

Plus: Janička should never see JARVIS-internal concepts (workers, devloop, sessions, costs). Strategic session trigger is bectly's tool, not hers.

## Goals

1. **Conversation as primary paradigm** — Janička asks → manager answers → bell notifies
2. **Tasks separate from conversation** — kanban kept but isolated
3. **Strategic AI session moved out of Janička's view** — admin-only tab
4. **Reports/insights have their own home** — artifact feed dedicated
5. **Tabbed navigation** — pohledy se nepřekrývají, mobile-friendly

## Tab Architecture

```
┌─ /admin/manager ─────────────────────────────────────────────────┐
│ 🌷 Manažerka projektu                                              │
│                                                                    │
│ ┌─[ 💬 Konverzace 2 🔴 ]─[ 📋 Úkoly 5 ]─[ 📊 Reporty ]─[ ⚙️ Session ]─┐│
│ │                                                                ││
│ │  (active tab content)                                          ││
│ │                                                                ││
│ └────────────────────────────────────────────────────────────────┘│
└────────────────────────────────────────────────────────────────────┘
```

- **Default tab**: 💬 Konverzace (Janička's primary use case)
- **Tab state**: URL hash (`#konverzace`, `#ukoly`, `#reporty`, `#session`) for back-button + bookmarks
- **Badge counts**: red pill on Konverzace = unread answered messages, gray pill on Úkoly = active count
- **Keyboard**: `1`/`2`/`3`/`4` switches tabs (admin power-user touch)
- **Mobile**: tabs as horizontal scroll OR bottom-tab-bar style on `<sm:` breakpoint
- **Visibility**: tab `⚙️ Session` hidden when user role ≠ "admin" (future-proofing for drafter role)

## Tab 1 — 💬 Konverzace

```
┌─ Konverzace ─────────────────────────────────────────────────┐
│                                                                │
│ ── Napsat manažerce ──────────────────────────────────────    │
│ ┌────────────────────────────────────────────────────────┐    │
│ │ "Co řešíš? Zeptej se na cokoli — cena, akce,           │    │
│ │  strategie, sortiment..."                                │    │
│ │                                                          │    │
│ │ [📷 přiložit fotky] [💬 jen text]   ▢ 0/2000  [Odeslat →]│    │
│ └────────────────────────────────────────────────────────┘    │
│                                                                │
│ ── Manažerka se ptá tebe (1) ────────────────────────────    │
│ ┌─ 🔔 11:32 — čeká odpověď ───────────────────────────┐      │
│ │ "Janičko, zařadit březnový balík do 'Vintage' nebo  │      │
│ │  'Top značky'? Sell-through říká..."                 │      │
│ │ [Vintage] [Top značky] [Něco jiného…]                 │      │
│ └──────────────────────────────────────────────────────┘      │
│                                                                │
│ ── Tvé dotazy ────────────────────────────────────────────    │
│                                                                │
│ ┌─ ⏳ Zpracovává se · 14:23 ──────────────────────────┐       │
│ │ Tvá: "Cena na ten červený svetr s flekem?"           │       │
│ │ 📷 [thumb] [thumb] [thumb]                            │       │
│ │                                                        │       │
│ │ Manažerka čte ... [animated dots]                     │       │
│ └────────────────────────────────────────────────────┘       │
│                                                                │
│ ┌─ ✓ Odpovězeno · 12:14 ─────────────────────────────┐       │
│ │ Tvá: "Sleva na zimní mikiny?"                        │       │
│ │ ─                                                     │       │
│ │ 💬 Manažerka:                                         │       │
│ │   Doporučuju **-25 % na 14 dní**.                    │       │
│ │   Z dat: zimní A klesly z 65 % na 23 % sell-through  │       │
│ │   od února. Když uděláme akci teď, prodáme 60 %      │       │
│ │   inventáře, jinak stojí do podzimu.                 │       │
│ │                                                        │       │
│ │   ┌─ Sell-through zimních A za 8 týdnů ─┐            │       │
│ │   │  Mar ██████████ 65 %                │            │       │
│ │   │  Apr ████ 23 %                       │            │       │
│ │   └──────────────────────────────────────┘            │       │
│ │                                                        │       │
│ │   [✓ Spustit slevu] [Pošli analýzu kategorií]         │       │
│ └────────────────────────────────────────────────────┘       │
│                                                                │
│ ┌─ ✓ Odpovězeno · včera 18:45 ───────────────────────┐       │
│ │ ... (collapsed by default after 24h, klik = expand) │       │
│ └────────────────────────────────────────────────────┘       │
│                                                                │
│ [Načíst starší zprávy]                                         │
└────────────────────────────────────────────────────────────────┘
```

### Conversation states

| Stav | Badge | UI |
|---|---|---|
| `pending` | ⏳ čeká | gray bg, "Manažerka se zeptá za chvíli" |
| `processing` | ⏳ zpracovává | amber bg, animated dots |
| `answered` (unread) | 🔴 nové | pink left-border, bell badge increment |
| `answered` (read) | ✓ | normal style |
| `awaiting_user` | 🔔 čeká odpověď | top of feed, pulse animation |
| `closed` | 🗑 archived | hidden by default, "Zobrazit archivované" |

### Manager response — Block types

`ManagerThreadMessage.blocks` = JSON array of typed blocks:
- `text` — markdown
- `chart` — `{ type: "bar"|"line"|"pie", title, data: [{label, value}] }`
- `image` — `{ url, caption? }`
- `actions` — `{ buttons: [{ label, action: "publish_discount" | "open_url" | ..., payload }] }`
- `poll` — `{ question, options: [{label, value}] }`
- `table` — `{ headers, rows }`
- `code` — `{ language, source }` (rare)

Renderer = `<ThreadMessageBlocks blocks={...} />` switch on block.type.

### Empty state

```
┌──────────────────────────────────────────────────────┐
│            💬                                          │
│  Zatím žádný dotaz na manažerku.                       │
│                                                        │
│  Zeptej se na cenu, akci, strategii sortimentu —       │
│  cokoli co tě napadne. Odpovídá většinou do hodiny.    │
│                                                        │
│  [Napsat první zprávu →]                               │
└──────────────────────────────────────────────────────┘
```

## Tab 2 — 📋 Úkoly

```
┌─ Úkoly od manažerky ────────────────────────────────────┐
│ 5 aktivních · 2 dokončené (7d)                            │
│                                                            │
│ ┌─ Otevřené 3 ─┐ ┌─ V práci 1 ─┐ ┌─ Hotové · 7d 2 ─┐    │
│ │ ...          │ │ ...          │ │ ...              │    │
│ └──────────────┘ └──────────────┘ └──────────────────┘    │
│                                                            │
│ ─ Blokované (1) ─────────────────────────────────────     │
│ ...                                                        │
│                                                            │
│ ─ Devloop tasky (AI workers) ─ [collapse/expand] ────    │
│ ...  (current devloop section, hidden behind summary)      │
└────────────────────────────────────────────────────────────┘
```

Tab 2 keeps current Kanban + Blocked + Devloop sub-section. Devloop sub-section collapsed by default with "Co dělají AI agenti? · 5 v práci" header that expands. Janička sees normal tasks first, devloop only if curious.

## Tab 3 — 📊 Reporty

```
┌─ Reporty a poznámky ────────────────────────────────────┐
│ Filter: [Vše ▾] [Last 30d ▾]      [📥 Export PDF]         │
│                                                            │
│ ─ Note · 2026-04-25 14:23 ──────────────────────────     │
│ "Vinted import dokončen — 354 produktů, 87% match rate"    │
│                                                            │
│ ─ Chart · 2026-04-24 09:00 ─────────────────────────     │
│ ┌─ Týdenní revenue ──────┐                                 │
│ │ ▁▃▅▂▆█▄                │                                 │
│ └────────────────────────┘                                 │
│                                                            │
│ ─ Report · 2026-04-22 ─ [+ Přidat na hlavní stránku] ─    │
│ "Strategická analýza Q2 — 12 odstavců + 3 grafy"           │
│ [Rozbalit detail]                                          │
└────────────────────────────────────────────────────────────┘
```

Move current "Co manažerka říká" artifact feed here. Add filters (kind + date) and PDF export action. Each artifact card = expandable.

## Tab 4 — ⚙️ Session (admin-only)

```
┌─ Strategická session ──────────────────────────────────┐
│ Pro hlubší analýzu — projde data, sortiment, marketing,   │
│ vyplodí reporty a úkoly. Trvá ~10-15 min, stojí cca $0.50.│
│                                                            │
│ ┌─ Spustit novou session ─────────────────────────┐       │
│ │ Volitelně: na co se má zaměřit?                  │       │
│ │ ┌──────────────────────────────────────────────┐ │       │
│ │ │ "Podívej se na newsletter performance, jaké  │ │       │
│ │ │  predmety by Janička měla pushovat..."        │ │       │
│ │ └──────────────────────────────────────────────┘ │       │
│ │ [📷 přiložit] [⚡ Spustit session]                │       │
│ └──────────────────────────────────────────────────┘       │
│                                                            │
│ ─ Historie sessions ─────────────────────────────────     │
│ ┌─ #42 · 2026-04-25 19:00-19:14 · $0.42 · 3 reporty ─┐    │
│ │ Shrnutí: "Newsletter má 23% open rate, doporučuju..." │    │
│ │ [Zobrazit reporty z této session]                     │    │
│ └────────────────────────────────────────────────────┘    │
└────────────────────────────────────────────────────────────┘
```

Tab je hidden if `session.role !== 'admin'`. Janička ho neuvidí. Only bectly admin role.

## DB schema delta

```prisma
// NEW — conversation paradigm
model ManagerThread {
  id              String   @id @default(cuid())
  projectId       Int
  subject         String?               // auto-extracted from first message (≤80 chars)
  status          String   @default("pending")
  // pending → processing → answered → (awaiting_user|closed)
  askedAt         DateTime @default(now())
  processingAt    DateTime?
  answeredAt      DateTime?
  unreadByUser    Boolean  @default(true)  // for badge counter
  lastActivityAt  DateTime @default(now())
  messages        ManagerThreadMessage[]

  @@index([projectId, status])
  @@index([projectId, lastActivityAt])
  @@index([projectId, unreadByUser])
}

model ManagerThreadMessage {
  id           String   @id @default(cuid())
  threadId     String
  thread       ManagerThread @relation(fields: [threadId], references: [id], onDelete: Cascade)
  role         String   // "user" | "manager" | "system"
  bodyMd       String   // raw markdown text
  attachments  String   @default("[]")  // JSON: [{url, type:"image"|"file"}]
  blocks       String   @default("[]")  // JSON: typed rich blocks (chart/image/actions/poll/table)
  createdAt    DateTime @default(now())
  // for actions blocks — tracking which buttons user clicked
  actionResponses String @default("{}")  // JSON: {actionId: {clickedAt, payload}}

  @@index([threadId, createdAt])
}
```

Existing `ManagerSession` stays — repurposed for Tab 4 (full strategic sessions). Existing `ManagerArtifact` stays — Tab 3 reports. Existing `ManagerTask` stays — Tab 2 kanban. Only NEW concept = thread.

## Backend — thread answer worker

New worker type: `manager_thread_answer` (separate from full `manager` worker).

- **Trigger**: poll `ManagerThread.status='pending'` every 30s in `manager_watcher.py`
- **Cost**: Sonnet 4.6, ≤2k input + ≤2k output tokens, target $0.02/answer
- **Prompt**: small system prompt (project context + last 5 messages in thread + last 3 closed answered threads as few-shot examples), user message = thread body
- **Output format**: structured JSON with `bodyMd` + optional `blocks[]` (chart/actions/etc.)
- **Speed**: target <60s end-to-end (p95)
- **On finish**: write ManagerThreadMessage(role=manager), set ManagerThread.status='answered' + unreadByUser=true + revalidatePath

Distinct from full `manager_runner.py` (Opus, ~10min, $0.50) which stays for Tab 4 strategic sessions.

## Notifications

- **Bell icon in admin header** — total unread answered threads (cross-page badge)
- **Toast** when new answer arrives while user has /admin/manager open (Pusher OR SSE OR polling 60s — pick simplest)
- **Telegram** opt-in for bectly when Janička posts urgent question (priority detection — keywords like "rychle", "teď", "?")

## Phasing

| Fáze | Co | Velikost |
|---|---|---|
| **A** | DB schema + Turso migration + manager_thread_answer worker | M |
| **B** | Tabs UI shell + #anchor routing + role-based visibility | S |
| **C** | Konverzace tab — input + thread feed + status badges | M |
| **D** | Block renderer (text/chart/image/actions/poll/table) | M |
| **E** | Notifications — bell badge + revalidation strategy | S |
| **F** | Move existing sections into Tabs 2/3/4 (cosmetic) | S |
| **G** | Empty states + onboarding hints + mobile QA | S |

## Acceptance

1. `/admin/manager` opens with Konverzace tab default
2. Janička types message + clicks Odeslat → thread row in DB → manager answers within 60s → bell badge appears
3. Manager response renders all 6 block types correctly
4. Tab 2 kanban behaves identically to current (no regression)
5. Tab 3 reports filter by kind + date works
6. Tab 4 hidden for non-admin role
7. Mobile: tabs scrollable, no horizontal overflow
8. Lighthouse score ≥85 on /admin/manager
9. ≥3 e2e tests: ask-and-answer happy path, awaiting_user response, mobile tab switch

## Open questions for review

1. **Block schema**: locked to 6 types or extensible registry? (favoring locked for type safety)
2. **awaiting_user response**: pre-defined buttons emit `actionResponses[btnId]` — or rich text reply allowed too? (favoring both — buttons for quick path, "Něco jiného" opens free-text)
3. **Thread expiry / archive**: auto-archive at 30 days? Manual close button? (favoring auto-archive + manual reopen)
4. **Image upload reuse**: same R2 bucket as ManagerSession attachments? (yes, share `manager-uploads/`)
5. **Multi-thread context**: should answer worker see PREVIOUS threads as context? (Yes — last 3 closed in same project for tone consistency)
6. **Cost cap**: hard limit X threads/day or budget $/day? (favoring soft warning + admin-revocable hard cap)

## Files to create

- `prisma/schema.prisma` — add ManagerThread + ManagerThreadMessage models
- `src/lib/manager-thread-blocks.ts` — block type definitions + Zod schemas
- `src/components/admin/manager/conversation-tab.tsx` — Tab 1 layout
- `src/components/admin/manager/tasks-tab.tsx` — Tab 2 (extracted from page.tsx)
- `src/components/admin/manager/reports-tab.tsx` — Tab 3 (extracted)
- `src/components/admin/manager/session-tab.tsx` — Tab 4 (extracted)
- `src/components/admin/manager/thread-card.tsx` — single thread display
- `src/components/admin/manager/thread-input.tsx` — Janička's compose box
- `src/components/admin/manager/thread-message-blocks.tsx` — block renderer (switch over types)
- `src/components/admin/manager/awaiting-user-card.tsx` — top-pinned reply card
- `src/components/admin/manager/manager-tabs.tsx` — wrapper with hash routing
- `src/app/(admin)/admin/manager/[ ... rebuild page.tsx as tabs shell]
- `src/app/(admin)/admin/manager/actions.ts` — add `submitThreadAction`, `submitActionResponseAction`
- `services/manager_thread_runner.py` — small async worker for answering threads
- `services/manager_watcher.py` — extend to poll ManagerThread.pending

## Files to modify

- existing `src/app/(admin)/admin/manager/page.tsx` — collapse to tab shell (~40 lines)
- existing `src/components/admin/manager/start-session-form.tsx` — move into session-tab, repurpose label
- existing artifact-card / task-card / devloop-task-card — keep as-is, just relocate to respective tabs

## Out of scope (for later)

- Voice input on conversation textarea (J10 covers it for QR — same approach later here)
- Cross-thread search ("kdy jsme řešili zimní svetry?")
- Manager learning loop (thread answers → improving tone via memory) — needs research
- Mobile push notifications (PWA J12 dependency)
