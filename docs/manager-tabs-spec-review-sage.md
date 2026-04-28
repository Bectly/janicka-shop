# Manager Tabs Spec — Sage Visual & Interaction Review

**Reviewer**: Sage (J21-REVIEW-SAGE)
**Date**: 2026-04-28
**Spec**: `docs/manager-tabs-spec.md`
**Companion**: `docs/manager-tabs-spec-review-lead.md` (strategy already covered)
**Status**: REVIEW COMPLETE — visual/interaction additions to spec, ready for J22-J28 split

---

## TL;DR

Lead pokryl strategii a flow. Tady řeším **co Janička reálně vidí na obrazovce** — typografii, mezery, animace, mobile chování, kontrast, a-11y, reuse design systému. 4 nutné zásahy, 5 silně doporučených, 3 polish. Phasing zachovávám per Lead §4.

---

## 1. VISUAL HIERARCHY

### 1.1 První dojem ASCII mockupu — HUSTÁ ZEĎ

V mockupu Tab 1 je `awaiting_user` karta (3 řádky), `processing` karta (3 řádky), `answered` karta s chartem (12+ řádků), starší answered (collapsed). Bez whitespace tokenizace to vypadá jako 4 stejně-významné bloky. Janička si po 2 sekundách neodečte "kde je nové, kde je staré".

**Oprava (nutná):** Hierarchie přes `gap-*`, ne přes border-width:

```
- Compose box ─────────────────  (rounded-2xl, border, mb-6)

- Manažerka se ptá tebe          (gap-3 mezi sekcemi)
  └ awaiting_user card           (pink ring-2 + animate-pulse on bell)

  ↕ space-y-8                    ← větší gap mezi "manažerka se ptá" a "tvoje dotazy"

- Tvé dotazy
  └ processing thread            (amber tint)
  └ answered (unread, <24h)      (pink left-border-4)
  └ answered (read, <24h)        (neutral, no border accent)
  └ collapsed older              (subtle, opacity-70, hover:opacity-100)
```

Mezeré řády: **`space-y-3` uvnitř sekce, `space-y-8` mezi sekcemi**. Section header = `text-xs uppercase tracking-wide text-muted-foreground` (subtle, nečte se jako titul, ale strukturuje).

### 1.2 Color-coded states — sjednotit s `MOOD_TINT` patternem

Spec navrhuje "gray bg / amber bg / pink left-border / 🔔 čeká odpověď". V projektu **už existuje pattern** v `src/components/admin/manager/artifact-card.tsx` (L30-34):

```ts
const MOOD_TINT = {
  positive: "border-emerald-500/30 bg-emerald-500/5",
  concern: "border-amber-500/30 bg-amber-500/5",
  urgent: "border-red-500/30 bg-red-500/5",
};
```

A v `devloop-task-card.tsx` (L32-39): `bg-{c}-500/15 text-{c}-700 border-{c}-500/30`.

**Oprava (nutná):** Reuse existující paletu, ne vymýšlet novou.

```ts
// src/components/admin/manager/thread-state-tokens.ts
export const THREAD_STATE_TOKENS = {
  pending: {
    container: "border-slate-300 bg-slate-50",
    badge: "bg-slate-500/15 text-slate-700 border-slate-500/30",
    label: "Čeká",
    icon: Clock,
  },
  processing: {
    container: "border-amber-500/30 bg-amber-500/5",
    badge: "bg-amber-500/15 text-amber-700 border-amber-500/30",
    label: "Zpracovává se",
    icon: Loader2, // s animate-spin
  },
  answered_unread: {
    container: "border-l-4 border-l-pink-500 border-y border-r border-pink-200 bg-pink-50/40",
    badge: "bg-pink-500/15 text-pink-700 border-pink-500/30",
    label: "Nové",
    icon: Sparkles,
  },
  answered_read: {
    container: "border-slate-200 bg-white",
    badge: "bg-slate-100 text-slate-600 border-slate-200",
    label: "Odpovězeno",
    icon: Check,
  },
  awaiting_user: {
    container: "ring-2 ring-pink-500/40 border-pink-300 bg-gradient-to-br from-pink-50 to-white shadow-md shadow-pink-500/10",
    badge: "bg-pink-500 text-white border-pink-600",
    label: "Čeká odpověď",
    icon: Bell, // s motion-safe:animate-pulse
  },
  closed: {
    container: "border-slate-200 bg-slate-50/50 opacity-70",
    badge: "bg-slate-100 text-slate-500 border-slate-200",
    label: "Archivováno",
    icon: Archive,
  },
} as const;
```

Pink je brand accent (J14 PhotoAddCTA `from-pink-500 to-pink-600`). Použít ho pouze pro **stavy vyžadující pozornost Janičky**: `awaiting_user`, `answered_unread`. Manager má vlastní akcent? **Ne, přebíráme pink.** Purple by konkurovalo pink z J14 a tematicky pink padne ("Manažerka projektu" = Janička barva).

### 1.3 Bell icon umístění — banner, ne tab badge, ne floating

Lead §2.2 navrhuje **sticky cross-tab banner** nad taby. Souhlasím a zpřesňuji vizuál:

```
┌──────────────────────────────────────────────────────────────┐
│ 🔔 Manažerka čeká na tvou odpověď · "Vintage nebo Top značky?" │  ← sticky
│                                          [Otevřít konverzaci →]│     gradient pink-50→white
└──────────────────────────────────────────────────────────────┘     border-pink-300, py-2.5
```

CSS: `sticky top-0 z-30 -mx-6 px-6 py-2.5 border-b border-pink-300 bg-gradient-to-r from-pink-50 to-white`. Bell ikona `text-pink-600 motion-safe:animate-pulse [animation-duration:2s]`. Subject zkrácen `truncate` na 1 řádku desktop, na mobile 2 řádky `line-clamp-2`.

**Header global bell** (admin sidebar/topbar) = malý `rounded-full bg-pink-500 text-white text-xs h-5 min-w-5 px-1.5` badge. Pouze číslo unreadu, klik = redirect na `/admin/manager#konverzace`. Cross-page badge = source of truth o tom, že existuje něco neviděného. Banner je jen kontextová zkratka, když už je Janička na `/admin/manager`.

**Floating button NE.** Mobile floating action button by konkurovalo s J14 pink CTA na ostatních admin stránkách — vizuální chaos.

### 1.4 Block renderer — typografie

Spec definuje 6/7 bloků (po Lead úpravě: text/chart/image/actions/poll/table/product_grid). Vizuální specifikace chybí. Návrh:

| Block | Container | Inner |
|---|---|---|
| `text` | `prose prose-sm prose-slate max-w-none` | `<ReactMarkdown remarkPlugins={[remarkGfm]}>` (reuse z artifact-card) |
| `chart` | `rounded-lg border bg-white p-4 my-3` + caption `text-xs text-muted-foreground mb-2` | `<ResponsiveContainer height={180}>` + recharts (reuse) |
| `image` | `rounded-lg overflow-hidden border my-3` + caption `text-xs text-muted-foreground p-2` | `<Image fill sizes="(max-width:640px) 100vw, 480px">` |
| `actions` | `flex flex-wrap gap-2 mt-4 pt-3 border-t border-dashed` | shadcn `<Button>` — primary `default`, secondary `outline`, danger `destructive` per intent |
| `poll` | `rounded-lg border bg-slate-50/50 p-4 my-3` | radio group + "Odeslat hlas" button |
| `table` | `rounded-lg border overflow-hidden my-3` | shadcn `<Table>` reuse |
| `product_grid` | `grid grid-cols-2 sm:grid-cols-3 gap-3 my-3` | reuse `<ProductCard variant="compact">` (pokud neexistuje varianta, vytvořit `compact` = míň paddingu, jen image + title + price) |

**Code block neimplementovat** (Lead §1.2 odebral).

**Důležité:** Block container je **uvnitř message body**, ne kolem celé thread karty. Hierarchie: `<ThreadCard><MessageBubble><ThreadMessageBlocks blocks={...}/></MessageBubble></ThreadCard>`.

---

## 2. MICRO-INTERACTIONS

### 2.1 Status transitions — animace

Mental model: thread "putuje" zleva doprava `pending → processing → answered`. Karta neslučuje pozici, mění se **stav uvnitř karty** (badge, container border, content). Žádný sliding animation mezi sekcemi — to by bylo dezorientující a Framer Motion není instalovaný.

**Doporučená animace (CSS only, no lib):**

- `pending → processing`: badge `animate-pulse` start, container border barva přechází `transition-colors duration-300`
- `processing → answered`: container `transition-all duration-500`, message body fade-in přes `motion-safe:animate-in fade-in slide-in-from-bottom-2 duration-500` (Tailwind v4 + tw-animate-css patterns už project používá per shadcn defaults)
- `answered_unread → answered_read`: pink left-border collapses `transition-all`, na klik nebo po 3s na obrazovce (intersection observer)

**Žádný plný re-mount karty.** React key zůstává stabilní = stav se mění in-place.

### 2.2 "Manažerka čte..." dots — žádný precedent v projektu

Grep neodhalil typing-dots pattern (žádný dev-chat folder, žádný chat ui). **Vytvořit nový:**

```tsx
// src/components/admin/manager/typing-dots.tsx
export function TypingDots({ label = "Manažerka přemýšlí" }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-amber-700" aria-live="polite">
      <span>{label}</span>
      <span className="flex gap-1" aria-hidden>
        <span className="size-1.5 rounded-full bg-amber-500 motion-safe:animate-bounce [animation-delay:0ms]" />
        <span className="size-1.5 rounded-full bg-amber-500 motion-safe:animate-bounce [animation-delay:150ms]" />
        <span className="size-1.5 rounded-full bg-amber-500 motion-safe:animate-bounce [animation-delay:300ms]" />
      </span>
    </div>
  );
}
```

Reduce-motion fallback: `motion-safe:animate-bounce` = na `prefers-reduced-motion` se nehýbe (Tailwind respektuje). Screen reader dostane label přes `aria-live="polite"`.

**Copy doporučení:** "Manažerka přemýšlí" lépe než "čte". "Čte" implikuje že čte nahlas / dělá pomalou věc; "přemýšlí" je realisticky jak Sonnet pracuje a Janička pochopí.

### 2.3 Akční button "✓ Spustit slevu" — confirm modal pro destruktivní/finanční akce

Spec nezmiňuje confirm flow. UX rozhodnutí podle kategorie akce:

| Action type | Confirm? | Důvod |
|---|---|---|
| `publish_discount` (mění ceny v eshopu) | **ANO**, shadcn `<Dialog>` | Finanční dopad, viditelné zákazníkům |
| `open_url` (link na admin stránku) | NE, just navigate | Žádný side-effect |
| `create_task` (vytvoří task v Kanban) | NE, optimistic + toast | Lehce vratné — task lze smazat |
| `mark_collection` (přidá produkty do kolekce) | NE, optimistic + toast s undo | Vratné jednou klik |
| `send_email` (odešle marketing email) | **ANO**, Dialog s preview | Nelze vrátit |

Optimistic UI pattern (pro reversible akce):

```tsx
const [isPending, startTransition] = useTransition();
const [optimistic, setOptimistic] = useState<"idle" | "done" | "error">("idle");

async function handleClick() {
  setOptimistic("done");
  startTransition(async () => {
    const result = await actionResponse({ threadId, blockId, buttonId });
    if (!result.ok) {
      setOptimistic("error");
      toast.error("Nepodařilo se spustit. Zkus to znova.");
      // rollback po 2s nebo na klik
    } else {
      toast.success("Hotovo · Sleva spuštěna");
    }
  });
}
```

Button states: idle / `isPending && optimistic==="done"` (Loader2 spin + "Spouštím...") / `optimistic==="done"` (Check + "Spuštěno") / `optimistic==="error"` (AlertCircle + "Zkus znova").

### 2.4 Mobile tap targets — ověřeno proti spec

Spec implicitně předpokládá běžné pixely. Audit doporučení Apple HIG / Google Material:

| Element | Min size | Spec conformance |
|---|---|---|
| Tab trigger (top desktop) | 40×40px | OK (h-10 = 40px ze shadcn) |
| Tab trigger (bottom mobile per Lead §2.4) | **64×64px touch zóna** | **MISSING** ze spec |
| `[Vintage] [Top značky]` awaiting buttons | 48×48px | musí mít `min-h-12 px-4 py-2` |
| `[Odeslat →]` | 48px | OK pokud `h-12` |
| `[📷 přiložit]` icon button | **48×48px**, ne 32×32 | spec říká `[📷 přiložit]` ale ASCII to je dvouznak — implement jako `<Button size="lg" variant="outline"><Camera/> Přiložit fotky</Button>` |
| Collapsed thread row (klik = expand) | **min-h-14** (56px), full-width klik zóna | musí být celý `<button>`, ne jen ChevronDown ikona |
| Bell icon v headeru | min-h-10 obalený `<button>` | OK |

**Acceptance criterion přidat:** "Všechny interaktivní prvky na mobile mají touch target ≥48px (per WCAG 2.5.5 AAA / Material spec)."

---

## 3. RESPONSIVE — 3 ALTERNATIVNÍ MOBILNÍ LAYOUTY

Lead §2.4 navrhuje bottom-nav. Tady 3 mockupy s trade-offs:

### Layout A: Bottom-nav (Lead doporučení) ★ DOPORUČUJI

```
320px:
┌────────────────────────────┐
│ 🌷 Manažerka          [≡] │  ← header h-14
├────────────────────────────┤
│                            │
│ 🔔 Čeká odpověď         →  │  ← awaiting banner sticky
├────────────────────────────┤
│                            │
│  ┌──────────────────────┐  │
│  │ Compose...           │  │
│  │ [📷] [💬]   [Odeslat] │  │  full-width
│  └──────────────────────┘  │
│                            │
│  ─ Tvé dotazy ─            │
│                            │
│  ┌──────────────────────┐  │
│  │ ⏳ "Cena svetru?"     │  │  card stack, full-width
│  │ Manažerka přemýšlí...│  │  px-4, gap-3
│  └──────────────────────┘  │
│                            │
│  ┌──────────────────────┐  │
│  │ 🔴 "Sleva mikiny?"    │  │
│  └──────────────────────┘  │
│                            │
│  pb-24 (gap pro bottom)    │  ← důležité, jinak content schovaný za navem
│                            │
├────────────────────────────┤
│ 💬 2🔴  📋 5  📊  ⚙️       │  ← fixed bottom-0, h-16, safe-area-inset-bottom
└────────────────────────────┘
```

**Plus:** palec native dosáhne, 4 sloty optimum, banner stále visible.
**Minus:** zabírá vertikální prostor, fixed positioning + iOS safe-area komplikace.
**Implementace:** `pb-[calc(4rem+env(safe-area-inset-bottom))]` na content, `pb-[env(safe-area-inset-bottom)]` na nav.

### Layout B: Top-tabs scrollable (spec original)

```
320px:
┌────────────────────────────┐
│ 🌷 Manažerka          [≡] │
├────────────────────────────┤
│ 🔔 Čeká odpověď         →  │
├────────────────────────────┤
│ ┌──┬──┬──┬──┐             │
│ │💬│📋│📊│⚙️│ ← horizontal│  scroll-x, snap-mandatory
│ └──┴──┴──┴──┘             │
├────────────────────────────┤
│ (content)                  │
└────────────────────────────┘
```

**Plus:** native shadcn Tabs, jeden CSS změnu (`flex overflow-x-auto`).
**Minus:** palec na vrchol = dead zone pro one-handed use; 4 sloty se vejdou bez scrollu — proč scroll vůbec?
**Verdikt:** sub-optimální.

### Layout C: Hybrid — banner + segmented control + sticky compose

```
320px:
┌────────────────────────────┐
│ 🌷 Manažerka          [≡] │
├────────────────────────────┤
│ 🔔 Čeká odpověď         →  │
├────────────────────────────┤
│ ┌────┬────┬────┬────┐     │
│ │💬 2│📋 5│📊  │⚙️ │ ← seg│  segmented full-width
│ └────┴────┴────┴────┘     │
├────────────────────────────┤
│ (thread feed)              │
│ ...                        │
│                            │
├────────────────────────────┤
│ ┌──────────────────────┐   │
│ │ Napiš zprávu...   [↑] │  │ ← compose sticky bottom
│ └──────────────────────┘   │
└────────────────────────────┘
```

**Plus:** primary akce (psaní) je nejblíž palci. Segmented control je readable, full-width.
**Minus:** Compose stále na obrazovce i když Janička scrolluje stará vlákna — možná otravné. Tab change vyžaduje reach na top.
**Verdikt:** dobrý pro Konverzaci tab, ale ostatní taby (Úkoly/Reporty) compose nepotřebují → asymetrie.

**Verdikt celkem:** Layout A (bottom-nav). Compose box uvnitř Konverzace tabu, ale **ne sticky** — když Janička scrolluje historii, ať historie vyhraje. Inline `<button>` "Napsat zprávu" sticky-bottom-nad-tabbar by mohlo fungovat ve v2 pokud telemetrie ukáže že compose je málo používaný.

---

## 4. ACCESSIBILITY

### 4.1 Tab role / aria

Shadcn `Tabs` (base-ui) má roles correct out-of-box (`role="tablist"`, `role="tab"`, `aria-selected`, `aria-controls`). **Nepřepisovat.** Custom positioning (bottom-nav) musí zachovat `data-slot="tabs-list"` strukturu.

```tsx
<Tabs defaultValue="konverzace" value={tab} onValueChange={setTab}>
  <TabsList className="hidden md:inline-flex md:relative md:bottom-auto fixed bottom-0 inset-x-0 h-16 z-40 rounded-none border-t bg-white md:rounded-lg md:border-0 md:bg-muted">
    <TabsTrigger value="konverzace" className="flex-1 md:flex-initial flex-col gap-0.5 md:flex-row md:gap-2">
      <MessageCircle className="size-5" aria-hidden />
      <span className="text-[10px] md:text-sm">Konverzace</span>
      {unread > 0 && <Badge variant="destructive">{unread}</Badge>}
    </TabsTrigger>
    {/* ... */}
  </TabsList>
</Tabs>
```

### 4.2 Keyboard nav

Spec říká "1/2/3/4 přepíná taby". Implementovat globální `useEffect` s `keydown` listener (gated `if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return`). Plus:

- `Tab` / `Shift+Tab` cycluje focusable: compose → odeslat → awaiting buttons → thread cards → load older
- `Enter` v compose box = odeslat (s `Shift+Enter` = newline) — standard chat pattern
- `Esc` v processing/awaiting state = nic (žádné cancel) — nelze stornovat dotaz po odeslání
- `Esc` v dialog (confirm modal pro publish_discount) = close dialog

### 4.3 Screen reader announcements

Nejdůležitější: oznámit **změnu thread stavu** bez page refresh.

```tsx
// thread-card.tsx
<div role="status" aria-live="polite" aria-atomic="false">
  {status === "processing" && <span className="sr-only">Manažerka přemýšlí nad tvým dotazem.</span>}
  {status === "answered" && wasJustAnswered && <span className="sr-only">Manažerka odpověděla na dotaz: {thread.subject}</span>}
</div>
```

Banner `aria-live="assertive"` pro `awaiting_user` (vyžaduje pozornost). Toast notifikace use sonner — má built-in `role="status"`.

### 4.4 Color contrast WCAG AA — audit state badges

Test přes Tailwind palette (https://tailwindcss.com/docs/customizing-colors) — wezmeme typické kombinace:

| Combo | Ratio | AA pass? |
|---|---|---|
| `text-pink-700` on `bg-pink-50` | 7.2:1 | ✅ AAA |
| `text-amber-700` on `bg-amber-500/5` (~98% slate-50) | 6.4:1 | ✅ AA large |
| `text-pink-600` on `bg-white` (banner CTA) | 4.7:1 | ✅ AA |
| **Pink-500 bg + white text** (J14 button) | 3.5:1 | ⚠️ AA Large only — **nepoužívat na malé text** |
| `text-slate-500` on `bg-slate-50` (collapsed thread) | 4.5:1 | ✅ AA borderline |
| `bg-pink-500 text-white` na badge `awaiting_user` | 3.5:1 | ⚠️ Borderline — **přidat font-semibold + min-text-sm** abychom byli v "Large" zóně |

**Acceptance přidat:** "Všechny stavové badges projdou WCAG AA contrast (≥4.5:1 pro text-sm, ≥3:1 pro text-base font-bold)."

### 4.5 Reduce-motion

Všechny animace (`animate-pulse`, `animate-bounce`, `animate-spin` na Loader2) přefixovat `motion-safe:` per Tailwind konvenci. Project už tak dělá v PhotoAddCTA (L21). Loader2 spinning je ale informativní stav (něco se děje) — **ne** wrap motion-safe. Pro `prefers-reduced-motion` substitute Loader2 → static `Hourglass` ikona.

---

## 5. EXISTING DESIGN SYSTEM — REUSE MAPA

| Spec component | Use existing | Custom needed |
|---|---|---|
| `ManagerTabs` | `@/components/ui/tabs` (base-ui) | wrapper s hash routing + bottom-nav variant |
| `ThreadCard` container | inspirace: `artifact-card.tsx` (border + tint) | shape je odlišný (chat bubble), ale tint mapping reuse `MOOD_TINT` paletu |
| `ThreadInput` (compose) | `@/components/ui/textarea` + `@/components/ui/button` | wrap s attachment uploader (reuse `image-upload.tsx`) |
| `AwaitingUserCard` (top-pinned) | `@/components/ui/card` | s pink ring-2 ze `THREAD_STATE_TOKENS.awaiting_user` |
| `TypingDots` | NIC — neexistuje | nová mikrokomponenta (~20 LOC) |
| `Block: text` | `react-markdown` + `remark-gfm` (už nainstalované per artifact-card.tsx L4-5) | — |
| `Block: chart` | `recharts` (už nainstalované, artifact-card.tsx L6) | — |
| `Block: image` | `next/image` | caption styling |
| `Block: actions` | `@/components/ui/button` | optimistic state machine (§2.3) |
| `Block: poll` | `@/components/ui/radio-group`? | **CHYBÍ** — radio-group není v `ui/`. Buď přidat shadcn radio-group, nebo `<input type="radio">` styled |
| `Block: table` | `@/components/ui/table` | — |
| `Block: product_grid` (Lead add) | `@/components/shop/product-card.tsx`? | nutná `compact` variant (no add-to-cart, no wishlist, jen thumb+title+price+condition) |
| `ConfirmDialog` (publish_discount) | `@/components/ui/dialog` | — |
| Mobile drawer (older threads "Načíst starší") | `@/components/ui/drawer` | optional (může být inline expand) |
| `TaskSpawnedChip` (Lead §1.1) | `@/components/ui/badge` + `Link` | tiny new component |
| `BellBadge` (admin header) | `@/components/ui/badge` | hook `useUnreadThreadCount()` |

**ChyběJÍCÍ ve `src/components/ui/`:** `radio-group`, `popover` (možná pro thread actions menu), `tooltip` (state badge label expansion). Bolt přidá per-need (shadcn add je triviální).

**Kategorie barev — tabulka pro Bolt:**

```ts
// src/lib/manager-tokens.ts (návrh, vytvořit v Fázi 1a)
export const MANAGER_TOKENS = {
  // brand accent — POUZE pro stavy vyžadující Janičkovu pozornost
  brand: {
    bg: "bg-pink-500",
    bgSubtle: "bg-pink-50",
    border: "border-pink-300",
    borderStrong: "border-pink-500",
    text: "text-pink-700",
    textInverse: "text-white",
    ring: "ring-pink-500/40",
    gradient: "bg-gradient-to-br from-pink-500 to-pink-600", // J14 conformance
  },
  // neutral — pro klidné, "uklizené" stavy (collapsed, archived, read)
  neutral: {
    bg: "bg-slate-50",
    border: "border-slate-200",
    text: "text-slate-700",
    textMuted: "text-slate-500",
  },
  // state tints — reuse z artifact-card MOOD_TINT
  state: {
    success: "border-emerald-500/30 bg-emerald-500/5 text-emerald-700",
    warning: "border-amber-500/30 bg-amber-500/5 text-amber-700",
    danger:  "border-red-500/30 bg-red-500/5 text-red-700",
    info:    "border-sky-500/30 bg-sky-500/5 text-sky-700",
  },
  // typography
  typo: {
    threadSubject: "font-semibold text-base",
    threadMeta:    "text-xs text-muted-foreground",
    sectionLabel:  "text-xs uppercase tracking-wide font-medium text-muted-foreground",
    bodyMd:        "prose prose-sm prose-slate max-w-none",
  },
  // spacing rhythm
  rhythm: {
    threadGap:        "space-y-3",
    sectionGap:       "space-y-8",
    cardPadding:      "p-4 sm:p-5",
    cardRadius:       "rounded-2xl",
    blockGap:         "my-3",
  },
} as const;
```

Bolt importuje token namespace místo magic class strings — sjednotí refactor a později i theming.

---

## 6. EMPTY STATES — CHYBÍ V SPEC PRO 3 TABY

Spec má empty state jen pro Konverzaci. Doplnit:

### Tab 2 Úkoly (žádné aktivní)

```
🎉
Žádné úkoly od manažerky.
Ptej se v Konverzaci a manažerka ti rovnou nadhodí akční kroky.
[Otevřít konverzaci]
```

### Tab 3 Reporty (žádné artefakty)

```
📊
Reporty se objeví až manažerka vyrobí analýzu.
Spusť strategickou session (admin) nebo se zeptej v Konverzaci.
```

### Tab 4 Session (admin only, žádná historie)

```
⚙️
Nikdy jsi nespustil/a strategickou session.
Manažerka udělá hluboký dive do byznysu — analýzy, doporučení, úkoly.
Trvá ~10-15 min, stojí cca $0.50.
[Spustit první session]
```

Centrální sloupec, `text-center max-w-sm mx-auto py-12`. Emoji `text-5xl mb-3`, headline `text-base font-medium`, body `text-sm text-muted-foreground`, CTA `mt-4`.

---

## 7. ACCEPTANCE CRITERIA — DOPLŇKY KE SPEC

Kromě bodů 1-9 ze spec přidat:

10. **State token consistency**: všechny thread states reuse `THREAD_STATE_TOKENS` mapu (žádné inline `bg-amber-500/5`); audit přes `grep` po implementaci.
11. **Touch targets**: všechny interaktivní elementy mobile ≥48×48px (test přes Playwright `boundingBox()`).
12. **Reduce-motion**: žádná animace nesmí běžet při `prefers-reduced-motion: reduce` (test přes Playwright `emulateMedia({ reducedMotion: 'reduce' })`).
13. **Screen-reader thread state**: změna `processing → answered` oznamována přes `aria-live` (test přes axe-core nebo manuální VoiceOver).
14. **Color contrast AA**: všechny state badges projdou ≥4.5:1 ratio (Storybook + Stark plugin nebo manuální).
15. **Bottom-nav iOS safe area**: na iPhone simulator content nepřekrývá home indicator (`pb-[env(safe-area-inset-bottom)]` ověřit).
16. **Banner reactive**: Janička je na Tab 2 Úkoly, do DB se pushne `awaiting_user` thread — banner se objeví **bez F5** (revalidatePath nebo SWR `mutate`).
17. **Optimistic action button rollback**: když `publish_discount` action vrátí `{ ok: false }`, button vrátí do idle a ukáže error toast.
18. **Empty state per tab**: každý tab má vlastní empty state, ne jeden generický.
19. **Pink accent disciplina**: pink barva se v UI objeví **pouze** v: J14 PhotoAddCTA (jiné stránky), admin header bell badge, banner, awaiting_user card, answered_unread left-border. Žádné pink na: tlačítkách bez awaiting kontextu, headers, links. (audit přes `grep "pink-500\|pink-600" src/components/admin/manager/`).

---

## 8. SOUHRN ZÁSAHŮ DO SPEC

### Nutné před implementací (vizuální)
1. **Definovat `THREAD_STATE_TOKENS`** s reuse `MOOD_TINT` paletu (§1.2)
2. **Sticky cross-tab banner** vizuál + safe-area-aware (§1.3, navazuje na Lead §2.2)
3. **Block typografie tabulka** přidána do spec sekce "Block types" (§1.4)
4. **`min-h-12` / `min-h-14` na všech tap targets** + acceptance #11 (§2.4)

### Silně doporučené
5. **`MANAGER_TOKENS` design token namespace** (§5)
6. **TypingDots** vlastní mikro-komponenta (§2.2)
7. **Bottom-nav layout A** s safe-area padding (§3, navazuje na Lead §2.4)
8. **Empty states pro Tab 2/3/4** (§6)
9. **Acceptance #10-#19** přidat do spec §Acceptance (§7)

### Polish (lze v2)
10. **Confirm modal pattern** pro destruktivní actions (§2.3) — implementovat při D fázi
11. **Reduce-motion fallbacks** auditovat (§4.5)
12. **`product_grid compact` variant** v ProductCard — Bolt task při fázi 3 (§5)

---

## 9. NÁVRH IMPLEMENTAČNÍCH TASKŮ J22-J28 (návaznost po obou review)

Lead emit po sloučení. Mé doporučení rozpadu:

| Task | Agent | Co |
|---|---|---|
| **J22** | Bolt | DB schema (ManagerThread+ManagerThreadMessage) + Turso migrace + Prisma generate |
| **J23** | Bolt | `manager-tabs.tsx` shell + hash routing + role-based visibility + relocate Tabs 2/3/4 (Lead phase 1b+1c) |
| **J24** | Bolt | `manager-thread-blocks.ts` + Zod schemas + 7 block types s renderery |
| **J25** | Bolt | `conversation-tab.tsx` + `thread-input.tsx` + `thread-card.tsx` + `awaiting-user-card.tsx` + `typing-dots.tsx` |
| **J26** | Bolt | `manager_thread_runner.py` worker + heavy-query detection (Lead §1.3) + cost tracking + cap |
| **J27** | Sage | Visual polish: state token pass, banner styling, mobile bottom-nav, empty states, contrast audit, reduce-motion |
| **J28** | Trace | E2E tests: ask-and-answer, awaiting_user response, mobile tab switch, banner reactivity, optimistic action rollback |

J27 (Sage) **musí přijít po J25** ale **před J28** — vizuální polish na hotových komponentách, ale před QA freeze.

---

## 10. ZÁVĚR

Spec je vizuálně rozumný, ale chybí mu **disciplína v reuse existujícího design systému**. Pink je brand accent (J14) → musí mít striktní pravidla použití. State tinting → reuse `MOOD_TINT` paletu z `artifact-card.tsx`. Mobile → bottom-nav (Lead).

Po zapracování tohoto reviewu + Lead reviewu je spec **ready for J22 implementační kickoff**. Žádné další review kolo nepotřeba — Bolt může začít na J22 (DB) hned po sloučení obou reviewů do master spec verze (úkol pro Lead nebo bectly).

---

*Review hotov · J22-J28 mohou ihned navázat.*
