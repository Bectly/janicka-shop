# J9: Drafts Review Page — /admin/drafts/[batchId]

*Spec owner: Lead — Cycle #5049*

## Problem

Janička dofotila 17 kousků na mobilu. Batch je uzavřený. Bectly sedne k PC a potřebuje co nejrychleji dostat kousky online. Stávající implementace (review-client.tsx 639 řádků) je solidní základ — auto-save, per-draft publikace, bulk publish — ale chybí: 2-pane desktop layout, selection + completeness badges, bundle cost basis, margin preview, real-time sync, bulk actions a manager drawer.

## Current state (DO NOT break)

- Route: `src/app/(admin)/admin/drafts/[batchId]/page.tsx` — RSC, fetches batch + drafts + categories
- Client: `src/app/(admin)/admin/drafts/[batchId]/review-client.tsx` — full edit + publish
- Actions: `src/app/(admin)/admin/drafts/[batchId]/actions.ts` — updateDraftAction, publishDraftsAction, discardDraftAction
- All existing functionality MUST be preserved

## 2-Pane Layout

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Batch #ABC123 [Uzavřený]  · vytvořen 27.4 · Janička dokončila 18:32 · 17× │
│ ─────────────────────────────────────────────────────────────────────────── │
│ [☑ Vše] [☐ Žádný] [★ Jen kompletní]  │ [📸 Z mobilu] [💬 Manažerka] [🗑]  │
│                    ↑ selection row     │                 [Publikovat vybrané (12)] │
├──────────────────────┬──────────────────────────────────────────────────────┤
│ LEFT PANEL (320px)   │ RIGHT PANEL (flex-1)                                │
│                      │                                                      │
│ ☑ 1. Modrý svetr     │ ┌─ Hlavní fotky ─────────────────────────────────┐  │
│   Zara · M · 349 Kč  │ │ [foto1][foto2][foto3][foto4]  +3                │  │
│   ✓ kompletní        │ └────────────────────────────────────────────────┘  │
│ ─────────────────── │ ┌─ Základky ─────────────────────────────────────┐  │
│ ☑ 2. Černé kalhoty   │ │ Název: [Černé kalhoty H&M       ]              │  │
│   H&M · 38 · 249 Kč  │ │ Cena:  [249 Kč ] ← "Zisk ~232 Kč (93%)"      │  │
│   ✓ kompletní        │ │         💡 Manager: doporučuje 220–270 Kč      │  │
│ ─────────────────── │ │ Značka:[H&M          ] Kat:[Kalhoty ▼]         │  │
│ ☐ 3. Bez názvu       │ └────────────────────────────────────────────────┘  │
│   ? · ? · ?          │ ┌─ Stav + Vady ──────────────────────────────────┐  │
│   ⚠ chybí 3 pole     │ │ Stav: [Excellent ▼]  ☐ Viditelné vady          │  │
│ ─────────────────── │ │ Popis vad: [                           ] ▼auto  │  │
│ [+ přidat z mobilu]  │ └────────────────────────────────────────────────┘  │
│                      │ ┌─ Velikosti + Míry ─────────────────────────────┐  │
│                      │ │ [XS][S][M✓][L][XL]  vlastní: [          ]      │  │
│                      │ │ Délka: [  ] Hruď: [  ] Pas: [  ] Boky: [  ]   │  │
│                      │ │ Poznámka ke střihu: [                    ]      │  │
│                      │ └────────────────────────────────────────────────┘  │
│                      │ ┌─ Z balíčku ────────────────────────────────────┐  │
│                      │ │ Balíček: Remix Mix Kids 5kg (Bulk #3)          │  │
│                      │ │ Kategorie: Trička dívky · 1.2 kg/ks            │  │
│                      │ │ Kupní cena: ~17 Kč (při 200g, 85 Kč/kg)       │  │
│                      │ └────────────────────────────────────────────────┘  │
│                      │ ┌─ SEO + Video (rozbalit) ──────────────────────┐  │
│                      │ │ [collapsed by default]                          │  │
│                      │ └────────────────────────────────────────────────┘  │
│                      │                                    [Publikovat →]   │
└──────────────────────┴──────────────────────────────────────────────────────┘
```

Mobile (<lg breakpoint): stacking layout — list first, tap draft → detail appears (slide or scroll to).

## Completeness function

Required fields for "kompletní": name + price + categoryId + brand + condition + sizes.length > 0

```ts
function scoreDraft(d: DraftRow): { complete: boolean; missing: string[] } {
  const missing: string[] = []
  if (!d.name)           missing.push("název")
  if (!d.price)          missing.push("cena")
  if (!d.categoryId)     missing.push("kategorie")
  if (!d.brand)          missing.push("značka")
  if (!d.condition)      missing.push("stav")
  if (!d.sizes.length)   missing.push("velikost")
  return { complete: missing.length === 0, missing }
}
```

Badge: `✓ kompletní` (emerald) or `⚠ chybí: název, cena` (amber).

## Selection state

```ts
const [selected, setSelected] = useState<Set<string>>(new Set())
const publishable = pendingDrafts.filter(d => scoreDraft(d).complete && selected.has(d.id))
```

Top-bar buttons:
- **Vybrat vše** → select all pending drafts
- **Žádný** → clear selection
- **Jen kompletní** → select only complete pending drafts

Publish button: `Publikovat vybrané (N)` — disabled if `publishable.length === 0`.

Pass selected IDs to `publishDraftsAction(batchId, Array.from(selected))` (already accepts `string[]`).

## Bundle cost basis

When `batch.bundleId` exists, load from page.tsx:
```prisma
batch: {
  include: {
    bundleLine: { select: { name, kg, pricePerKg, totalPrice } }
    bundle: { select: { id, name } }
  }
}
```

In client, receive `bundleLine?: { name: string; kg: number; pricePerKg: number; totalPrice: number }`.

Cost basis per draft:
```ts
function costBasis(draft: DraftRow, batch: BatchMeta): number | null {
  if (!batch.bundleLine) return null
  const weightG = draft.weightG ?? batch.defaultWeightG ?? null
  if (!weightG) return null
  return (batch.bundleLine.pricePerKg / 1000) * weightG  // Kč
}
```

Display: `Kupní cena ~17 Kč (při 200g, 85 Kč/kg)` — show under price field or in "Z balíčku" section.

## Margin preview

Inline with price input:
```ts
const cb = costBasis(draft, batch)
const margin = cb && draft.price ? Math.round(((draft.price - cb) / draft.price) * 100) : null
// "Zisk ~332 Kč (95%)" — color: green if >50%, amber if 20-50%, red if <20%
```

## Delete batch

Server action `deleteBatchAction(batchId)`:
- Confirm dialog: "Smazat celý batch včetně N kousků?"
- Delete all drafts (cascade in Prisma) → delete batch
- Redirect to `/admin/drafts`
- Only available when batch.status !== "published"

## "📸 Přidat z mobilu" button

Calls existing QR generation endpoint / shows existing QR modal (reuse from bundles unpack page if available). If no existing QR modal: open side-sheet with QR code image pointing to `/mobile-add?token=...&batchId=...`. The batch must be re-opened (status → open) before a new token is generated.

## Manager side-drawer

Replace current `router.push('/admin/manager?...')` with a shadcn Sheet (side-drawer, 480px wide) that iframes or embeds the manager interface. The drawer has context passed via URL params: `batchId` + draft IDs. If embedding is complex, keep the navigate-away fallback but open in new tab.

## SSE live sync

Endpoint: `GET /api/admin/drafts/[batchId]/stream` (Server-Sent Events)
- Requires admin session
- Subscribes to batch updates (Redis pub/sub or in-memory Map if Redis unavailable)
- Events: `draft-added`, `draft-updated`, `batch-sealed`
- Client: `useEffect` with `new EventSource(url)`, merges incoming drafts into local state

**Fallback without Redis:** simple 15-second polling via `router.refresh()` with `startTransition`.

Priority: implement polling fallback first, SSE as enhancement.

## Bulk actions dialog

Trigger: "Hromadně upravit (N vybraných)" button — appears when ≥2 drafts selected.

```
┌─ Hromadné úpravy (5 kousků) ──────────────────────────┐
│ Nastavit kategorii:  [— vybrat —  ▼]                   │
│ Nastavit slevu (%):  [     ]                            │
│ Přiřadit k balíčku:  [— vybrat —  ▼]  (jen pokud chybí)│
│ 🤖 Auto-vyplnit popis přes AI                          │
│                                      [Zrušit] [Použít] │
└────────────────────────────────────────────────────────┘
```

Server action: `bulkUpdateDraftsAction(batchId, draftIds, patch)` — updates only specified fields.

AI auto-fill: calls `/api/admin/ai/draft-fill` with draft images + basic fields, returns `{ description, metaTitle, metaDescription }` per draft.

## Empty states

- **0 drafts in batch**: "Naskenuj QR a začni přidávat" + QR shown + timestamp
- **All drafts published**: "Všechno publikováno! 🎉" + link to products list
- **0 selected**: publish button disabled, hint "Vyber kousky které chceš zveřejnit"

## New fields to expose in detail panel

From J8-B1 (all already in DraftRow / Prisma schema):
- `compareAt`: "Původní cena (Kč)" — show as crossed-out on storefront
- `featured`: checkbox "Doporučeno"
- `metaTitle` / `metaDescription`: in SEO section (collapsed)
- `videoUrl`: in Video section (collapsed), text input
- `weightG`: in "Z balíčku" section — "Váha kusu (g)" — overrides batch.defaultWeightG

## Page.tsx additions

Extend the existing RSC to also load:
```ts
include: {
  drafts: { orderBy: { createdAt: 'asc' } },
  bundle: { select: { id: true, name: true } },
  bundleLine: { select: { name: true, kg: true, pricePerKg: true, totalPrice: true } },
}
```

Pass `bundle` and `bundleLine` as props to `BatchReviewClient`.

## Tasks decomposition

| ID   | Agent  | Description |
|------|--------|-------------|
| J9-B1 | BOLT  | 2-pane layout + selection state + completeness badges + delete batch action |
| J9-S1 | SAGE  | Detail panel expansion: all fields, sections, bundle section, margin preview |
| J9-B2 | BOLT  | Bulk update server action + AI draft-fill endpoint |
| J9-S2 | SAGE  | Bulk actions dialog UI + "📸 Z mobilu" modal |
| J9-B3 | BOLT  | SSE stream endpoint (polling fallback first, SSE as enhancement) |
| J9-T1 | TRACE | E2E: select drafts → completeness gate → bulk publish → verify products |

## Acceptance criteria

- [ ] 2-pane layout on desktop (≥lg), stacking on mobile
- [ ] Completeness badge on every draft in left panel
- [ ] "Jen kompletní" selection → publish disabled if any selected is incomplete
- [ ] Bundle cost basis visible in detail panel when batch has bundleLine
- [ ] Margin preview updates live as price changes
- [ ] Delete batch server action with confirm
- [ ] All J8-B1 new fields (videoUrl/compareAt/featured/metaTitle/metaDescription/weightG) editable
- [ ] `npm run build` green, `tsc --noEmit` 0 errors
