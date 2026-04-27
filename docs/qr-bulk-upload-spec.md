# QR Bulk-Upload Mobile Pipeline — Design Spec (J4)

**Lead Cycle #5024 · 2026-04-27**
**Status**: DESIGN COMPLETE — follow-up tasks #786–#792 filed

---

## 1. User Stories

| ID | Actor | Story | Acceptance |
|----|-------|-------|------------|
| US-1 | Bectly (PC) | Clicks "Přidat kousky z mobilu" → QR code appears | QR visible within 1s, 15min countdown shown |
| US-2 | Janička (phone) | Scans QR → immediately sees mobile add-UI (no password) | Signed token exchanged for 12h cookie session |
| US-3 | Janička (phone) | Taps "Vyfotit" → camera → photo goes to R2 | Upload ≤4s on LTE, thumbnail visible |
| US-4 | Janička (phone) | Fills title/price/size/condition → "Přidat další" | Item saved as draft, form resets |
| US-5 | Janička (phone) | Taps "Hotovo" | Batch sealed, PC admin notified |
| US-6 | Bectly (PC) | Opens /admin/drafts/[batchId] → reviews each draft | Full product fields editable before publish |
| US-7 | Bectly (PC) | Clicks "Probrat s manažerkou" → chat sidebar | Manager session receives batch artifacts |
| US-8 | Bectly (PC) | Bulk publishes or publishes per-item | Draft → Product with SKU auto-generated |

---

## 2. Architecture

```
PC Admin Browser                Phone (Janička)
───────────────                 ──────────────────
/admin/products
  [Přidat z mobilu] ──POST /api/admin/drafts/start──▶ Server
                                                        │
                    ◀──{ batchId, qrToken, expiresAt }──┘
                    │
  QR code renders   │
  (qrcode.react)    │
                    │            Scans QR
                    │   ─────────────────────────▶
                    │            │
                    │            ▼
                    │     GET /api/admin/drafts/auth?token=<jwt>
                    │            │
                    │            ▼ (validate JWT, set httpOnly cookie)
                    │     /admin/drafts/[batchId]/mobile  (Next.js page)
                    │            │
                    │            ▼ (mobile-optimized add UI)
                    │     POST /api/admin/drafts/[batchId]/items
                    │     POST /api/upload (R2, folder=drafts/)
                    │            │
                    │            ▼ (Hotovo)
                    │     POST /api/admin/drafts/[batchId]/seal
                    │
  PC polls for      │
  batch status      ◀──── SSE /api/admin/drafts/[batchId]/events ───
  (or page refresh)
```

### Key Libraries
- `qrcode.react` — QR rendering on PC (already in many Next.js projects, ~5KB)
- `jsonwebtoken` (or `jose` — already in NextAuth v5 stack) — sign/verify QR tokens
- `sharp` — server-side image compression before R2 (already imported in upload route)
- Existing `uploadToR2()` from `src/lib/r2.ts` — reuse with `folder="drafts"`

---

## 3. DB Schema

Add to `prisma/schema.prisma`:

```prisma
model ProductDraftBatch {
  id          String         @id @default(cuid())
  adminId     String                              // Admin who created the QR
  qrToken     String         @unique              // hashed JWT — never store raw
  tokenHash   String         @unique              // sha256(jwt) for lookup
  expiresAt   DateTime                            // QR link expiry (createdAt + 15min)
  status      String         @default("open")     // open | sealed | published | expired
  sealedAt    DateTime?
  publishedAt DateTime?
  createdAt   DateTime       @default(now())
  updatedAt   DateTime       @updatedAt
  drafts      ProductDraft[]

  @@index([adminId])
  @@index([status])
  @@index([expiresAt])
}

model ProductDraft {
  id          String             @id @default(cuid())
  batchId     String
  batch       ProductDraftBatch  @relation(fields: [batchId], references: [id], onDelete: Cascade)

  // Core product fields (mirrors Product, all optional until publish)
  name        String?
  price       Float?
  categoryId  String?
  brand       String?
  condition   String?            // new_with_tags | excellent | good | visible_wear
  sizes       String             @default("[]") // JSON string[]
  colors      String             @default("[]")
  images      String             @default("[]") // R2 keys (drafts/ prefix)
  description String?
  measurements String            @default("{}")
  fitNote     String?
  defectsNote String?
  defectImages String            @default("[]")
  internalNote String?

  // Draft lifecycle
  status      String             @default("pending") // pending | ready | published | discarded
  publishedProductId String?    @unique              // set when promoted to Product
  createdAt   DateTime           @default(now())
  updatedAt   DateTime           @updatedAt

  @@index([batchId])
  @@index([status])
}
```

> **Note**: `qrToken` stores `sha256(rawJwt)` so the raw token never persists in DB. Raw JWT lives only in the QR code URL. On auth, server hashes the incoming token and looks up by `tokenHash`.

---

## 4. API Endpoints

### 4.1 `POST /api/admin/drafts/start`
Auth: NextAuth admin session required (PC side).

**Request**: `{}` (no body needed)

**Response**:
```json
{
  "batchId": "cuid",
  "qrUrl": "https://janicka.cz/api/admin/drafts/auth?token=<jwt>",
  "expiresAt": "2026-04-27T12:15:00Z"
}
```

**Server logic**:
1. Sign JWT: `{ batchId, adminId, iat, exp: +15min }` with `DRAFT_QR_SECRET` env var
2. Hash JWT (sha256) → store as `tokenHash` in `ProductDraftBatch`
3. Return raw JWT in qrUrl (never stored)

---

### 4.2 `GET /api/admin/drafts/auth?token=<jwt>`
Auth: **none required** (this IS the auth step).

**Server logic**:
1. Verify JWT signature against `DRAFT_QR_SECRET`
2. Check `exp` — reject if expired
3. Hash token → lookup `ProductDraftBatch` by `tokenHash`
4. Check batch `status === 'open'` and `expiresAt > now()`
5. Set httpOnly cookie `draft_session=<batchId>:<adminId>`, SameSite=Strict, maxAge=12h
6. Redirect to `/admin/drafts/[batchId]/mobile`

**Security**: Each JWT is single-use in spirit (token is consumed on first auth, but for UX multiple scans from same phone are OK as long as within 15min window — the cookie idempotently covers this).

---

### 4.3 `GET /admin/drafts/[batchId]/mobile`
Next.js page — **mobile-only UI** (see section 5).

Auth: validates `draft_session` cookie matches `batchId`.

---

### 4.4 `POST /api/admin/drafts/[batchId]/items`
Auth: `draft_session` cookie.

**Request** (multipart or JSON):
```json
{
  "name": "Dámský svetr",
  "price": 299,
  "condition": "excellent",
  "sizes": ["M"],
  "images": ["drafts/uuid-img1.jpg"],
  "categoryId": "optional-or-null",
  "brand": "Zara"
}
```

**Response**: `{ "draftId": "cuid" }`

All fields optional — a draft with only images is valid (PC fills the rest).

---

### 4.5 `PATCH /api/admin/drafts/[batchId]/items/[draftId]`
Auth: `draft_session` cookie OR admin session.

Partial update of any ProductDraft field.

---

### 4.6 `POST /api/admin/drafts/[batchId]/seal`
Auth: `draft_session` cookie.

Marks batch `status = 'sealed'`, `sealedAt = now()`. Triggers optional push notification to PC (via SSE or simple polling).

---

### 4.7 `GET /api/admin/drafts` (PC admin)
Auth: NextAuth admin session.

Lists all batches with status + draft count. For `/admin/drafts` overview page.

---

### 4.8 `POST /api/admin/drafts/[batchId]/publish`
Auth: NextAuth admin session.

**Body**: `{ "draftIds": ["id1", "id2"] }` or `"all"`.

For each draft:
1. Validate required fields (name, price, condition, ≥1 image)
2. Auto-generate SKU (existing `generateSku()` or new utility)
3. Move R2 objects from `drafts/` → `products/` prefix (rename via CopyObject + DeleteObject)
4. Create `Product` record
5. Mark `ProductDraft.status = 'published'`, set `publishedProductId`
6. Return `{ published: N, skipped: M, errors: [...] }`

---

## 5. UX Wireframes (Text-Based)

### 5.1 PC — QR Modal (`/admin/products`)

```
┌─────────────────────────────────────────────┐
│  📱 Přidat kousky z mobilu                  │
├─────────────────────────────────────────────┤
│                                             │
│           ┌─────────────┐                   │
│           │             │                   │
│           │  [QR CODE]  │                   │
│           │  200×200px  │                   │
│           │             │                   │
│           └─────────────┘                   │
│                                             │
│   Nechte Janički naskenovat — vyprší za     │
│   ████████████░░░  12:43                    │
│                                             │
│   Přidáno draftů: 0                         │
│   [Zavřít]                                  │
└─────────────────────────────────────────────┘
```

Polling: every 5s updates "Přidáno draftů: N". When batch sealed: shows "Hotovo! [Otevřít batch]".

---

### 5.2 Phone — Mobile Add Page

```
┌─────────────────────────┐
│ Janička Shop  📸 Batch  │
│ ─────────────────────── │
│                         │
│  ┌───────────────────┐  │
│  │                   │  │
│  │   📷              │  │
│  │   Vyfotit kousek  │  │  ← big tap target, full-width
│  │                   │  │
│  └───────────────────┘  │
│                         │
│  Foto:  [🖼][🖼][+]     │
│                         │
│  Název ________________ │
│  Cena  __ Kč            │
│  Vel.  [XS][S][M][L][XL]│
│  Stav  [●Výborný ▼]     │
│  Značka ____________    │
│                         │
│  [+ Přidat další kousek]│ ← green, full-width
│                         │
│  ──────────────────── 3 │  ← "3 kousky v batchi"
│  [  HOTOVO  ]           │  ← seals batch
└─────────────────────────┘
```

**Progressive disclosure**: Tap "Více polí" expands:
- Barvy (color chips)
- Popis (textarea with voice-to-text mic button)
- Vady (defect note + camera for defect photos)
- Rozměry (cm fields)

---

### 5.3 PC — Batch Review (`/admin/drafts/[batchId]`)

```
┌──────────────────────────────────────────────────────┐
│ Batch #cmXYZ  · Janička · 2026-04-27 14:31  [sealed] │
│                                                       │
│  [Probrat s manažerkou]  [Publikovat vše]             │
├──────────────────────────────────────────────────────┤
│ Draft 1/5                                  [Zahodni] │
│ ┌────────┐  Název: [Dámský svetr Zara_____]          │
│ │🖼 foto │  Cena:  [299 Kč___]  Vel: [M]             │
│ │        │  Stav:  [Výborný ▼]  Kat: [Svetry ▼]     │
│ └────────┘  [Publikovat tento kousek]                 │
├──────────────────────────────────────────────────────┤
│ Draft 2/5  ...                                        │
└──────────────────────────────────────────────────────┘
```

---

### 5.4 Manager Sidebar

```
┌──────────────────┐  ┌─────────────────────────────────┐
│  Draft review    │  │  💼 Manažerka                   │
│  [Batch #cmXYZ]  │  │                                 │
│  ...             │  │  Podívám se na batch...         │
│                  │  │                                 │
│                  │  │  Svetr Zara: doporučuji 349 Kč  │
│                  │  │  (podobné prodávají za 320-380) │
│                  │  │                                 │
│                  │  │  [____________________ Send]    │
└──────────────────┘  └─────────────────────────────────┘
```

---

## 6. Security Model

| Threat | Mitigation |
|--------|-----------|
| QR link shared/leaked | JWT exp=15min hard cutoff; `expiresAt` double-checked in DB |
| Replayed QR token | `tokenHash` unique in DB; batch `status` checked (expired/sealed batches reject auth) |
| Unauthorized draft access | `draft_session` cookie carries `batchId:adminId`, validated per-request |
| Image injection (MIME spoofing) | Existing magic-byte validation in `src/app/api/upload/route.ts` — reused |
| R2 draft objects orphaned | Cron job (weekly): delete R2 objects in `drafts/` older than 7d with no published Product |
| Brute force on draft auth | `DRAFT_QR_SECRET` rotation; JWT signature already prevents guessing |
| CSRF on seal/publish | SameSite=Strict cookie + Referer check |
| Draft published with missing fields | Publish endpoint validates required fields before creating Product |

**Env vars to add**:
- `DRAFT_QR_SECRET` — 32-byte random secret for JWT signing (separate from NextAuth secret)

---

## 7. Manager Integration

When "Probrat s manažerkou" is clicked:

1. Fetch all `ProductDraft` records for the batch (with images, name, price, condition)
2. Construct a structured prompt:
   ```
   Tento batch obsahuje N kousků k přezkoumání. Pro každý kousek navrhni:
   - Doporučenou cenu (srovnej s Vinted/Bazaros CZ)
   - Kategorii
   - SEO slug
   - Upozorni na duplicity
   Kousky: [JSON array of drafts]
   ```
3. Open existing `/admin/manager` route with this prompt pre-filled as the initial message
4. Manager response rendered in sidebar next to draft review

This reuses the existing `/admin/manager` infrastructure — no new backend needed for MVP.

---

## 8. Phased Rollout

### MVP (tasks #786–#790)
- [ ] Prisma migration: `ProductDraftBatch` + `ProductDraft` models
- [ ] API: `/api/admin/drafts/start`, `/auth`, `/[batchId]/items`, `/[batchId]/seal`
- [ ] PC: QR modal on `/admin/products` with polling
- [ ] Phone: `/admin/drafts/[batchId]/mobile` — minimal add form (name/price/size/condition + camera)
- [ ] PC: `/admin/drafts/[batchId]` review page with per-item edit + publish

### Polish (tasks #791–#792)
- [ ] Progressive disclosure on mobile (voice-to-text, measurements, defect photos)
- [ ] Manager sidebar integration
- [ ] SSE instead of polling for batch sealed event
- [ ] R2 draft cleanup cron
- [ ] PWA manifest for mobile add page (offline-capable, add to home screen)

---

## 9. Test Plan

### Unit
- `verifyQrToken()`: expired token rejected, wrong secret rejected, valid token passes
- `hashToken()`: deterministic sha256, no collisions for distinct inputs
- `publishDraft()`: missing name → error; missing price → error; valid draft → Product created, SKU set, R2 key moved

### E2E (Playwright)
- **Happy path**: PC starts batch → QR renders → mobile page loads → add 2 items with photos → seal → PC review page shows 2 drafts → publish → `/admin/products` shows 2 new products
- **Expired QR**: auth after 15min → 401, redirect to error page
- **Incomplete draft**: publish without name → error toast, no Product created

---

*Generated by Lead · Cycle #5024 · Follow-up tasks: #786 (Bolt/DB), #787 (Bolt/API-auth), #788 (Bolt/API-crud), #789 (Sage/mobile-UI), #790 (Bolt/PC-review), #791 (Sage/manager-sidebar), #792 (Trace/E2E)*
