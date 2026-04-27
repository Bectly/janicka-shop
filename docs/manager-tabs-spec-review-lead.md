# Manager Tabs Spec — Lead Strategic Review

**Reviewer**: Lead (J20-REVIEW-LEAD)
**Date**: 2026-04-27
**Spec**: `docs/manager-tabs-spec.md`
**Status**: REVIEW COMPLETE — changes recommended before implementation

---

## TL;DR

Spec je solidní základ. 4 změny jsou nutné před implementací, 3 jsou silně doporučené, 2 jsou volitelné. Phasing má chybu v pořadí — opravuji níže.

---

## 1. STRATEGY

### 1.1 Tab split — SPRÁVNĚ, ale jedna past

Konverzace/Úkoly/Reporty/Session je správné rozdělení. Jenže: když manažerka odpoví na dotaz "Přidej slevu" vytvořením tasku, ten task se zobrazí v **obou** tabech (Konverzace = thread odpověď + Úkoly = task karta). Janička to uvidí dvakrát a bude zmateně klikat.

**Oprava (nutná):** V Konverzaci zobrazit pouze kompaktní "task-spawned" inlinový chip (📋 Vytvořen úkol: "Sleva -25% · zobrazit →") bez duplikace obsahu. Kanban v Úkolech je kanonický zdroj pravdy.

```diff
// thread-card.tsx
- Render ManagerTask cards inline in thread answer
+ Render <TaskSpawnedChip taskId="..." title="..." /> with link to Úkoly tab
```

### 1.2 Block types — 6 nestačí

**Chybí `product_grid`** — Janička se zeptá "co se nejhůř prodává?" nebo "ukaž mi co stojí přes 500 Kč" a přirozená odpověď je grid produktových karet, ne textový seznam. ASCII tabulka je špatná UX.

**Nadbytečný `code`** — Janička není developer, tento block nikdy nepoužije. Obsadí místo v type union beze smyslu.

**Oprava (doporučená):**

```diff
// src/lib/manager-thread-blocks.ts
- Block types: text | chart | image | actions | poll | table | code
+ Block types: text | chart | image | actions | poll | table | product_grid
```

`product_grid` = `{ products: [{ id, title, price, imageUrl, condition, daysOnSale }], caption? }`. Renderer reuse `<ProductCard>` existující komponentu.

`comparison` (dvě kategorie side-by-side) odložit na v2 — table block to pokryje prozatím.

### 1.3 Sonnet 4.6 + ≤2k tokens — NEDOSTATEČNÉ pro strategické dotazy

Pro rutinní otázky (cena, stav skladu, "prodávám tuhle velikost?") je Sonnet 4.6 + 2k správná volba — rychlé, levné.

Pro dotazy vyžadující cross-referenci více datových zdrojů ("jak jde sortiment vs zákaznická segmentace?", "co koupit na příští balík?") 2k kontext nestačí na injektování DB summary + produktové statistiky.

**Oprava (nutná):**

```diff
// services/manager_thread_runner.py
+ HEAVY_QUERY_KEYWORDS = ["analýza", "srovnání", "strategie", "forecast", "doporučení na nákup", "co koupit"]
+ 
+ def is_heavy_query(text: str) -> bool:
+     return any(k in text.lower() for k in HEAVY_QUERY_KEYWORDS)
+
- model = "claude-sonnet-4-6"
- max_tokens = 2000
+ model = "claude-opus-4-7" if is_heavy_query(user_message) else "claude-sonnet-4-6"
+ max_tokens = 4000 if is_heavy_query(user_message) else 2000
```

Target cost: $0.02/rutinní odpověď, ~$0.15/strategická odpověď. Realita: Janička pošle 3-8 zpráv/den, z toho 1-2 strategické. Denní náklady ~$0.15-0.40 vs $0.06-0.16 pro Sonnet-only.

---

## 2. UX FLOW

### 2.1 Default tab Konverzace — SPRÁVNĚ

Janička otvírá stránku proto, aby viděla co manažerka odpověděla. Default Konverzace = správně.

**Ale:** badge na Úkoly tab musí pulse animovat pokud jsou tam nové/urgentní tasky. Samotný šedý "5" count nestačí.

```diff
// manager-tabs.tsx
- <TabsTrigger>📋 Úkoly {count}</TabsTrigger>
+ <TabsTrigger className={hasUrgentTasks ? "animate-pulse text-pink-600" : ""}>
+   📋 Úkoly {count}
+ </TabsTrigger>
```

### 2.2 "Manažerka se ptá tebe" — ŠPATNĚ umístěné

Spec umísťuje awaiting_user kartu **uvnitř Konverzace tabu** jako top-pinned sekci. Problém: Janička je na tabu Úkoly a nevidí notifikaci.

**Oprava (nutná):** Přidat sticky cross-tab banner **nad taby**, ne uvnitř jednoho tabu.

```
┌─ /admin/manager ─────────────────────────────────────┐
│                                                        │
│ 🔔 Manažerka čeká na tvou odpověď — [Odpovědět →]    │  ← sticky, nad taby
│ ─────────────────────────────────────────────────────  │
│ [ 💬 Konverzace 2🔴 ][ 📋 Úkoly 5 ][ 📊 Reporty ][ ⚙️ ]│  ← taby pod bannerem
│                                                        │
│ (active tab content)                                   │
└────────────────────────────────────────────────────────┘
```

Banner je podmíněný: zobrazí se jen pokud existuje `awaiting_user` thread. Klik scrolluje dolů na kartu v Konverzaci.

Inline awaiting_user karta v Konverzaci **zůstává** — banner je jen navigační shortcut.

### 2.3 awaiting_user tlačítka — SKORO SPRÁVNĚ

Spec říká 2-3 options + "Něco jiného". Správný přístup. Jedná se drobná upřesnění:

- Počet options: **2-5 dynamicky** (ne pevné 2-3) — manažerka generuje options dle kontextu
- "Něco jiného" VŽDY jako poslední button → otevírá free-text field inline (ne nová stránka)
- Free-text field se zobrazí inline pod buttons, ne místo nich — Janička vidí kontext při psaní

**Tato změna je volitelná** — spec je akceptovatelný i bez ní.

### 2.4 Mobile: tabs vs bottom-nav-bar — SPEC MÁ CHYBU

Spec říká "tabs jako horizontal scroll OR bottom-tab-bar style na `<sm:`". Horizontal scroll tabs na mobilu jsou špatná volba pro navigaci — palec musí cestovat na vrchol displeje (dead zone).

**Oprava (silně doporučená):**

```
Desktop (md:+):     [ 💬 Konverzace ][ 📋 Úkoly ][ 📊 Reporty ][ ⚙️ Session ]
                    (top horizontal tabs, současný návrh)

Mobile (<md:):      [ obsah tabu ]
                    ─────────────────────────────────
                    [ 💬 ]  [ 📋 ]  [ 📊 ]  [ ⚙️ ]    ← fixed bottom nav, 4 items
```

Implementace: Shadcn `<Tabs>` s custom trigger slot positioned `fixed bottom-0` na mobile, `static top` na desktop. 4 items = ideální počet pro bottom nav (Apple HIG doporučuje max 5).

```diff
// manager-tabs.tsx
- <TabsList className="mb-4">
+ <TabsList className="
+   hidden md:flex mb-4 {/* desktop top tabs */}
+   md:hidden fixed bottom-0 left-0 right-0 h-16 border-t bg-white z-50 {/* mobile bottom nav */}
+ ">
```

> ⚠️ Tato změna vyžaduje více CSS práce, ale výrazně zlepšuje mobilní UX. Pokud Janička primárně používá admin z mobilu (pravděpodobné), je tato změna **nutná**.

---

## 3. BUSINESS LOGIC

### 3.1 Cost cap $5/den — MASIVNÍ OVERSHOOT

Při $0.02/odpověď Sonnet + $0.15/odpověď Opus:
- $5/den = 250 rutinních dotazů nebo 33 strategických
- Janička reálně pošle **3-10 dotazů/den**

$5/den je 25-83× víc než potřeba. Nastavit na:

| Limit | Hodnota | Důvod |
|---|---|---|
| Soft warning | $1/den | Dashboard bectly zobrazí varování |
| Hard cap | $3/den | Worker odmítne nové thready, Janička dostane "Zkus zítra" |
| Cost per answer (zobrazeno v Session tab) | realtime | Transparentnost |

Ušetří to cca $1.460/rok oproti $5/den cap bez reálné ztráty funkcionality.

### 3.2 Auto-archive 30 dní — OK, ale nutný 7d collapse

30 dní archiv je správně. Ale bez mezikroku bude feed po 2 týdnech nepřehledný.

**Přidat:** Answered thready se **auto-collapsují** (zobrazí jen subject + datum) po 7 dnech. Klik = expand. Archive = 30 dní. Toto není v aktuálním spec.

```diff
// thread-card.tsx
+ const isAutoCollapsed = thread.answeredAt
+   && daysSince(thread.answeredAt) > 7
+   && thread.status !== 'awaiting_user'
+ 
+ if (isAutoCollapsed && !isExpanded) {
+   return <CollapsedThreadRow subject={thread.subject} answeredAt={thread.answeredAt} />
+ }
```

### 3.3 Multi-thread context — BEZPEČNÉ, ale implement správně

Privacy concern je bezvýznamný (shop má jednoho trusted admina). Ale spec říká "last 3 closed threads as few-shot examples" — to je nebezpečné z jiného důvodu: plné message bodies mohou obsahovat konkrétní čísla (ceny, zásoby), která worker bude citovat jako "fakta" v nových odpovědích, i když jsou zastaralá.

**Oprava (nutná):**

```diff
// services/manager_thread_runner.py
- context_threads = get_last_n_closed_threads(project_id, n=3)
- # inject full messages as examples
+ context_threads = get_last_n_closed_threads(project_id, n=3)
+ # inject ONLY subject + first 200 chars of manager response (not user message, not full answer)
+ few_shot_examples = [
+   {"subject": t.subject, "answer_preview": t.manager_answer[:200]}
+   for t in context_threads
+ ]
```

Tím se zachová tone consistency (účel few-shot examples) bez rizika citování zastaralých dat.

---

## 4. PHASING — POŘADÍ OPRAVIT

### Aktuální pořadí (A→G):
A(schema) → B(tab shell) → C(konverzace tab) → D(block renderer) → E(notifs) → F(přesun existujících sekcí) → G(empty states)

### Problémy:
1. **A+B mají nulovou dependenci** — mohou běžet paralelně
2. **F by mělo přijít PŘED C** — nejdřív přesuň existující sekce do tabů (cosmetic, nulové riziko regresi), pak buduj nový Konverzace tab. Jinak C implementuješ a F ho narušuje.
3. **G patří vedle E** — oba jsou polish, oba paralelizovatelné

### Opravené phasing:

| Fáze | Co | Velikost | Dependence | MVP? |
|---|---|---|---|---|
| **1a** (parallel) | DB schema + Prisma migration + ManagerThread models | M | — | základ |
| **1b** (parallel) | Tab UI shell + hash routing + role visibility | S | — | základ |
| **1c** (parallel) | Přesunout existující sekce do Tabs 2/3/4 | S | 1b | ← **MVP 1 shippable** |
| **2** | Konverzace tab — input + thread feed + status badges | M | 1a + 1b | — |
| **3** | Block renderer (text/chart/image/actions/poll/table + **product_grid**) | M | 2 | ← **MVP 2 shippable** |
| **4a** (parallel) | Notifications — sticky banner + bell badge + revalidation | S | 2 | polish |
| **4b** (parallel) | Empty states + onboarding hints + mobile QA + **bottom-nav mobile** | S | 3 | polish |
| **4c** (parallel) | manager_thread_runner.py worker deploy | S | 3 | produkce |

**MVP 1** = tabs existují, všechny existující funkce fungují v tabech. Janička může navigovat. Žádná nová funkcionalita.

**MVP 2** = Janička se může ptát a manažerka odpovídá s plným block renderingem. Toto je první verze s reálnou hodnotou pro Janički.

---

## 5. OTEVŘENÉ OTÁZKY — ZODPOVĚZENÉ

| Otázka | Rozhodnutí | Důvod |
|---|---|---|
| Block schema: locked 6 vs extensible registry? | **Locked 7** (přidat product_grid, odebrat code) | Type safety + menší surface pro chyby. Registry přidat v v2 pokud potřeba. |
| awaiting_user: buttons-only vs rich text? | **Oboje** — buttons + "Něco jiného" vždy přítomno | Spec to říká správně; přidat dynamic count 2-5 |
| Thread expiry: auto-archive 30d + manual close? | **Auto-collapse 7d + auto-archive 30d + manual reopen** | Bez 7d collapse bude feed brzy nepřehledný |
| Image upload: sdílet R2 bucket s ManagerSession? | **Ano**, `manager-uploads/` folder | Jednoduchší, žádné extra konfigurace |
| Multi-thread context: zobrazit předchozí thready? | **Ano, ale pouze subject + answer preview** (200 chars) | Tone consistency bez rizika citování stale dat |
| Cost cap: $/den nebo počet threadů? | **$1/den soft + $3/den hard**, zobrazit realtime cost v Session tab | Správná výška pro reálný use case |

---

## 6. SOUHRN ZMĚN DO SPECIFIKACE

### Nutné před implementací:
1. **Task-spawn chip** v Konverzaci místo duplikace task karet (§1.1)
2. **product_grid block type** místo code (§1.2)
3. **Heavy query detection** → Opus fallback v workeru (§1.3)
4. **Cross-tab sticky banner** pro awaiting_user (§2.2)
5. **Multi-thread context** = subject + preview only, ne plná messages (§3.3)
6. **Opravit phasing pořadí** (§4)

### Silně doporučené:
7. **Mobile bottom nav** na `<md:` breakpointu místo horizontal scroll tabs (§2.4)
8. **7-day auto-collapse** answered threadů (§3.2)
9. **Cost cap** $1/soft + $3/hard místo $5 (§3.1)

### Volitelné (v2):
10. **awaiting_user dynamic button count** 2-5 (§2.3)
11. **Pulse animation** na Úkoly tab badge pro urgentní tasky (§2.1)

---

## 7. SOUBORY K EDITACI VE SPEC

Spec `docs/manager-tabs-spec.md` je jinak výborně strukturovaný. Doporučuji bectly nebo Sageovi zapracovat tyto diff body do spec před tím, než Bolt začne implementovat:

- L112: přidat `product_grid` do block types, odebrat `code`
- L247-249: přidat heavy-query detection do worker sekce
- L258-259: změnit na `sticky cross-tab banner + inline card`  
- L265-266: $1/$3 místo nespecifikovaného soft warning + hard cap
- L267-269: phasing tabulka nahradit opravenou verzí (§4 výše)
- Přidat novou sekci "Thread auto-collapse" před L289

---

*Review hotov — J21 (Sage UX deep-review) může bezešvě navázat na tuto analýzu.*
