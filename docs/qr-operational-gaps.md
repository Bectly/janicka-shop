# J10: QR Pipeline Operational Gaps — Spec

**Lead Cycle #5053 · 2026-04-27**  
**Directive**: #782 — notifications + offline + telemetry + resume  
**Status**: SPEC COMPLETE — tasks #820–#824 filed

---

## Overview

J4 spec covers the happy-path QR flow (PC → QR → phone → seal → review → publish).  
This document covers what breaks outside ideal conditions: poor signal, dead phone mid-session,
no notification when Janička finishes, expensive raw uploads, and no usage data to improve UX.

**MVP scope**: Items B, C, F, A(email only). Ship these in J10.  
**Polish scope**: D (voice), E (full telemetry dashboard), G (web push). Skip until usage data justifies.

---

## A. Notifications

### Scope
When Janička seals a batch → notify bectly: "Janička hotová: batch #42, 17 kousků, k revizi."  
When bectly publishes → optional notify Janička: "Tvých 17 kousků jde do prodeje 🎉"

### Channel decision
| Option | Pros | Cons | Decision |
|--------|------|------|----------|
| Telegram bot | Already exists in JARVIS infra | Requires bot token in shop .env + webhook setup; Janička may not have Telegram | POLISH |
| Resend email | Already integrated, zero new infra | Not instant, but reliable | **MVP** |
| Web Push | Real-time, no app needed | Needs VAPID keys, PWA manifest, permission flow | POLISH (part of G) |
| In-app badge | Always visible in admin panel | Bectly must be in admin to see it | POLISH |

### MVP implementation
**On batch seal** (`POST /api/admin/drafts/[batchId]/seal`):
- Fire-and-forget: `resend.emails.send()` to bectly's registered admin email
- Subject: `Janička hotová — batch #[N], [count] kousků čeká na revizi`
- Body: link to `/admin/drafts/[batchId]`, list of draft item names/prices
- Do not await — batch seal should not fail if email fails
- Env var needed: `ADMIN_NOTIFY_EMAIL` (bectly's email, set in Vercel)

**On batch publish** (bulk publish action):
- Same pattern: email to janička's registered contact (DraftBatch.adminId → Admin.email)
- Only send if batch has a `notifyOnPublish` flag (add to ProductDraftBatch schema)
- Default: `false` — opt-in per QR generation

### Polish (skip)
- Telegram: `POST https://api.telegram.org/bot{TOKEN}/sendMessage` — add when Telegram bot key available
- In-app badge: `AdminNotification` model, badge in sidebar — part of J12 polish

---

## B. Offline Tolerance

### Problem
Janička is on a rural property with weak 4G. Upload fails mid-session → she loses photos and must restart.

### MVP implementation

**IndexedDB queue** (`src/lib/upload-queue.ts`, browser-side):
```
Queue item: { id, batchId, file: Blob, fieldName, retryCount, createdAt, status }
```

Flow:
1. User selects photo → compress (see C) → add to IndexedDB queue with status=`pending`
2. Worker attempts upload via `fetch POST /api/upload`
3. On success: remove from queue, update UI
4. On failure (network error / 5xx): set status=`retry`, increment retryCount
5. `online` event listener: retry all `pending`/`retry` items on reconnect (max 3 retries)

**UI indicator** (in mobile add page):
- Yellow banner: "3 fotky čekají na nahrání" with spinner
- Manual "Zkusit znovu" button
- Per-photo status: grey (queued) / orange (uploading) / green (uploaded) / red (failed)
- Disable "Přidat kus" button while any photos are in status=`pending` or `retry`
  (prevent submitting a draft with un-uploaded images)

**Constraints**:
- IndexedDB limit: typically 50–80% of free disk — safe for typical session (10–30 photos × ~500KB after compression)
- Do not store original raw files (4–12MB each) in IDB — compress first (see C), then queue
- Clear successfully uploaded queue items immediately to avoid storage bloat

---

## C. Photo Compression Pipeline

### Problem
Mobile photos = 4–12 MB raw. Slow uploads on 4G, high R2 costs, slow admin review page.

### MVP implementation (browser-side, before upload)

**`src/lib/image-compress.ts`** (browser utility, no server round-trip):

```typescript
// Input: File from <input type="file">
// Output: { main: Blob, thumb: Blob }
async function compressPhoto(file: File): Promise<{ main: Blob; thumb: Blob }>
```

Steps:
1. Draw to `<canvas>` using `createImageBitmap()` (avoids full DOM decode)
2. Resize to max 1600px on longest side (maintain aspect ratio) → `main`
3. Resize to max 800px → `thumb`
4. Export: `canvas.toBlob('image/webp', 0.85)` → fallback `'image/jpeg', 0.85` if WebP unsupported
5. EXIF strip is implicit (Canvas re-encodes, no EXIF passthrough)
6. Concurrent upload limit: semaphore of 3 (Promise pool via `p-limit` or manual counter)

**Expected savings**:
| Raw | After compress |
|-----|---------------|
| 8 MB iPhone HEIC | ~350 KB WebP main + ~90 KB thumb |
| 4 MB Android JPEG | ~200 KB WebP main + ~60 KB thumb |

**Upload paths**:
- `POST /api/upload?folder=drafts&variant=main` → returns R2 key
- `POST /api/upload?folder=drafts&variant=thumb` → returns R2 key
- Draft item stores both keys; review page uses thumb for grid, main for detail panel

**Constraints**:
- `createImageBitmap()` not supported in older Safari — fallback: `new Image()` + drawImage
- HEIC input: Chrome/Safari handles via OS codec → canvas decode works; Firefox may not → show error "Nepodporovaný formát — pořiďte JPEG"
- Do not block UI during compression — run in `setTimeout` or web worker if >2MB

---

## D. Voice-to-Text

### Scope
Fill text fields (name, description, defectsNote) via voice instead of typing on mobile keyboard.

### Decision: POLISH — skip for J10 MVP

**Why**: Web Speech API results vary heavily by device/locale/noise. Need to test on Janička's actual phone
(likely Android mid-range) before committing to the feature. Shipping broken voice = worse UX than no voice.

**When to re-evaluate**: After J8 mobile add page ships and Janička uses it for 2+ sessions. 
If typing latency shows up in telemetry (see E) as the bottleneck field, schedule D then.

**Implementation note for future**: 
```typescript
const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)()
recognition.lang = 'cs-CZ'
recognition.interimResults = false
```
Whisper fallback only if Czech accuracy unacceptable — adds latency + API cost.

---

## E. Telemetry

### Scope
Track time-per-piece to measure if ≤30s/piece goal is met.

### Decision: POLISH for dashboard, but add schema field in MVP

**Schema addition** (add to `ProductDraftBatch`):
```prisma
timingsJson String @default("{}") 
// { sessionStart: ISO, pieces: [{ draftId, startedAt, submittedAt, fieldTimes: {name:ms, price:ms, ...} }] }
```

**What to capture in J10 MVP** (browser-side, store in batch timings on seal):
- `sessionStart`: when mobile page first loaded
- Per-piece: `startedAt` (form reset), `submittedAt` (Přidat další tapped)
- Derived: `durationMs = submittedAt - startedAt`

**What to skip for MVP**:
- Per-field interaction time (requires onFocus/onBlur on every input — complex)
- Dashboard UI (no /admin/reports/timings page yet — that's Polish or part of J7 reports)
- A/B testing infrastructure

**How timings get stored**: On batch seal, JS sends `timingsJson` in the seal request body.
Server stores it in `ProductDraftBatch.timingsJson`.

**Where to view for now**: Raw JSON visible in `/admin/drafts/[batchId]` detail panel (add small
"Statistiky" collapsible section showing median piece time for the session).

---

## F. Resume / Abandoned Batches

### Problem
Janička starts a batch, phone dies or she gets interrupted, comes back 2h later — 
current implementation: batch has 15min QR TTL → expired, she must start over (losing any saved drafts).

### Architecture clarification
- QR token TTL (15min): only for the **initial QR scan auth**. Once Janička has a session cookie, 
  she can keep using the mobile page regardless of QR expiry.
- Batch TTL (new): separate from QR TTL. Batch stays `open`/`in_progress` for 24h after last activity.
- After 7 days without publish: auto-archive (status=`archived`) + email warning to bectly.

### Schema changes
```prisma
// Add to ProductDraftBatch:
lastActivityAt DateTime @default(now())  // updated on every draft add/edit
// status already has 'open' | 'sealed' | 'published' | 'expired' 
// add: 'archived'
```

### Mobile entry point (new screen: `/admin/drafts/mobile-start`)

When Janička scans a new QR:
1. Server checks: does this `adminId` (Janička's token) have an existing `open` batch from <24h ago?
2. If yes → show choice screen:
   - "Pokračovat v batchi #42 (8 kousků, začato 14:32)" → redirect to existing batch
   - "Začít nový batch" → create fresh batch
3. If no → go directly to new batch (current behavior)

This screen is shown BEFORE the mobile add UI, not after auth.

### Auto-archive cron
Add to existing cron infrastructure (`src/app/api/cron/`):

```
GET /api/cron/archive-stale-batches
- Runs daily (add to vercel.json cron)
- Finds batches: status IN ('open','sealed'), updatedAt < now()-7days
- Sets status='archived'  
- Sends Resend email to batch.admin.email: "Batch #N (X kousků) byl archivován — 
  nebyl publikován 7 dní. Kousky nebyly smazány, lze obnovit ručně."
- Does NOT delete drafts — admin can still view/publish manually
```

### 24h keep-alive
- On every `POST /api/admin/drafts/[batchId]/items`: update `lastActivityAt = now()`
- Batch seal resets this (sealed batches are not auto-archived — only stale open batches are)

---

## G. Push Notifications (Web Push)

### Scope
bectly adds a manager comment → Janička gets browser push notification on her phone.

### Decision: POLISH — skip for J10 MVP

**Why**: Requires PWA manifest + service worker registration + VAPID key pair generation +
`PushSubscription` storage model + permission flow on Janička's device. That's ~3 days of work
for a notification that email covers adequately at MVP stage.

**When to re-evaluate**: After PWA manifest ships (part of task #784 J12 polish).

**Implementation outline for future**:
```
1. Generate VAPID keys: npx web-push generate-vapid-keys
2. Add PushSubscription model to Prisma
3. service-worker.ts: handle push events → show notification
4. /api/push/subscribe: save subscription per user
5. /api/push/send: server-side push via web-push library
```

---

## Task Summary

| ID | Agent | Title | MVP/Polish |
|----|-------|-------|-----------|
| #820 | BOLT | J10-B1: Photo compression pipeline (Canvas resize + WebP + EXIF strip) | MVP |
| #821 | BOLT | J10-B2: Offline upload queue (IndexedDB + retry-on-reconnect + UI indicator) | MVP |
| #822 | BOLT | J10-B3: Resume/abandoned batch (24h TTL + mobile resume screen + archive cron) | MVP |
| #823 | BOLT | J10-B4: Batch-sealed email notification via Resend | MVP |
| #824 | BOLT | J10-B5: Timing telemetry — timingsJson schema + capture on seal | MVP (schema only, no dashboard) |

Polish backlog (file when usage data justifies):
- Voice-to-text (D): after 2+ real sessions, if keyboard timing is the bottleneck
- Web Push (G): after PWA manifest ships (J12)
- Notification dashboard / in-app badge (A polish): part of J12
- Telemetry dashboard UI (E): part of J7 reports cycle
