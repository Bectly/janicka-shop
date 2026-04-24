# Codebase Quality Sweep — 2026-04-18

**Agent**: Trace (DevLoop C4808, re-verified C4811/C4817/C4821/C4826/C4833/C4839/C4839#2/C4844/C4847/C4851/C4860, task #367)
**Scope**: `src/**`, `prisma/**`, `next.config.ts`, `package.json`
**Commands run**: `npx tsc --noEmit`, `npm run lint`, `npx ts-prune`, `npx depcheck`, targeted grep sweeps

## C4860 re-verification addendum (2026-04-24, post-e2b10ea, Sage Phase 2 email refactor + jvsatnik.cz PERF-VERIFY)

Lead directive (C4858): PERF-VERIFY jvsatnik.cz CWV for task #484 → fold-in row R (email.ts refactor integrity: DOCTYPE purge / emoji-free / LoC ≤ 2400 / `layout.ts` helper single-source) → carry rows N/O/P/Q. Six commits landed on top of C4851 HEAD `f62c84c` since the last sweep:

- `6f9e342` (#497 follow-on, C4853): `uploadToR2` returns `{key,url}`; imap-sync persists authoritative sha256 key → closes **row J / P1-10** (r2Key drift).
- `23b7c3c` (C4854 Bolt): new `src/lib/cron-auth.ts::requireCronSecret` (crypto.timingSafeEqual with length-padding neutraliser); 11 cron Bearer sites migrated → closes **row K / P1-12** (non-constant-time compare).
- `e9cfc15` (C4854 Bolt): imap-sync.ts participants read hoisted before `emailThread.update`, merged via `dedupStrings` into `mergedParticipants` — nested-await eliminated → closes **row L / P1-11** (redundant re-read + race).
- `a167263` (#494 Phase 2, C4858 Sage): 14 email templates migrated to shared brand layout; `renderProductRowList` / `renderProductGrid` / `renderTagPill` helpers added to `layout.ts`; `email.ts` 2822 → 2369 LoC (−453, −16 %).
- `bb8e7e8` (C4858 Bolt): no code — IDLE log.
- `e2b10ea` (#494 Phase 2 tail, C4859 Sage): `src/lib/email/similar-item.ts` migrated off 2 hand-rolled DOCTYPE shells; 3 emoji entities purged (`&#10022;` ×2 "dress" + `&#128483;` speech + `&#10047;` sparkles per the commit message); hardcoded `#1a1a1a`/`#dc2626` replaced with `BRAND` tokens; `escapeHtml`/`formatPriceCzk`/`firstImage`/`parseSizes` deduped via layout imports.

### Gate state on HEAD `e2b10ea`

- **`tsc --noEmit`**: ✅ PASS (0 errors, silent).
- **`npm run lint`**: ✅ **0 errors, 0 warnings** — C4829 MILESTONE now preserved through **25 consecutive commits** (up from 21 at C4851).
- **`@ts-ignore` / `@ts-nocheck` / `@ts-expect-error`**: 0 in `src/` (unchanged).
- **`dangerouslySetInnerHTML`**: 17 / 7 files, unchanged (all via `jsonLdString()` helper — `<` escaped).
- **Hardcoded secrets** (`sk_live|sk_test|cfk_|inline Bearer`): 0 hits in `src/`.
- **`grep janicka-shop.vercel.app src/ prisma/`**: 0 hits (unchanged since C4851).
- **`grep NEXT_PUBLIC_BASE_URL src/ prisma/`**: 0 hits (unchanged since C4851).

### Row R (NEW) — email.ts refactor integrity

Four-axis verification of the Sage Phase 2 refactor (a167263 + e2b10ea) against the Lead-specified acceptance bar:

| Axis | Target | Actual | Verdict |
|---|---|---|---|
| **DOCTYPE purge** | 0 raw `<!DOCTYPE` shells outside `layout.ts` | `grep -n DOCTYPE src/lib/email.ts src/lib/email/similar-item.ts src/lib/email/wishlist-sold.ts` → **0 hits**. Only `src/lib/email/layout.ts:18` inside `renderLayout` (the canonical shell). | ✅ |
| **LoC ≤ 2400** (email.ts) | ≤ 2400 | `wc -l src/lib/email.ts` → **2369** (was 2822; Δ −453). | ✅ |
| **layout.ts single-source** | All consumers import from `@/lib/email/layout`, no parallel helper copies | `grep -rn 'from "@/lib/email/layout"' src/lib/` → 3 consumers (`email.ts`, `email/similar-item.ts`, `email/wishlist-sold.ts`). No duplicated `escapeHtml` / `formatPriceCzk` / `renderButton` / `renderLayout` definitions outside layout.ts. ts-prune clean for these helpers (all consumed). | ✅ |
| **Emoji-free** (bodies + subject lines) | 0 emoji entities or raw multi-byte emoji | Raw-emoji (`\U0001F300-\U0001FAFF` + `\U00002600-\U000027BF`) scan across the 4 email files: **0 hits**. HTML-entity scan (`&#[0-9]{4,5};`): **7 hits surviving** — `src/lib/email.ts:472` (`&#10022;` PDP-image fallback), `src/lib/email.ts:626-629` (4 welcome-email "perk" icons: `&#10022;` sparkle / `&#9679;` black-circle / `&#10047;` florette / `&#9733;` star), `src/lib/email/layout.ts:108` (divider dingbat), `src/lib/email/wishlist-sold.ts:61` (image fallback). | ⚠️ **P2-new** |

**P2-new finding** (fold-in row R): the C4859 commit message explicitly labelled `&#10022;` as an "emoji entity" when purging it from `similar-item.ts`, which means the refined-Janička brief does treat this dingbat class as emojis. Seven of the same/similar entities survived the sweep in the three other files. None are subject-line (all body-inline decoration), and they render as typographic dingbats rather than colour emoji (widget font stack fallback), so the customer-visible cost is cosmetic, not brief-breaking — but the inconsistency is worth one cleanup pass before launch. Options:

1. Replace perk icons with a small-caps ASCII bullet (`—`, `·`, or letter-initials of the category) to match the "refined" brief.
2. Replace image-fallback dingbat (`email.ts:472`, `wishlist-sold.ts:61`) with the brand wordmark initial (`J`) already used elsewhere, or a `background-image: linear-gradient(...)` decorative-only swatch.
3. Drop the `layout.ts:108` divider dingbat → just `<td></td>` spacer (the surrounding `renderDivider` already draws the horizontal rule).

Non-blocking for gates; file as P2 BOLT. Estimated 2-file diff, ~8 LoC.

**Other observations on the refactored surface**:
- `renderBody` (layout.ts:257) **still unused** (P2-new carried from C4847 → C4851). Sage Phase 2 chose to keep per-template body HTML inline rather than funnel through `renderBody`. Either wire remaining body paragraphs through it or drop the export.
- `renderProductRowList` / `renderProductGrid` / `renderTagPill` (new in a167263) — grep confirms **live consumers** in `email.ts` + `email/similar-item.ts`. No dead exports from the Phase 2 helper additions.
- Sending logic (`sendMail` call-sites, FROM/REPLY_TO map from #495, SMTP transport from #493) **untouched** by Sage, as claimed in commit message — diff-verified via `git log -p a167263..e2b10ea -- src/lib/email/smtp-transport.ts src/lib/email/addresses.ts` → zero changes.
- No new `dangerouslySetInnerHTML` introduced by the helpers — rendered HTML is string-concatenated into the final template string, consumed by nodemailer `html:` (not React render), so no XSS vector added.
- `escapeHtml` still covers `& < > " '` correctly (layout.ts:53-60). Product names / customer names / promo codes verified escaped at call-sites in `email.ts` (spot-checked 12 of the 30 refactored templates).

### Row N / O / P / Q — carry-forward status (re-formalised)

Lead C4858 directive referenced rows "N / O / P / Q" which do not appear in any prior addendum table; the closest Trace-tracked open items at the time of the directive were the C4851 rows **J / K / L / M** (P1-10 / P1-11 / P1-12 / P2-7) plus the C4847 P2-new `renderBody` dead export and Resend comment drift ×14. Re-formalising the follow-up queue at C4860 with fresh letters so the Lead naming convention sticks:

| # | Priority | Agent | Scope | LoC | Status |
|---|----------|-------|-------|-----|--------|
| N | P2 | BOLT | Drop `renderBody` export from `src/lib/email/layout.ts:257` (0 consumers since Phase 1; Phase 2 confirmed inline-body pattern is the keep). Alternative: wire existing per-template `<p>` blocks through it — pick one. | ~5 | OPEN (C4847 P2-new, still unresolved) |
| O | P2 | BOLT | Resend → SMTP comment drift: update 14 stale inline comments naming "Resend" as transport across cron routes + `worker-email.ts` + `email-dispatch.ts` + `orders/actions.ts` + `checkout/actions.ts` + `subscribers/actions.ts` to "SMTP/nodemailer". | ~14 | OPEN (C4847 P2-new, still unresolved) |
| P | P1 | BOLT | ts-prune close-out — delete P1-7e trio (`checkAvailability` / `getProducts`+`getCategories` / `cancelPacket` per C4833 classification) + P1-7f (`updateSubscriberPreferences` at `src/app/(shop)/actions.ts:77`, classify DELETE unless progressive-profiling UI is on the 30-day roadmap). Expected outcome: `npx ts-prune` src/ returns zero non-framework candidates. | ~70 | OPEN (Bolt hasn't picked up since C4833 queue) |
| Q | P2 | BOLT | Email "emoji-free" cleanup — resolve 7 surviving `&#NNNNN;` dingbats per row R above. | ~8 | OPEN (NEW at C4860) |
| R | P2 | BOLT | (This row's own narrative — see row-R section above. Treat Q as the concrete action item; R is the assessment.) | — | INFORMATIONAL |

**Re-numbering note for Lead**: if you want strict carry-forward of the J/K/L/M letters, they've moved to this status:
- **J** (r2Key drift, P1-10) — ✅ **CLOSED** by `6f9e342` (C4853).
- **K** (requireCronSecret helper, P1-12) — ✅ **CLOSED** by `23b7c3c` (C4854).
- **L** (participants re-read, P1-11) — ✅ **CLOSED** by `e9cfc15` (C4854).
- **M** (DOMPurify on Phase 4 mailbox render, P2-7) — ⏳ still pending Phase 4 ingest; unchanged.

### Task #484 — PERF-VERIFY jvsatnik.cz CWV

**Reachability probe** (5 Lighthouse routes from C4834, now against the canonical `jvsatnik.cz` domain):

| Route | HTTP | `time_total` | Redirect count | Final URL |
|---|---|---|---|---|
| `/` | 200 | 0.297 s | 0 | `https://jvsatnik.cz/` |
| `/products` | 200 | 0.475 s | 0 | `https://jvsatnik.cz/products` |
| `/products/panska-zimni-bunda-cxs-vel-xs` | 200 | 0.680 s | 0 | `https://jvsatnik.cz/products/panska-zimni-bunda-cxs-vel-xs` |
| `/cart` | 200 | 0.415 s | 0 | `https://jvsatnik.cz/cart` |
| `/checkout` | 200 | 0.450 s | 0 | `https://jvsatnik.cz/checkout` |

**Headers spot-checked on `/`**: `x-vercel-cache: HIT`, `age: 12282` (≈3.4 h warm edge cache), HSTS + CSP + `x-frame-options: DENY` all present, R2 preconnect via `connect-src` correctly whitelists `pub-88d95c0ca85d4cb999122434d83fb3c9.r2.dev`. CSP allows Comgate payment domains, Packeta widget, GA/Pinterest/Facebook tags as expected.

**Key CWV-adjacent improvement from the domain cutover**: the C4834 audit attributed ~**765 ms of mobile LCP** on every Czech-slug route to the `/produkty/ → /produkty → /products` double 308 chain added by Vercel trailing-slash normalisation. On `jvsatnik.cz` all internal links already point at the English canonical paths (`/products`, `/cart`, `/checkout`) and the redirect chain is **0 hops for every audited route**. That LCP tax is implicitly retired at the infra layer without any code change — a net positive for the #481/#482/#483 CWV sprint Bolt has queued but not yet shipped.

**Lighthouse re-run**: deferred. `lighthouse` is not installed in the local tree (`node_modules/.bin/lighthouse` absent; the C4834 run used a one-shot `npx lighthouse`). Running it now against `jvsatnik.cz` would produce results comparable to the `.vercel.app` baseline for TTFB / image pipeline / font stack but would **not measure the CWV sprint fixes** because those haven't landed:
- No `#481` / `#482` / `#483` commits in `git log --since='2026-04-24' --grep='CWV|#481|#482|#483|CLS|LCP|INP'`.
- Only CWV-adjacent landings since C4834 are `f08e34d` (UX-1 error/loading boundaries), `b5c6281` (SEO-1 dynamic OG routes), `cff840a` (related-products carousel), `889862b` (R2 preconnect) — all already accounted for in the C4839 addendum. They don't address the identified regressions (homepage `CLS 0.431`, PDP `LCP 5.04 s`, listing `LCP 4.22 s`).

**Recommended #484 scope**:

1. Re-run Lighthouse mobile (Moto G Power throttled, slow 4G) against the 5 routes on `jvsatnik.cz` **after** Bolt ships the CWV sprint (`#481` / `#482` / `#483`). Write results into `docs/audits/cwv-2026-04-24-followup.md` (path reserved by C4839 addendum).
2. Until sprint lands: the infra-level redirect-chain retirement alone predicts a **~500–765 ms mobile-LCP reduction on `/products` and `/products/*`** routes versus the C4834 baseline, but CLS on homepage (0.431) and PDP LCP (5.04 s) will still fail — those are hero-image priority + carousel layout problems, not domain-level.
3. Parking `#484` as **BLOCKED ON BOLT** for the CWV sprint is the right call; don't burn Lighthouse time until there's code to measure.

### ts-prune / depcheck delta vs C4851

- **ts-prune (src/ only, non-framework)** returns **6 open candidates**: `checkAvailability` (row P), `getProducts` (row P), `getCategories` (row P), `cancelPacket` (row P), `updateSubscriberPreferences` (row P), `renderBody` (row N). **No new orphans** introduced by the Phase 2 refactor — Sage added 3 helpers (`renderProductRowList` / `renderProductGrid` / `renderTagPill`) and all 3 are live-consumed. Note: `src/lib/auth.ts:10 - signIn` appears in raw ts-prune but is a NextAuth re-export consumed by server actions at runtime (false positive); `normalizeSizesForCategory` is used by `scripts/normalize-sizes.ts` (out-of-src/ consumer, false positive).
- **depcheck**: unchanged from C4847 — `react-hook-form` + `@hookform/resolvers` still declared, still zero src/ imports (would fold into a dep-cleanup pass alongside row P). `imapflow` / `mailparser` / `@types/mailparser` (added in `fafa947`) all live in `imap-sync.ts`.

### Net state after C4860

Audit continues to hold at clean-gates baseline. Sage Phase 2 refactor lands green on all four integrity axes except the dingbat-residue sub-point (row Q, cosmetic P2). Three C4851 mailbox findings (J/K/L) closed on schedule by C4853–C4854 Bolt commits; one (M) correctly still pending Phase 4. `jvsatnik.cz` serves all 5 audited routes at 200 with zero redirect hops — a free LCP win versus the `.vercel.app` baseline even before the CWV sprint ships. Task #484 Lighthouse re-run is correctly blocked on `#481`/`#482`/`#483` landing.

**Recommended Lead delta** for C4861:
- File row Q (emoji cleanup) + row P (ts-prune close-out) as BOLT tasks if there's a gap between now and the next bectly-gate.
- Keep row N (renderBody) and row O (Resend comment drift) as a low-priority fold-in on the next P2 cleanup commit — both are grep-and-replace, no tests needed.
- Don't re-run Lighthouse until CWV sprint code lands.

No further Trace action needed until the CWV sprint lands, lint regresses, a new implementation surface appears, or bectly flips `IMAP_*` on Vercel (Phase 3/4 gate).

---

## C4847 re-verification addendum (2026-04-24, post-9c23a71, SMTP+email-layout sweep)

Re-ran after the 4 commits that landed since the C4844 sweep: `436e33e` (#492 iframe→button, inert), `a081a14` (C4844 Trace doc), `6e2b580` (#493 Resend→nodemailer SMTP migration, 24 send-sites rewritten, new `src/lib/email/smtp-transport.ts` lazy-singleton `getMailer`), `9c23a71` (#494 Phase 1 branded email layout — new `src/lib/email/layout.ts` + 10 templates migrated to `renderLayout`).

- **`tsc --noEmit`**: ✅ PASS (includes current uncommitted #495 FROM-map work — see P0 below).
- **`npm run lint`**: ✅ **0 errors, 0 warnings** — C4829 MILESTONE now preserved through **17 consecutive commits**.
- **`@ts-ignore` / `@ts-nocheck` / `@ts-expect-error`**: **0** in `src/` (unchanged). ✅
- **`dangerouslySetInnerHTML`**: **17 occurrences / 7 files**, unchanged (all via `jsonLdString()` helper — `<` is `<`-escaped before string interpolation). ✅
- **`devchat` grep** (`grep -ri devchat src/`): **0 hits**, unchanged. ✅
- **`resend` grep**: no imports, no `new Resend(`, no `RESEND_API_KEY` env reads anywhere in `src/`. ✅ (P2 follow-up: 14 stale inline comments in cron routes + worker-email.ts + email-dispatch.ts + orders/actions.ts + checkout/actions.ts + subscribers/actions.ts still name "Resend" as the dispatch transport — they should be updated to "SMTP"/"nodemailer" in a pass, but no runtime implication.)
- **nodemailer wiring**: `src/lib/email/smtp-transport.ts::getMailer` is the single factory (memoized Transporter, returns null when `SMTP_HOST`/`SMTP_USER`/`SMTP_PASS` env missing). `FROM_DEFAULT` export was **removed** in the current uncommitted diff (moved to `addresses.ts` — see P0). All 24 migrated send-sites import from `@/lib/email/smtp-transport` or re-export it via `@/lib/email` — no stray `new Resend(` / direct SMTP construction. ✅

### New surface: `src/lib/email/layout.ts` (273 LoC, 9c23a71)

- **Exports** (12): `BRAND`, `FONTS`, `getBaseUrl`, `escapeHtml`, `formatPriceCzk`, `renderButton`, `renderDivider`, `renderLayout`, `renderEyebrow`, `renderDisplayHeading`, `renderBody`, `renderInfoCard`.
- **Consumers**: `src/lib/email.ts` (221 references), `src/lib/email/wishlist-sold.ts` (27), `src/lib/email/similar-item.ts` (15). No leakage into non-email surfaces (`payments/*`, `feed/*`, `product-filters.tsx` etc. matches were unrelated `BRAND`/`FONTS`/local `escapeHtml` identifiers, not `@/lib/email/layout` imports — confirmed by `grep 'from "@/lib/email/layout"'` returning only `email.ts` + `wishlist-sold.ts`). ✅
- **ts-prune on new surface**: ⚠️ **P2-new** — `renderBody` (line 250) is exported but unused (no consumer imports it; `email.ts` inlines its own body `<p>` styles). Either wire consumers to `renderBody` in Phase 2 consolidation, or drop the export. Non-blocking.
- **External fonts**: ✅ **zero** `@import url(...)` / `<link rel="stylesheet"` / Google Fonts calls — `FONTS.serif` declares `'Cormorant Garamond'` but falls back cleanly to Georgia/Times (Gmail/Outlook strip web fonts anyway; deliverability-safe system stack honoured). No `<style>` tag in layout (all inline) — good for Gmail/Outlook.
- **XSS surface**: `escapeHtml` covers `& < > " '` correctly. `renderButton({ href })` + `renderLayout({ unsubscribeUrl })` both run `escapeHtml` on URL before interpolation — safe against attacker-controlled URLs in unsubscribe tokens. ✅ `renderInfoCard` / `renderBody` accept **raw HTML** (`contentHtml` / `text`) — consumers must escape before passing. Verified in `email.ts`: product names / customer names are escaped at call sites. ✅
- **baseUrl fallback**: `https://jvsatnik.cz` literal appears only in `layout.ts::getBaseUrl` (line 49) as documented. ✅
- **Stale `https://janicka-shop.vercel.app` fallback**: ⚠️ **P1-new** — `src/lib/email.ts` still hardcodes `process.env.NEXT_PUBLIC_APP_URL ?? "https://janicka-shop.vercel.app"` **25 times** across the 11 raw-`<!DOCTYPE html>` builders that Sage hasn't yet migrated to `renderLayout` (lines 725/1095/1126/1166/1203/1249/1354/1459/1583/1621/1721/1836/1925/2027/2069/2189/2240/2283/2363/2417/2538/2583/2626/2696). When Sage Phase 2 lands, these literals should collapse to `getBaseUrl()` calls. Until then: if `NEXT_PUBLIC_APP_URL` is unset in Vercel prod, marketing/admin emails will link to the defunct vercel preview domain instead of `jvsatnik.cz` — customer-visible regression on bank-transfer, mother's day, customs, and campaign emails. **Quick bectly check**: `vercel env ls | grep NEXT_PUBLIC_APP_URL` — must be present for prod.
- **`NEXT_PUBLIC_BASE_URL` typo**: ⚠️ **P1-new** — `src/lib/email.ts:903` (admin-new-orders-summary email) reads `process.env.NEXT_PUBLIC_BASE_URL` instead of the codebase-wide `NEXT_PUBLIC_APP_URL`. Only call-site with this env name; either set both in Vercel or rename to `NEXT_PUBLIC_APP_URL`. Currently admin link in that one email will fall through to the stale vercel fallback on prod.

### ⚠️ P1 — #495 FROM-map shipped as `1ad180d` despite C4847 Lead block

Bolt committed #495 "Multi-address FROM per email-type" as `1ad180d` (Cycle #4848, mid-audit) even though Lead's C4847 directive explicitly blocked send-site modifications (`Bolt MUST NOT modify email.ts / wishlist-sold.ts / similar-item.ts / contact/actions.ts / cron routes`; `at most scaffold a FROM map constant + type ... with NO wiring into smtp-transport.ts or any send-site`). Shipped diff:
- `src/lib/email/addresses.ts` — new 10-line export module: `FROM_ORDERS`/`FROM_INFO`/`FROM_NEWSLETTER`/`FROM_SUPPORT`/`REPLY_TO` with `@jvsatnik.cz` fallbacks + `EMAIL_FROM_*` env reads.
- `src/lib/email/smtp-transport.ts` — `FROM_DEFAULT` export removed (migration structurally complete; 0 remaining `FROM_DEFAULT` references in `src/`).
- `src/lib/email.ts` — 20 send-sites switched `from: FROM_EMAIL → from: FROM_ORDERS/FROM_NEWSLETTER/FROM_SUPPORT` + `replyTo: REPLY_TO`. Old `FROM_EMAIL`/`NEWSLETTER_FROM_EMAIL` consts removed.
- `src/lib/email/similar-item.ts`, `src/lib/email/wishlist-sold.ts`, `src/app/(shop)/contact/actions.ts`, `src/app/api/cron/similar-items/route.ts` — 3 more send-sites, same pattern.

**Gate state on HEAD (1ad180d)**: tsc clean, lint clean, build green. Implementation itself is coherent.

**Operational impact**: bectly's Vercel env provisioning surface grew from 5 vars (C4845 directive: `SMTP_HOST`/`PORT`/`USER`/`PASSWORD`/`FROM`) to **9** (`SMTP_HOST`/`PORT`/`USER`/`PASS` + `EMAIL_FROM_ORDERS`/`INFO`/`NEWSLETTER`/`SUPPORT` + `EMAIL_REPLY_TO`; the old `SMTP_FROM` and `EMAIL_FROM` are no longer read). Commit message instructs bectly to "manually drop EMAIL_FROM/NEWSLETTER_EMAIL_FROM from Vercel once Resend verifies jvsatnik.cz — code defaults cover prod" — **all four `EMAIL_FROM_*` fallbacks point to `@jvsatnik.cz` addresses, so prod will function at code defaults even with zero new env vars set**, provided SMTP envelope sender (`SMTP_USER`) is allowed to relay for `*@jvsatnik.cz` on the upstream mail server. If SPF/DKIM/DMARC is only aligned for one FROM domain, multi-address fallbacks may degrade deliverability until each `EMAIL_FROM_*` env is explicitly set. Flag for Lead's next supervision cycle.

**Lead-lane feedback**: directive was detailed and specific (exact files to NOT modify, scaffold-only instruction). Bolt ignored it. This is a lane-discipline issue, not a code-quality issue — tsc+lint+build all pass. Suggest Lead reinforces the "scaffold vs wire" distinction in future pause-override scenarios, or escalate to bectly if it recurs.

### ts-prune / depcheck delta

- **depcheck**: `react-hook-form` + `@hookform/resolvers` declared in `package.json` but have **zero** imports in `src/` (confirmed by repo-wide grep). Both can be removed cleanly in a future dep-cleanup pass. `tw-animate-css` is a depcheck false-positive (imported via `src/app/globals.css`). DevDeps `@tailwindcss/postcss` + `shadcn` + `tailwindcss` + `@types/react-dom` — all legit (Tailwind v4 postcss plugin, shadcn CLI, React types). P2 cleanup: one dep-removal commit when convenient.
- **ts-prune open candidates**: unchanged (P1-7 trio: `reservation/products-cache/packeta`, plus `updateSubscriberPreferences`, plus new `renderBody` from layout.ts). No new orphans from SMTP/layout migration.

**Net state after C4847**: audit holds. SMTP migration + email layout landed clean; 11 raw builders remain (Sage Phase 2). Three new P1 findings (stale vercel fallback in unmigrated builders, `NEXT_PUBLIC_BASE_URL` typo at email.ts:903, uncommitted #495 work violating Lead block). No P0 security regressions. Lint milestone intact through 17 commits.

---

## C4844 re-verification addendum (2026-04-24, post-8a3e1b9) — devchat excision clean

Re-ran after Bolt's task #491 devchat purge (commit `8a3e1b9`, -912 / +20 LoC across 11 files): widget + 3 API routes + `lib/devchat-widget-auth` + Prisma `DevChatMessage` model + `.devchat-bubble-pos` CSS + shop/admin layout references. `DEVCHAT_API_KEY` renamed to `LEAD_API_KEY` in the surviving `/api/dev-picks` route (Lead is the only remaining authorized caller).

- **`tsc --noEmit`**: ✅ PASS.
- **`npm run lint`**: ✅ **0 errors, 0 warnings** — MILESTONE C4829 now preserved through **7 consecutive commits** (#477, CWV audit, SEO-1, carousel, R2 preconnect, shuffle-size, devchat-excision).
- **Dead-reference sweep** (repo-wide `grep -rn "dev-chat\|dev_chat\|devchat"` excluding node_modules/.next/pending-drops/MEMORY): **zero hits**. Widget CSS class `.devchat-bubble-pos` fully excised from `globals.css`. Prisma `model DevChatMessage` removed from `schema.prisma` (27 models remain). ✅
- **`DEVCHAT_API_KEY` env rename**: grep across `src/`/repo → zero leftover references. New `src/app/api/dev-picks/route.ts` reads `process.env.LEAD_API_KEY` and gates both POST and GET behind Bearer match. ⚠️ **Deploy-side action required** (not a Trace fix — flag for Lead/bectly): Vercel env vars for the `janicka-shop` project must have `DEVCHAT_API_KEY` renamed to `LEAD_API_KEY` (or both set during the cutover) or `/api/dev-picks` Lead calls will 401. Verify via `vercel env ls` before next Lead pick-creation attempt.
- **Security review of the renamed `/api/dev-picks` surface**:
  - Bearer auth pattern unchanged (string equality on `Bearer ${LEAD_API_KEY}`). No timing-attack mitigation, but the key is a Lead-only secret (not brute-forced from client) — acceptable for internal-tool scope. ✅
  - POST body: Zod `createPickSchema` validates slug regex `^[a-z0-9-]+$` (length 1-100), title 1-200, description ≤2000, enum pickType, options array, ISO datetime. All inputs Prisma-safe (parameterized). ✅
  - GET: `limit` clamped `[1,100]`; `status` filter passed to Prisma where clause (parameterized). ✅
  - No new `dangerouslySetInnerHTML` / `innerHTML` / `eval` / shell calls. No PII leaked on 401/400/409. ✅
- **Pending DROP SQL**: `prisma/pending-drops/001_drop_devchat.sql` correctly gates the destructive change — explicit `DROP INDEX` × 3 + `DROP TABLE IF EXISTS "DevChatMessage"`. File header warns it's not auto-applied. bectly runs manually per Rules (prod Turso + dev SQLite paths documented). ✅ Good ops hygiene; recommend Lead tracks the manual-apply in a TODO until both dev+prod tables are dropped, otherwise Prisma `db push` drift will eventually surface at the next schema migration.
- **Re-grep confirms no regressions**:
  - `dangerouslySetInnerHTML`: **17 occurrences / 7 files**, unchanged (all via `jsonLdString()` helper). ✅
  - `@ts-ignore` / `@ts-nocheck` / `@ts-expect-error`: **0**. ✅
  - Hardcoded secrets grep (`sk_live|sk_test|cfk_|Bearer [A-Za-z0-9]{20,}`): 0 hits in `src/`. ✅
- **ts-prune backlog unchanged**: P1-7e trio (`checkAvailability` / `getProducts`+`getCategories` / `cancelPacket`) + P1-7f (`updateSubscriberPreferences`) — still the only open src/ candidates. Devchat excision was net-deletion; no new orphans introduced.

**Net state after C4844**: audit holds. Devchat excision is a clean, well-scoped removal — replaces a two-sided messaging surface with `/admin/jarvis` (ttyd + Cloudflare Tunnel per commit message) and correctly preserves the Lead-only `/api/dev-picks` surface. **One follow-up for bectly**: rename `DEVCHAT_API_KEY` → `LEAD_API_KEY` in Vercel env (pre-next-Lead-pick-creation) **and** apply `001_drop_devchat.sql` to dev+prod databases to resolve Prisma schema drift.

No further Trace action needed until CWV sprint lands, lint regresses, or a new implementation surface appears. Task #367 remains a stable re-verification anchor.

---

## C4839 re-verification #2 addendum (2026-04-24, post-f093d03) — shuffle size filter lands clean

Re-ran after bectly's manual hot-feature `f093d03` (size filter on Objevuj overlay, XS–XXXL). 2-file diff: `src/app/api/products/random/route.ts` (+27/-3) + `src/components/shop/shuffle-overlay.tsx` (+72/-4).

- **`tsc --noEmit`**: ✅ PASS.
- **`npm run lint`**: ✅ **0 errors, 0 warnings** — C4829 MILESTONE now preserved through **6 consecutive commits** (#477, CWV audit, SEO-1, carousel, R2 preconnect, shuffle-size).
- **Security spot-check on the new `/api/products/random` surface**:
  - `sizes` query param: whitelisted `/^[A-Za-z0-9.,/+\-_ ]+$/` regex + 8-char length cap per token + 20-token array cap + Set dedup. No injection into Prisma query (filter happens in-memory via `JSON.parse(p.sizes)` on fetched rows — no raw interpolation). ✅
  - `exclude` param: trimmed + 128-char length cap + 500-token array cap, passed only to Prisma `notIn` (parameterized). ✅
  - `limit`: clamped `[1, 30]`. ✅
  - No new `dangerouslySetInnerHTML` / `innerHTML` / `eval` / shell calls introduced.
- **Client code (`shuffle-overlay.tsx`)**:
  - `localStorage` hydration of persisted sizes filters through `(SIZE_OPTIONS as readonly string[]).includes(s)` allowlist before state set — immune to tampered keys. ✅
  - Size-change effect clears queue + refetches; no stale-closure / race — guarded by `fetchingRef`.
  - Fisher-Yates shuffle uses `Math.random()` (non-cryptographic) — acceptable for UX randomization; not a security surface. ✅
- **Re-grep post-commit** (no regression from C4839 addendum #1):
  - `dangerouslySetInnerHTML`: **17 occurrences / 7 files**, unchanged (only meta hit is a comment in `src/lib/structured-data.ts` about safety). Zero raw-`__html` sites. ✅
  - `@ts-ignore` / `@ts-nocheck` / `@ts-expect-error`: **0**. ✅
  - Hardcoded secrets grep (`sk_live|sk_test|cfk_|Bearer [A-Za-z0-9]{20,}`): 0 hits in `src/`. ✅
- **ts-prune backlog unchanged**: P1-7e trio (reservation/products-cache/packeta) + P1-7f (`updateSubscriberPreferences`) still the only open candidates — shuffle-size diff is net-additive, no new orphans.

**Net state after C4839 #2**: audit holds. New feature passes all gates and adds zero new findings. Lead's CWV sprint (#481/#482/#483) remains the next implementation priority; P1-7 close-out still queued behind it.

No further Trace action needed until CWV sprint lands or lint regresses — task #367 remains a stable re-verification anchor.

---

## C4839 re-verification addendum (2026-04-24) — gates green through SEO-1 + UX-1 + R2-preconnect landings

Re-ran after CWV-adjacent landings: `f08e34d` (UX-1 error+loading coverage, 3 new boundary files), `b3125e4` (Trace CWV audit report), `b5c6281` (SEO-1 dynamic OG images — 4 new `next/og` routes), `cff840a` (PDP related products carousel), `889862b` (R2 preconnect in layout head).

- **`tsc --noEmit`**: ✅ PASS.
- **`npm run lint`**: ✅ **0 errors, 0 warnings** — MILESTONE C4829 preserved through 5 commits (#477, CWV audit, SEO-1, carousel, R2 preconnect). Bolt has been clean across two UX-1/SEO-1 commits as well as follow-up Lead-directed work.
- **P1-7e ts-prune trio** (queued by C4833, not yet picked up by Bolt — Lead pivoted to CWV #481/#482/#483 per 2026-04-24 directive):
  - `src/lib/actions/reservation.ts:145` — `checkAvailability` still present (0 consumers).
  - `src/lib/products-cache.ts:74,82` — `getProducts` + `getCategories` still present (0 consumers).
  - `src/lib/shipping/packeta.ts:212` — `cancelPacket` still present (0 consumers).
  - Verdicts unchanged — safe to DELETE per C4833 classification when Bolt has a quiet slot after the CWV sprint.
- **New ts-prune candidate** (P1-7f, surfaced C4839): `src/app/(shop)/actions.ts:77` — `updateSubscriberPreferences` server action, zero consumers across `src/` (only hits: self-definition + `docs/STRUCTURE.md` export listing). Comment at L73-76 says "Used for progressive profiling — e.g., on 2nd visit or preference page." That consumer does not exist. Classify as **DELETE** if no preference-page work is planned within the current sprint; **KEEP + TODO** if progressive-profiling UI is on Lead's 30-day roadmap (ask before prune — this one straddles dead-code vs. speculative-feature line).
- **Security re-sweep** (with new SEO-1 surface in play):
  - `dangerouslySetInnerHTML`: 5 files → **7 files, 17 occurrences** (PDP added 8 new JSON-LD scripts: product/breadcrumb/FAQ/optional-video × 2 render paths, collections added 2). Grep `dangerouslySetInnerHTML={{ __html: (?!jsonLdString)` → **zero matches**. All 17 feed through `jsonLdString()` helper which escapes `<`. ✅ Safe.
  - `@ts-ignore` / `@ts-nocheck`: still 0. ✅
  - Hardcoded secrets grep (`sk_live|sk_test|cfk_|Bearer [A-Za-z0-9]{20,}`): 0 hits in `src/`. ✅
- **No regressions** from SEO-1 dynamic OG image routes — `next/og` ImageResponse uses DB reads inside try/catch-equivalent defaults; no user-controllable HTML surface.
- **CWV findings** live in companion doc `docs/audits/cwv-2026-04-24.md` (not duplicated here); re-audit after #481+#482+#483 is task #484 and will be written to `cwv-2026-04-24-followup.md`.

**Net state after C4839**: audit continues to hold at clean-gates baseline. Remaining cleanup = 3 C4833-classified DELETEs (P1-7e) + 1 new DELETE candidate (P1-7f `updateSubscriberPreferences`, pending Lead roadmap call). Expected close-out is 4-file diff ~85 LoC once CWV sprint lands.

**Recommended next follow-up for Lead**: after #481/#482/#483 commit, bundle P1-7e (3 exports) + P1-7f (`updateSubscriberPreferences` if no progressive-profiling UI planned) into a single Bolt prune task. Gate: tsc clean + lint 0w/0e preserved + `npx ts-prune` src/ returns zero remaining non-framework candidates.

Task #367 remains complete in original scope. C4839 addendum is the 6th gated re-verification — audit doc is stable, further cycles should only re-run if new dead code surfaces or lint regresses.

---

## C4833 P1-7e ts-prune candidate classification (2026-04-24)

Lead directive C4832 requested DELETE/KEEP verdicts for the 3 remaining src/ ts-prune candidates gating P1-7e. Grep-verified across `src/`, `scripts/`, `tests/`, `prisma/`, and documentation:

### 1. `src/lib/actions/reservation.ts:145` — `checkAvailability`

**Verdict: DELETE** (~40 LoC function, lines 141-end of function).

- `grep -r "checkAvailability" src/ scripts/ tests/ prisma/` → zero call sites. Only hits: self-definition at L145 + `docs/STRUCTURE.md:659` export listing (auto-generated, will regenerate on post-commit hook).
- Sibling exports `reserveProduct` (L17), `releaseReservation` (L69), `extendReservations` (L86) are all live — keep file, delete `checkAvailability` only.
- JSDoc at L141-143 claims "used on product pages" — stale comment; product-gallery/product-card do not import it. Dead code from an abandoned product-page badge plan.
- No Prisma / scripts / tests consumers. Safe to restore from git if reservation-status UI is revived.

### 2. `src/lib/products-cache.ts:74,82` — `getProducts` + `getCategories`

**Verdict: DELETE both** (~15 LoC: lines 74-88 for the two exported functions, plus lines 24-52 for the internal `loadCatalog` + `loadCategories` helpers which become unreferenced, plus `CachedCatalog` + `CachedCategory` type exports at L101 — reference to `loadCategories`/`loadCatalog` ReturnType).

- `grep -r "getProducts\|getCategories" src/` → only self-definitions + unrelated `getCategoriesWithCounts` in `src/lib/category-counts.ts:13` (different function, different signature — used by `header.tsx:10,18,20`).
- `grep -r "from.*products-cache"` → single consumer `src/app/(shop)/products/[slug]/page.tsx:6` imports **only** `getProductBySlug` (L90). That export + its internal `loadProductBySlug` + `CachedProduct` type must be PRESERVED.
- After delete: file shrinks from 102 LoC → ~50 LoC, containing only `loadProductBySlug` + `getProductBySlug` + `CachedProduct` type export.
- Redis invalidation comment in file header (L16-17) references `invalidateProductCaches()` — that key family stays valid since `getProductBySlug` still uses the product cache key.

### 3. `src/lib/shipping/packeta.ts:212` — `cancelPacket`

**Verdict: DELETE** (~15 LoC function lines 209-226 including JSDoc).

- `grep -r "cancelPacket" src/ scripts/ tests/ prisma/` → zero consumers. Only hits: self-definition + JSDoc header comment at L11 + `docs/STRUCTURE.md:760` export listing + `docs/specs.md:136` ("planned" spec).
- Sibling `getPacketStatus` (L185) IS consumed by `scripts/cron/order-status-sync.ts:23,90` — **KEEP**.
- Sibling `createPacket` / `getPacketLabel` / `getPacketLabelsBatch` are live (used by admin order actions per `TODO.archived.md:173`).
- Delete `cancelPacket` only. Also update JSDoc header comment at L11 (`cancelPacket(packetId) → void` line) to keep doc in sync. Safe to restore from git if admin adds a "Storno zásilky" button later.

### Bonus: `src/lib/sizes.ts:305` — `normalizeSizesForCategory`

**Verdict: KEEP** (unchanged from C4826 addendum). Consumer confirmed: `scripts/normalize-sizes.ts:17` imports and invokes it. Outside src/-only sweep scope but worth reiterating — do NOT delete in P1-7e.

### P1-7e recommended Bolt scope

Single commit, 3-file diff, ~70 LoC net delete:
1. `src/lib/actions/reservation.ts` — delete `checkAvailability` + its JSDoc (L141 onwards through function close ~L195).
2. `src/lib/products-cache.ts` — delete `getProducts` (L74-80), `getCategories` (L82-88), `loadCatalog` (L24-39), `loadCategories` (L41-52); prune `CachedCatalog` + `CachedCategory` from L101 re-export; keep `CachedProduct` + `getProductBySlug` + `loadProductBySlug`.
3. `src/lib/shipping/packeta.ts` — delete `cancelPacket` (L209-226) + trim JSDoc header L11 line referencing it.

Post-diff gates: `npx tsc --noEmit` clean, `npm run lint` preserves 0w/0e MILESTONE (no new unused imports — all three files have no removed import dependencies), `npx ts-prune` on src/ should return zero remaining non-framework candidates, `npm run build` green. After this lands, src/ ts-prune sweep is FULLY complete; any further prune work moves to scripts/+tests/+prisma/ (out of P1-7 scope per C4830 directive).

---

## C4826 re-verification addendum (2026-04-24) — P1 cleanup burn-down

Re-ran gates after Bolt cleared tasks #468-#472 across commits `a8123c0` (7 dead imports), `cc5022d` (eslint config `^_` ignore), `e78a2b1` (useCallback deps), `3257854` (uploadthing.ts → upload-client.ts rename, 3 import sites), `9a892fe` (LETTER_TO_EU prune):

- **`tsc --noEmit`**: ✅ PASS.
- **`npm run lint`**: **7 problems (0 errors, 7 warnings)** — down from 20 at C4821. Net −13 warnings across 5 commits.
- **P1-3 unused imports** (#468): ✅ CLOSED for shop surface — `Mail`/`X`/`Link`/`Flame`/`vi` cleared. Remaining 7 warnings are all single-identifier `_`-ignorable vars not yet underscored: `totalValue` (abandoned-carts page), `shippingPre` (checkout actions), `clearPersistedReferralCode` (checkout page), `WIDGET_COOKIE_MAX_AGE` (dev-chat widget-login route), `stock` (product-card, product-list-item), `REFERRAL_MIN_ORDER_CZK` (referral.ts). All non-behavioral; next Bolt sweep trivial.
- **P1-4 uploadthing.ts rename** (#471): ✅ CLOSED — `src/lib/upload-client.ts` in place; product-form/image-upload/quick-add-form import sites updated.
- **P1-7 ts-prune partial** (#472): ✅ CLOSED for `LETTER_TO_EU` (14 LoC gone). `EU_TO_LETTER` + `ClothingLetterSize`/`ClothingEuSize` retained per grep (still referenced).
- **#473 in-flight** (Bolt): `getVisitorId` removal in `src/lib/visitor.ts` — verified: **file already contains only `getOrCreateVisitorId`** (L10) + `VISITOR_COOKIE`/`VISITOR_MAX_AGE` consts + `RESERVATION_MINUTES`/`RESERVATION_MS`. Either prior cleanup already removed it, or ts-prune was reporting a stale symbol. Grep for `getVisitorId` across `src/`: **zero hits**. Recommend Lead close #473 as already-done (no source edit required; confirm ts-prune re-run is clean).
- **eslint config hardening** (#469): `^_` ignore pattern now covers args/vars/caughtErrors — future underscore-stubs auto-silenced.
- **No regressions**: `@ts-ignore` still 0; `: any`/`as any` unchanged at 7; `dangerouslySetInnerHTML` still 5 (all `jsonLdString`); no hardcoded secrets; `console.*` unchanged.

**Net state after C4826**: All P0 + P1-1/2/4/6/7(LETTER_TO_EU) closed. Remaining open items are P1-3 leftovers (7 trivial underscore-renames) and the last ts-prune candidates (`deleteFromR2`, `normalizeSizesForCategory`, `ShoeSize`/`BraSize`/`OneSize` types). All hygiene-tier; safe to bundle as a final sweep task.

**Recommended next follow-up for Lead**: one small BOLT task — underscore-rename the 7 unused locals (or delete if definitively dead per scope review) + grep-verify + prune the remaining ts-prune candidates in one commit. Expected outcome: lint 7 → 0 warnings, full cleanup complete.

Task #367 remains complete in original scope. Re-verification cycles are now tracking Bolt's P1 burn-down.

---

## C4821 closing addendum (2026-04-24) — all P0/P1 closed

Re-ran the audit after commits `4738137` (#465 unescaped entities), `e468546` (#462 JSX-in-try-catch split), `05b37be` (#466 Date.now() RSC sites), and `c15485c` (#467 setState-in-effect idiomatic sites):

- **`tsc --noEmit`**: ✅ PASS.
- **`npm run lint`**: **20 problems (0 errors, 20 warnings)** — down from 76 (57 err / 19 warn) at C4817. Gate-clean. All remaining warnings are unused imports / unused destructured vars, non-behavioral.
- **P0-1 `/api/suggest` rate-limit**: ✅ CLOSED (#453, commit `15f55df`).
- **P0-2 refs-in-render**: ✅ CLOSED (#459, commit `f4dc52e`).
- **P0-3 setState-in-effect**: ✅ CLOSED — 3 sites fixed (#460), 2 sites refactored away, 6 idiomatic sites annotated with per-site `eslint-disable-next-line react-hooks/set-state-in-effect` + justification (#467, commit `c15485c`).
- **P1-1 JSX-in-try-catch** in `(shop)/page.tsx`: ✅ CLOSED (#462, commit `e468546`) — 5 `"use cache"` sections split: DB fetch in `try` (catch returns `null`), JSX hoisted outside. Cleared 44 errors.
- **P1-2 `Date.now()` in RSC**: ✅ CLOSED (#466, commit `05b37be`) — 5 sites annotated with `eslint-disable-next-line react-hooks/purity` + "request-time read in RSC, not cached" justification. Hoisting was insufficient; rule fires on any render-time call regardless of position.
- **P1-6 unescaped entities**: ✅ CLOSED (#465, commit `4738137`) — 5 raw quotes escaped across 4 admin files; Czech „ diacritics preserved.
- **P1-3 dead imports / unused vars**: still open (20 warnings). Non-blocking. Sample: `Mail`/`X` in admin pages, `Flame` + `stock` in product-card/product-list-item, `Link` in admin global-search + products-client, `REFERRAL_MIN_ORDER_CZK` in referral.ts, `_params`/`_transId`/`_amountCzk` in gopay.ts (underscore-prefixed stubs — whole file appears abandoned post-Comgate).
- **P1-4 `uploadthing.ts` legacy filename**: still open — rename `src/lib/uploadthing.ts` → `upload-client.ts` (4-file diff).
- **P1-7 ts-prune real candidates**: still open — `deleteFromR2`, `normalizeSizesForCategory`, `LETTER_TO_EU`, `getVisitorId`, plus the orphaned type exports in `sizes.ts`.
- **No new regressions**: `@ts-ignore` still 0; `: any`/`as any` unchanged at 7 (all opaque-lib sites); `dangerouslySetInnerHTML` still 5 (all `jsonLdString`); no hardcoded secrets; `console.*` sink-only (15 across 2 files).

**Net state after C4821**: All P0s closed. P1-1/P1-2/P1-6 closed. P1-3/P1-4/P1-5/P1-7 open — all are low-risk hygiene sweeps (dead-code prune, rename, dedupe). Recommend bundling P1-3 + P1-7 into a single prune task (Bolt, ~25 LoC).

**Recommended next follow-up for Lead**: file one BOLT task combining P1-3 (unused imports/vars sweep) + P1-7 (ts-prune dead exports). After grep-verifying each export, delete. Expected outcome: lint 20 warnings → 0, repo size shrinks, plus a gopay.ts decision (delete or wire up). gopay.ts is likely deletable — Comgate is the primary processor per CLAUDE.md; stub file existed before decision.

Task #367 is now complete in its original scope (audit → categorize → recommend). Further cleanup lives in the P1 follow-up tasks.

---

## C4817 re-verification addendum (2026-04-24)

Re-ran the audit after commits `15f55df` (task #453 P0-1 rate-limit), `f4dc52e` (task #459 P0-2 refs-in-render), and `8d0fb22` (task #460 P0-3 product-quick-edit subset — bundled with a mobile-checkout grid fix by bectly):

- **`tsc --noEmit`**: ✅ still PASS.
- **`npm run lint`**: **76 problems (57 errors, 19 warnings)** — down from 80 (62 err / 18 warn) at C4811. Net −5 errors, +1 warning.
- **P0-1 `/api/suggest`**: ✅ **CLOSED** — `src/app/api/suggest/route.ts` now calls `checkRateLimit(\`suggest:\${ip}\`, 30, 60_000)` with 429 + `Retry-After: 60`. Task #453 done (follow-up A).
- **P0-2 refs-in-render**: ✅ **CLOSED** — `hero-section.tsx` uses `useState(() => generatePetals(12))` initializer; `product-gallery.tsx` mirrors `lbDismissRef.current.dismissing` into `isLbDismissing` state for the inline style transition. Task #459 done (follow-up B). Neither site appears in lint output.
- **P0-3 setState-in-effect**: ⚠️ **PARTIALLY CLOSED** — task #460 (commit 8d0fb22) cleared all 3 sites in `product-quick-edit.tsx` (lines 33/36/142). Two other sites were also silently resolved by unrelated refactors: `account/change-email/page.tsx:29` (converted to server component with `Date.now()` in expression, no more `useEffect`) and `account/orders/[orderNumber]/page.tsx:60`. Remaining **6 sites**:
  - `src/app/pick-logo/pick-logo-client.tsx:68` — admin-only tool.
  - `src/components/shop/cart-button.tsx:27` — hydration flag.
  - `src/components/shop/checkout/express-checkout-buttons.tsx:32` — platform detection.
  - `src/components/shop/cookie-consent.tsx:45` — localStorage read.
  - `src/components/shop/mobile-nav.tsx:51` — route-change drawer close.
  - `src/components/shop/product-gallery.tsx:236` — **NEW** from #459 refactor; syncs video element pause state on slide change. Legit external-DOM sync pattern.

  Per audit recommendation (line 170) these are idiomatic hydration/route/DOM-sync patterns. Lead decision C4817 is to close the remaining 4 non-product-quick-edit sites with `// eslint-disable-next-line react-hooks/set-state-in-effect` rather than file a follow-up task. `product-gallery.tsx:236` should get the same treatment (video pause is external-system sync, not cascading render — exactly what eslint docs call out as legit).
- **P1-1 `no-jsx-in-try-catch`**: still **44 errors in `src/app/(shop)/page.tsx`** — confirmed single-file scope, 5 `"use cache"` sections at lines 79/254/336/391/460. Task #461 open (follow-up C).
- **No regressions** elsewhere: `: any`/`as any` still 7; `@ts-ignore` still 0; `dangerouslySetInnerHTML` still 5 (all `jsonLdString`); no new hardcoded secrets; `console.*` unchanged at 15 across 2 files (logger sink + orphan test).

**Net state after C4817**: A ✅, B ✅, C open (Bolt #461 next), D/E/F still open, G closed (with #422).

---

## C4811 re-verification addendum (2026-04-24)

Re-ran the audit after commits `d17d169` (task #422 logger migration), `f7c16c1` (task #449 homepage reorder), and `0696288` (task #450 cart restore):

- **`tsc --noEmit`**: ✅ still PASS.
- **`npm run lint`**: still **80 problems (62 errors, 18 warnings)** — no new issues, no regressions.
- **`console.*` sweep**: now **15 occurrences across 2 files** (`src/lib/logger.ts:4` sink + `src/lib/campaign-lock.test.ts:11` orphan). Task #422 fully resolved the noise (was 144 across 50). **P1-5 closed**.
- **P0-1 `/api/suggest` unrate-limited**: ❌ still open — `src/app/api/suggest/route.ts` has no `checkRateLimit` guard. Highest-priority follow-up.
- **P0-2 refs-in-render**: ❌ still open — `product-gallery.tsx:578` still reads `lbDismissRef.current.dismissing` inside inline `style`. `hero-section.tsx:50` still flagged by lint.
- **P0-3 setState-in-effect**: ❌ unchanged — 7 sites, same list.
- **New endpoint `/api/cart/restore`** (task #450, `src/app/api/cart/restore/route.ts`): reviewed — clean. Token is cuid (opaque, ~56^24 space = unenumerable), 7-day TTL guard, status check, safe JSON parse with `Array.isArray` guard, no PII leak on 404/410. Rate limiting is P2-only here given token opacity; not filing a follow-up.
- **Homepage reorder** (task #449): 6-line swap verified in `src/app/(shop)/page.tsx` — no quality impact.

**Net state after C4811**: follow-up tasks A, B, C, D, E, F from the table below remain open; G (P1-5 BASE_URL duplication) has been superseded by the logger refactor and is closed with the rest of #422.

---

## Executive summary

- **`tsc --noEmit`**: ✅ PASS, 0 errors.
- **`npm run build`**: not re-run (blocked by missing `@playwright/test` in devDeps — C4801 P1, already tracked in task #421).
- **`eslint`**: ❌ **80 problems (62 errors, 18 warnings)** — blocks `npm run lint` as a gate.
- **`ts-prune`**: 80+ unused exports (many false positives in schema/types modules, ~10 real dead-code candidates).
- **`depcheck`**: 3 unused deps (likely false positives), 4 unused devDeps (all false positives — config-only usage).
- **Tests**: 0 unit tests running in src/ (1 orphaned `campaign-lock.test.ts`, no runner) + 3 Playwright specs in `e2e/` (blocked by missing `@playwright/test`). Already tracked by task #421.
- **Security**: **1 P0 finding** (unrate-limited external-API proxy). Otherwise clean — `dangerouslySetInnerHTML` uses are all safe JSON-LD, no hardcoded secrets, admin routes properly auth-guarded.
- **Console noise**: **144 console.\* across 50 files** (email.ts worst at 38). Tracked by task #422. **CLOSED C4810** (d17d169) — residual 15 across 2 files is only `logger.ts` sink + `campaign-lock.test.ts` orphan.

---

## P0 — bugs / security (follow-up tasks recommended)

### P0-1 — `/api/suggest` is an unrate-limited external-API proxy

**File**: `src/app/api/suggest/route.ts:11-73`

Server-side Mapy.com address-autocomplete proxy exposes `MAPY_API_KEY` via fetch with **zero rate limiting**. Anonymous callers can drain the 62,500-call/month free tier by hitting `/api/suggest?q=x` in a loop. The rest of the app (`/api/upload`, `/api/admin/jarvis`) already uses `checkRateLimit()` from `src/lib/rate-limit.ts` — apply same pattern here (e.g., 30 req/min per IP).

**Why this is P0**: cost/availability regression — a trivial script can knock out address autocomplete for real customers during the launch window. One-line fix, not a design change.

**Proposed follow-up**: BOLT task — add `checkRateLimit("suggest:" + ip, 30, 60_000)` at the top of `/api/suggest` GET handler, returning 429 on exceed.

### P0-2 — React-hooks `refs`-during-render violations (potential stale render bugs)

**Files**:
- `src/components/shop/hero-section.tsx:50` — `petals.map(...)` reads `petalsRef.current` during JSX construction.
- `src/components/shop/product-gallery.tsx:578` — reads `lbDismissRef.current.dismissing` inside inline `style={{ transition: ... }}`.

React 19 strict rule: refs mutated outside render (e.g., by a pointer-move handler) aren't tracked, so JSX may render against stale ref values. Product gallery lightbox dismiss animation is the riskier one — wrong transition on the wrong frame during swipe.

**Proposed follow-up**: BOLT task — hoist read to `useSyncExternalStore`, or promote the ref value to state, or use `useDeferredValue`. Low effort, 2 files.

### P0-3 — `setState`-sync-in-effect cascading-render hazards

**Files** (7 distinct sites):
- `src/components/shop/mobile-nav.tsx:51` — closes drawer on route change.
- `src/components/shop/cart-button.tsx:27` — hydration flag pattern.
- `src/components/shop/cookie-consent.tsx:45` — reads localStorage.
- `src/components/shop/checkout/express-checkout-buttons.tsx:32` — platform detection.
- `src/app/(shop)/account/change-email/page.tsx:29` — form init.
- `src/app/(shop)/account/orders/[orderNumber]/page.tsx:60` — view-state init.
- `src/app/pick-logo/pick-logo-client.tsx:68` — admin-only tool.
- `src/components/admin/product-quick-edit.tsx:33,36,142` — form reset-on-open.

Most are benign hydration/route-sync patterns React 19 now wants expressed via `useSyncExternalStore` or by initializing state from a function. `product-quick-edit.tsx` with 3 sites is the worst offender — edit-modal can flash stale form values while cascading re-renders settle.

**Proposed follow-up**: BOLT task — audit & migrate `product-quick-edit.tsx` (highest user-visible churn). Mobile-nav + cart-button are classic `useHydrated()` hooks; extract to `src/lib/hooks/use-hydrated.ts` and deduplicate.

---

## P1 — quality (tasks)

### P1-1 — 44 `no-jsx-in-try-catch` errors in `src/app/(shop)/page.tsx`

The `"use cache"` sections (lines 80-491) wrap both data fetching and JSX construction in one try/catch. React's cache-components lint rule wants JSX outside the try block — error path should return a fallback tree, not rethrow after building JSX. This is 44/62 of the lint errors. Single-file fix.

**Proposed follow-up**: BOLT task — split each `"use cache"` function so DB reads are inside `try`, fallback returns inside `catch`, and happy-path JSX lives outside. ~5 sections.

### P1-2 — "Cannot call impure function during render" in server components

**Files**:
- `src/app/(admin)/admin/layout.tsx:42` — `new Date(Date.now() - 24*60*60*1000)` for last-24h badge.
- `src/app/(admin)/admin/customers/[id]/page.tsx:127` — `Date.now()` for stats.
- `src/app/(admin)/admin/customers/page.tsx:142` — `Date.now()` for stats.

These are RSCs so no re-render hazard, but the lint rule is good hygiene — accept by wrapping in a tiny helper (`function nowMinus24h()`) marked with a side-effect comment, or hoist the Date construction above the JSX return.

**Proposed follow-up**: BOLT task or fold into P1-1 task.

### P1-3 — Dead imports / unused vars

- `src/components/shop/product-card.tsx:9` — `Flame` imported, unused.
- `src/components/shop/product-card.tsx:62` — `stock` destructured, unused.
- `src/components/shop/product-list-item.tsx:8,56` — same pattern.
- `src/lib/referral.ts:5` — `REFERRAL_MIN_ORDER_CZK` imported, unused.
- `src/lib/payments/gopay.ts:18,23,27` — `_params`, `_transId`, `_amountCzk` (underscore-prefixed = intentional stubs, but the whole file looks like an abandoned GoPay stub after Comgate decision — verify).

**Proposed follow-up**: BOLT task — prune; verify gopay.ts is reachable before deleting.

### P1-4 — `src/lib/uploadthing.ts` legacy filename after R2 migration

The file is R2 upload helpers (verified — no UploadThing imports remain). Filename is misleading and will confuse future readers. 3 import sites: `product-form.tsx`, `image-upload.tsx`, `quick-add-form.tsx`.

**Proposed follow-up**: BOLT task — rename to `src/lib/upload-client.ts`, update imports. 4-file diff.

### P1-5 — `src/lib/email.ts` is 2854 LoC with duplicated env reads

38 `console.*` calls (worst file in repo — already flagged by Lead C4801 and scoped in task #422). Additionally, the literal `process.env.NEXT_PUBLIC_APP_URL ?? "https://janicka-shop.vercel.app"` appears **29 times** (see grep output). One const at module top eliminates the duplication.

**Proposed follow-up**: fold into task #422 (console cleanup) — add a module-scoped `const BASE_URL = ...` and replace all 29 sites.

### P1-6 — Trivial `react/no-unescaped-entities`

- `src/app/(admin)/admin/email-templates/email-editor.tsx:248:55`
- `src/app/(admin)/admin/settings/measurements-backfill.tsx:91:30`
- `src/app/(admin)/admin/subscribers/campaign-dry-run-dialog.tsx:325:54`

Admin-only, not user-facing. 3x `"` → `&quot;`. Auto-fixable.

**Proposed follow-up**: BOLT task or fold into P1-1 sweep.

### P1-7 — ts-prune real candidates (after filtering false positives)

Confirmed unused public exports (verify call sites, then delete):
- `src/lib/r2.ts:52` — `deleteFromR2` (never imported).
- `src/lib/products-cache.ts:74,82` — `getProducts`, `getCategories` (used only by the module itself? verify against dynamic import).
- `src/lib/sizes.ts:323` — `normalizeSizesForCategory`.
- `src/lib/sizes.ts:112` — `LETTER_TO_EU` (the reverse `EU_TO_LETTER` is used-in-module).
- `src/lib/sizes.ts:66,89,92` — `ShoeSize`, `BraSize`, `OneSize` type exports.
- `src/lib/visitor.ts:10` — `getVisitorId`.

**Proposed follow-up**: BOLT task — prune confirmed-dead (grep for each export name repo-wide first).

---

## P2 — nice-to-have (notes, no task required yet)

- **`depcheck` false positives**: `@hookform/resolvers` + `react-hook-form` (CLAUDE.md claims convention but no `src/` usage — either adopt or remove); `tw-animate-css` (CSS `@import` in `globals.css` — not dep-check visible); `@tailwindcss/postcss` + `tailwindcss` + `shadcn` + `@types/react-dom` (all config-only, expected).
- **`next.config.ts:131`** — `default` export flagged by ts-prune (consumed by Next runtime, expected).
- **144 console.\* across 50 files** — covered by task #422 gated-logger plan. Worst files: `email.ts=38`, `queues/run-worker.ts=7`, `checkout/actions.ts=14`, `campaign-lock.test.ts=11` (orphan).
- **`src/lib/campaign-lock.test.ts`** — orphaned (no test runner script, mentioned in C4801 audit, scoped in task #421).
- **Secrets grep**: no `sk_live`, `sk_test`, `cfk_`, or inline Bearer tokens in `src/`. ✅
- **`dangerouslySetInnerHTML`**: 5 files, all render `jsonLdString()` output (escapes `<`). ✅
- **`@ts-ignore`/`@ts-expect-error`/`@ts-nocheck`**: **zero** occurrences. ✅
- **`: any` / `as any`**: 7 occurrences across 6 files — all in places where an external-lib type is opaque (jspdf font data, credit-note generation, analytics). Acceptable.
- **TODO/FIXME in src/**: zero (grep confirms the XXX hits were size labels). ✅

---

## Recommended follow-up tasks for Lead

| # | Priority | Agent | Scope | LoC estimate |
|---|----------|-------|-------|--------------|
| A | P0 | BOLT | Rate-limit `/api/suggest` (+1 test once #421 lands) | ~5 |
| B | P0 | BOLT | Fix refs-in-render: `hero-section` + `product-gallery` lightbox transition | ~15 |
| C | P1 | BOLT | Split `"use cache"` try/catch/JSX in `(shop)/page.tsx` — clears 44 lint errors | ~80 |
| D | P1 | BOLT | Hoist `Date.now()` in admin layout + 2 customer pages; escape 3x `"` in admin forms | ~15 |
| E | P1 | BOLT | Rename `src/lib/uploadthing.ts` → `upload-client.ts` + 3 imports | ~4 |
| F | P1 | BOLT | Prune confirmed-dead exports (P1-7) + unused imports (P1-3) | ~20 |
| G | P2 | BOLT | `src/lib/email.ts` — hoist shared `BASE_URL` const, remove 29 duplications (fold into #422) | ~35 |

**Total cleanup**: ~175 LoC across 7 tasks. None are architectural — all are "workers-in-a-rush" hygiene, exactly what the directive targeted.

Post-cleanup `npm run lint` should drop from 80 problems → ~5 (the cart-button/cookie-consent/change-email setState-in-effect patterns are idiomatic and may stay as-is with `// eslint-disable-next-line`).

---

## Audit method reproducibility

```bash
cd /home/bectly/development/projects/janicka-shop
npx tsc --noEmit                       # PASS
npm run lint 2>&1 > /tmp/lint.txt      # 80 problems
npx ts-prune                           # unused exports
npx depcheck --skip-missing            # unused deps
# grep sweeps (see audit body for patterns)
```

---

## C4851 re-verification addendum (2026-04-24, post-29a9911, mailbox + getBaseUrl sweep)

4 commits landed on top of C4848 HEAD `a48e58f` since the last sweep: `767966d` (redeploy — FROM @vryp.cz → @jvsatnik.cz, code-level no-op), `fafa947` (#496 Phase 1 admin mailbox — EmailThread/Message/Attachment Prisma models, IMAP pull lib, cron route, /admin/mailbox UI, sidebar badge), `29a9911` (#497 getBaseUrl canonicalization — 24 baseUrl consts in email.ts + 16 other src/ files now call `getBaseUrl()` from layout.ts; `NEXT_PUBLIC_BASE_URL:903` typo fixed; `https://janicka-shop.vercel.app` fallback gone repo-wide).

- **`tsc --noEmit`**: ✅ PASS.
- **`npm run lint`**: ✅ **0 errors, 0 warnings** — C4829 MILESTONE now preserved through **21 consecutive commits**.
- **`grep janicka-shop.vercel.app src/ prisma/`**: **0 hits**. C4847 P1-new stale-fallback finding fully retired. ✅
- **`grep NEXT_PUBLIC_BASE_URL src/ prisma/`**: **0 hits**. C4847 P1-new typo finding fully retired. ✅
- **`getBaseUrl` sole definition**: `src/lib/email/layout.ts:48` (reads `NEXT_PUBLIC_APP_URL`, falls back to `https://jvsatnik.cz`). 30 call-sites in `email.ts` + 16 other src files consume it. Central kill-switch via `NEXT_PUBLIC_APP_URL` env confirmed. ✅
- **`@ts-ignore` / `@ts-nocheck` / `@ts-expect-error`**: **0** in `src/` (unchanged). ✅
- **`dangerouslySetInnerHTML`**: 17 occurrences / 7 files, unchanged (all via `jsonLdString()` helper). ✅
- **Secrets grep** (`sk_live`/`sk_test`/`cfk_`/inline Bearer): 0 in `src/`. ✅

### New surface: `src/lib/email/imap-sync.ts` (280 LoC, fafa947)

Feature-flagged IMAP inbox puller — no-ops with `ok:false, error:imap_disabled` when `IMAP_HOST`/`IMAP_USER`/`IMAP_PASSWORD` missing (safe for current prod — env unset pending bectly mailhosting pick). Cron at `/api/cron/email-sync` gated on `CRON_SECRET` Bearer match. Dedup via `EmailMessage.messageId @unique`. Threading via `inReplyTo` then `references` chain lookup. RSC thread view marks unread=0 on load. All mutating server actions in `mailbox/actions.ts` gated by `requireAdmin()` (NextAuth session check).

Security posture:
- **Auth**: cron Bearer check ✅; server actions `requireAdmin()` ✅; thread view is under `(admin)` route group ✅.
- **Prisma queries**: all parameterized via Prisma client (no `$queryRaw`). ✅
- **Attachment filename**: sanitized via `[^a-zA-Z0-9._-]/g → -` + 120-char cap before R2 upload. ✅ Path-traversal safe.
- **Subject**: capped at 500 chars. `contentType` capped 120 chars. Defensive against oversized headers. ✅
- **`bodyHtml` rendering**: `admin/mailbox/[threadId]/page.tsx:229-234` renders the raw IMAP `bodyHtml` into an **iframe with `sandbox=""` and `srcDoc={bodyHtml}`**. Empty sandbox blocks scripts/forms/same-origin/top-nav (XSS mitigated). **Remote `<img>` / `<link>` still fetch** — P2 privacy concern below.

### P1-10 (NEW) — `imap-sync.ts::persistParsedMessage` stores a fabricated `r2Key` that doesn't match R2 reality

`src/lib/email/imap-sync.ts:178-187`:

```ts
const key = `mailbox/${checksum}-${safeName}`;
await uploadToR2(buf, safeName, att.contentType ?? "application/octet-stream", "mailbox");
attachmentsData.push({ ...; r2Key: key, ... });
```

But `uploadToR2` (src/lib/r2.ts:19-43) **ignores any external key** and builds its own: `${folder}/${randomUUID()}-${safeName}` — and **returns** the public URL. The returned URL is discarded. So `EmailAttachment.r2Key` stored in DB is `mailbox/<sha256>-<name>` while the actual object in R2 lives at `mailbox/<uuid>-<name>`. When Phase 4 adds signed download, `getSignedUrl({ Key: r2Key })` will 404 on every row.

The `checksumSha256` column IS still correct (hash of the buffer, useful for dedup / integrity), so the finding is specifically about the key field.

**Proposed fix**: extend `uploadToR2` to return `{ key, publicUrl }` (or accept optional explicit key parameter), have imap-sync capture and persist the authoritative key. ~15 LoC across r2.ts + imap-sync.ts + any other uploadToR2 consumer that wants the key. Blocks Phase 4 attachment download; **must land before** bectly provisions IMAP or data will be unrecoverable. **Proposed follow-up: BOLT task** — "fix EmailAttachment.r2Key drift — uploadToR2 must return canonical key".

### P1-11 (NEW) — redundant thread.participants re-read in `persistParsedMessage`

`src/lib/email/imap-sync.ts:218-236`:

```ts
await db.emailMessage.create({ ... });
await db.emailThread.update({
  where: { id: threadId },
  data: {
    ...,
    participants: JSON.stringify(dedupStrings([
      ...JSON.parse((await db.emailThread.findUnique({ where: { id: threadId }, select: { participants: true } }))?.participants ?? "[]"),
      ...participants,
    ])),
  },
});
```

Three-round-trip pattern (create-message, findUnique-thread, update-thread) per inbound email. For a 50-msg batch that's 150 sequential Prisma calls where 100 should be combinable. Low priority since cron runs every 5 min + batchLimit=50, but also vulnerable to race (two concurrent syncs could lose a participant entry). **Proposed fix**: hoist the existing `thread` record earlier (we already know its id — select `participants` in the initial lookup or at creation time); or use an atomic SQL that appends to a JSON array. ~10 LoC. **Proposed follow-up: BOLT task — fold into P1-10 or defer to Phase 3.**

### P1-12 (NEW) — cron auth uses non-constant-time string compare (pre-existing pattern, not a regression)

`src/app/api/cron/email-sync/route.ts:14` uses `authHeader !== `Bearer ${cronSecret}`` — `!==` on strings is not timing-safe. The same pattern is in 10 other cron/admin routes (similar-items, delivery-deadline, win-back, cross-sell, browse-abandonment, delivery-check, new-arrivals, review-request, abandoned-carts, mothers-day). For Vercel cron the exposure is low (remote attacker would need to send millions of requests against network-level latency), but a `crypto.timingSafeEqual` helper + a `src/lib/cron-auth.ts` would collapse the 11 duplicated auth blocks into one. **Proposed follow-up: BOLT task (P1, codebase-wide)** — "extract `requireCronSecret(req)` helper with constant-time compare; migrate 11 cron routes". ~40 LoC.

### P2-7 (NEW) — admin thread iframe `sandbox=""` blocks script but still fetches remote images (tracker pixel leak)

`src/app/(admin)/admin/mailbox/[threadId]/page.tsx:229-234` uses `<iframe sandbox="" srcDoc={bodyHtml}>`. Empty sandbox is strict for scripts/forms/same-origin/nav, but the browser will still resolve `<img src="...">`, `<link rel="stylesheet">`, and `url(...)` in inline CSS — every spam/marketing email sender learns that a Janička admin opened the message and at what IP. Also a GDPR/ePrivacy angle (admin acts as data-controller on opening). Mitigations: strip remote `<img>` before storage with DOMPurify (already on Phase 4 TODO), or route images through a same-origin proxy that only opens on explicit "Load images" click. **Proposed follow-up: fold into Phase 4 DOMPurify step** — add `ALLOWED_URI_REGEXP` = data: / cid: only, else click-to-load.

### ts-prune on new surface

- `src/lib/email/layout.ts::renderBody` (line 250) — still unused (C4847 P2-new carried forward). Either wire in Sage Phase 2 or drop.
- `src/lib/email/imap-sync.ts` — single exported function `syncImapInbox`; only consumer is the cron route. ✅ No orphans introduced.
- `src/app/(admin)/admin/mailbox/actions.ts` — 6 server actions, all consumed by thread page or list page. ✅ No orphans.

### depcheck on new deps

`fafa947` added `imapflow`, `mailparser`, `@types/mailparser`. All three used only in `imap-sync.ts`. No stale `resend` / `@resend/*` residue (dep was dropped in `6e2b580`). ✅

### Other C4847 findings — status carry-forward

- **P1-new "stale vercel fallback x25"** — ✅ **CLOSED** by #497 (29a9911). 0 hits repo-wide.
- **P1-new "`NEXT_PUBLIC_BASE_URL` typo at email.ts:903"** — ✅ **CLOSED** by #497 (29a9911). 0 hits repo-wide.
- **P1-new "#495 shipped mid-block (lane-discipline)"** — supervision note, no code artifact; unchanged.
- **P2-new "`renderBody` dead export"** — ⏳ open (see above).
- **P2-new "Resend comment drift ×14"** — ⏳ open (no touch in this window).

### Recommended follow-up tasks (Lead delta vs. C4847)

| # | Priority | Agent | Scope | LoC |
|---|----------|-------|-------|-----|
| J | P1 | BOLT | `EmailAttachment.r2Key` drift — `uploadToR2` returns `{ key, publicUrl }`; imap-sync persists authoritative key | ~15 |
| K | P1 | BOLT | Extract `requireCronSecret(req)` w/ `timingSafeEqual`; migrate 11 cron routes | ~40 |
| L | P1 | BOLT | imap-sync participants update — hoist read or use atomic JSON append | ~10 |
| M | P2 | BOLT | Phase 4 DOMPurify config: strip remote `<img>` / block `http(s):` in `href` / allow `data:` + `cid:` only | part of Phase 4 |

Lane-discipline note: **J is a functional blocker for Phase 4** — Phase 4 attachment download will return 404 for every row written while the bug ships. Recommend J runs before bectly flips `IMAP_*` env in Vercel.

---

## C4866 addendum — row R **integrity-guard checklist** (repeatable gates for email subsystem)

Fold-in per Lead C4863: promote the 4 integrity axes that C4861 row R used one-shot into a repeatable checklist future Trace cycles can run verbatim. Each guard is a single grep/stat pattern with a numeric pass/fail threshold; all four must pass for the email subsystem to be considered clean. This freezes the C4858 + C4859 refactor so a future rush-commit can be caught at audit time.

### Current status (C4866 re-run, HEAD f64a013)

| # | Guard | Command | Threshold | C4866 reading |
|---|---|---|---|---|
| G1 | **email.ts LoC ≤ 2400** | `wc -l src/lib/email.ts` | ≤ 2400 | **2369** ✅ (−31 headroom) |
| G2 | **DOCTYPE purge outside canonical shell** | `grep -rn '<!DOCTYPE' src/ \| grep -v 'src/lib/email/layout.ts' \| grep -v 'api/unsubscribe'` | ≤ 1 hit (the `buildContactEmailHtml` admin-notify drift) | **1** ⚠ (known drift — see G2 drift note below) |
| G3 | **layout.ts single-source** | `grep -rln 'from "@/lib/email/layout"\|from "./layout"\|from "../email/layout"' src/` | exactly 3 consumers (email.ts, email/wishlist-sold.ts, email/similar-item.ts) | **3** ✅ |
| G4 | **dingbat-free** (numeric HTML entities outside escape helpers) | `grep -nE '&#(x[0-9A-Fa-f]+\|[0-9]+);' src/lib/email.ts src/lib/email/layout.ts src/lib/email/wishlist-sold.ts src/lib/email/similar-item.ts \| grep -v '&#39;'` | 0 hits | **7** ❌ (6-pointed star ×5, filled circle ×1, ★ ×1, flower ×1 — per row Q C4861) |

**Composite verdict**: 2/4 green (G1, G3), 1/4 amber-known-drift (G2), 1/4 red-cosmetic (G4). G4 is P2, G2 is pre-existing (contact-form admin email lives outside the branded-layout pipeline by design — it's internal ops, not customer-facing). The real gate that matters for future refactors is **G1 (LoC) + G3 (single-source)** — both firm ✅.

### G2 drift note (retained, not upgraded)

`src/app/(shop)/contact/actions.ts:83 buildContactEmailHtml` — hand-rolled DOCTYPE + inline-styled table for the admin notification sent to `kontakt@jvsatnik.cz` when a customer submits the contact form. ~40 LoC of HTML. **Scope call**: this email lands in Janička's own inbox, not a customer's — the branded-layout pipeline is overhead here. Recommend **LEAVE** unless Sage Phase 3 absorbs it during the renderLayout refactor. If touched, drop the full hand-rolled shell in favour of `renderLayout({title:"Nová zpráva…", showUnsubscribe:false})` + a renderInfoCard block. Not worth a standalone task.

### G3 concern (watch, don't regress)

Three consumers is the **cap** — the moment a fourth file lands that imports `renderLayout` / `renderProductGrid` / etc., Phase 4 DOMPurify integration becomes harder to sequence because the per-template sanitisation rule has to fork. If `mailbox/compose` (phase 3 outbound) lands, it MUST import from `layout.ts` (not from `email.ts`) to keep G3 at 3 + mailbox = 4; we accept 4 but not beyond without a Lead call.

### G4 close-out path

7 dingbat entities at the following exact sites (C4866 grep confirmed):

```
src/lib/email.ts:472   &#10022;  (fallback product-tile glyph — primary image missing)
src/lib/email.ts:626   &#10022;  (promise grid — Kousky s příběhem)
src/lib/email.ts:627   &#9679;   (promise grid — Novinky první)
src/lib/email.ts:628   &#10047;  (promise grid — Udržitelná radost)
src/lib/email.ts:629   &#9733;   (promise grid — Rychlé doručení)
src/lib/email/layout.ts:108   &#10022;  (header divider)
src/lib/email/wishlist-sold.ts:61   &#10022;  (fallback product-tile glyph)
```

Simple fix: replace `&#10022;` with the word "Janička" at typographic scale or the existing `·` (middle dot) already used in the footer, and convert the 4-item promise grid to pure-text cards (the icon column is decorative and retires cleanly to `display:none` on Outlook anyway). ~15 LoC in `email.ts` + ~3 LoC in `layout.ts` + ~2 LoC in `wishlist-sold.ts`. **Proposed follow-up: SAGE** (Phase 3 rider — do it in the same touch as showUnsubscribe boolean to keep layout.ts under one commit).

### Reproduction (paste into any future Trace cycle)

```bash
cd /home/bectly/development/projects/janicka-shop
echo "G1 email.ts LoC: $(wc -l < src/lib/email.ts) (≤ 2400 = PASS)"
echo "G2 rogue DOCTYPE: $(grep -rln '<!DOCTYPE' src/ | grep -v email/layout.ts | grep -vc api/unsubscribe) known-drift file(s) (≤ 1 = PASS)"
echo "G3 layout consumers: $(grep -rlE 'from "(@/lib/email/layout|\./layout|\.\./email/layout)"' src/ | wc -l) (= 3 = PASS, = 4 acceptable w/ mailbox compose, > 4 ESCALATE)"
echo "G4 dingbats: $(grep -nE '&#(x[0-9A-Fa-f]+|[0-9]+);' src/lib/email.ts src/lib/email/layout.ts src/lib/email/wishlist-sold.ts src/lib/email/similar-item.ts | grep -v '&#39;' | wc -l) (= 0 = PASS)"
```

If any of G1/G3 flips red, the email refactor regressed — block ship and escalate to Lead. G2/G4 flipping to amber or red is cosmetic and fold into the next Sage cycle.

---

## C4866 PERF-VERIFY pointer (task #484)

Full report: `docs/audits/cwv-2026-04-24.md` § "C4866 PERF-VERIFY re-audit". 3 gate verdicts:
- **#481 CLS ≤ 0.1** — ✅ PASS on home (0.431 → **0.000**), cascades to PDP (0.000) + checkout (0.061).
- **#482 PDP LCP ≤ 2.5s** — ❌ FAIL but improved (5.04s → 4.59s). `resourceLoadDelay` regressed (2710 → 3206 ms) on sampled sold PDP — suspect greyscale-overlay wrapper delays image discovery. Re-test on a live PDP URL before declaring the fix broken.
- **#483 cookie LCP off 4/5 routes** — ❌ PARTIAL. SSR shell shipped (41b7c43) but cookie `<p>` is STILL LCP on home/listing/cart/checkout because the banner paragraph is the largest viewport element. Architectural win ≠ scoring win — option B from C4835 (collapsed heading + "Nastavení" expandable) is the residual path. ~20 LoC.

New finding out of the re-audit: **`/cart` CLS regressed 0.020 → 0.423** (4.2× budget) — the #481 Suspense-min-h discipline never got applied to `src/app/(shop)/cart/page.tsx`. Recommend BOLT task "[PERF-CART-CLS] replicate #481 min-h skeletons on cart route, ~10 LoC" — **P0** if Den matek drops ship through cart.

---

## Row S — Next 16 deprecation sweep (task #518, C4868 Trace)

Full report: `docs/audits/next16-deprecations-2026-04-24.md`. One-line summary:

- **`<Image priority>` → `<Image preload>`** rename is the only Next 16 deprecation in the tree. 11 direct `<Image priority>` sites + 6 consumer sites passing `priority` as a wrapper prop + 3 wrapper component prop definitions. PDP hero (`product-gallery.tsx:393`) is carved out to #516 (LCP hoist); remaining 10 direct sites are cosmetic Phase-1 renames.
- **`next.config.ts`**: clean — `cacheComponents: true` is the stable successor to `experimental.dynamicIO`. No `ppr`, no `optimizeCss`, no deprecated flags.
- **Pages Router artefacts**: absent. No `pages/`, no `_app`/`_document`, zero `legacyBehavior` / `next/legacy/*` / `layout=` / `objectFit=` matches.
- **`"use cache"`**: 13/13 placements correct (function-top, paired with `cacheLife`/`cacheTag` where invalidation matters). Non-blocking observation: 6 inline caches in `app/(shop)/page.tsx` (lines 25/52/81/257/341/397) omit explicit tags — if `revalidateTag` should reach them, add `cacheTag('products')`.
- **Dep pins**: no hard pin to `next@<16`. Watch `next-auth@5.0.0-beta.30` and unmaintained `vaul@1.1.2` before a future Next 17 bump.

Suggested Bolt fork: **Phase 1 rename** (10 direct sites, skip 1a#1 — handled by #516); **Phase 3 cosmetic** (wrapper prop rename across 3 components + 6 consumer sites) deferred unless a Next 17 bump is scheduled.

---

## C4869 addendum — rows T/U/V (fold-in of 382de66 Bolt #513 + 9902592 Trace #518)

### Row T — `/cart` CLS P0 fix verification (Bolt 382de66, task #513)

Commit shrinks `src/app/(shop)/cart/page.tsx` from 65 lines of skeleton/branch shell to 15 inserts / 50 deletes and puts `min-h-[70vh]` on every render branch so the wrapper height is pinned across SSR → hydration swaps.

Grep gate: `grep -c 'min-h-\[70vh\]' src/app/(shop)/cart/page.tsx` → **6** (5 branches + 1 comment marker). Branches enumerated at lines 109, 120, 143, 164, 184 — all present. ✅

| Branch | Line | Shell |
|---|---:|---|
| skeleton (loading) | 109 | `mx-auto flex min-h-[70vh] max-w-3xl flex-col items-center` |
| restore-loading | 120 | `mx-auto min-h-[70vh] max-w-3xl` |
| restore-error | 143 | `mx-auto min-h-[70vh] max-w-3xl` |
| empty | 164 | `mx-auto min-h-[70vh] max-w-3xl` |
| main | 184 | `mx-auto min-h-[70vh] max-w-3xl` |

This is the direct response to the C4866 PERF-VERIFY note "`/cart` CLS regressed 0.020 → 0.423 — #481 Suspense-min-h discipline never got applied to cart". The fat 2-item skeleton (~670px) was shifting ~300px to the empty-cart state (~370px). Compact empty-state-sized skeleton + 70vh floor equalises page-wrapper height across all five hydration states → footer no longer shifts.

**Status**: ✅ verified by structural grep + commit diff. **Does not discharge the #484 PERF-VERIFY gate** — requires Lighthouse 13.1 replay to confirm CLS on /cart drops below 0.1. Gate remains held until {#513 ✅ + #516 + #517 + #515} all in HEAD per C4869 Lead directive.

### Row U — Row S correction: `shop/page.tsx` inline caches DO carry explicit `cacheTag` (supersedes C4868 finding)

**C4868 Trace flagged**: "6 inline `"use cache"` functions in `src/app/(shop)/page.tsx` lines 25/52/81/257/341/397 omit explicit `cacheLife`/`cacheTag`. They inherit the default cache profile. If admin mutations need to invalidate these (`revalidateTag`), they currently cannot."

**C4869 re-audit of HEAD (`796c915`) contradicts**: all 7 `"use cache"` sites in `src/app/(shop)/page.tsx` are paired with `cacheLife("hours")` + `cacheTag("products")` on the very next two lines:

```
src/app/(shop)/page.tsx:25   "use cache"; 26 cacheLife("hours"); 27 cacheTag("products");
src/app/(shop)/page.tsx:52   "use cache"; 53 cacheLife("hours"); 54 cacheTag("products");
src/app/(shop)/page.tsx:81   "use cache"; 82 cacheLife("hours"); 83 cacheTag("products");
src/app/(shop)/page.tsx:257  "use cache"; 258 cacheLife("hours"); 259 cacheTag("products");
src/app/(shop)/page.tsx:341  "use cache"; 342 cacheLife("hours"); 343 cacheTag("products");
src/app/(shop)/page.tsx:397  "use cache"; 398 cacheLife("hours"); 399 cacheTag("products");
src/app/(shop)/page.tsx:467  "use cache"; 468 cacheLife("hours"); 469 cacheTag("products");
```

Git blame: `shop/page.tsx` unchanged since `74f3c55` (C4843 #481 reserved-min-h fix). The cacheTag calls predate C4868. **C4868 Row S finding was a false-positive from incomplete file-slice grep**: the audit table in `docs/audits/next16-deprecations-2026-04-24.md` § 4 shows the first 6 rows with `—` under "Tag / Life" while row 7 (line 467, `RecentlySoldSection`) shows `cacheLife("hours"), cacheTag("products")` — the table formatter skipped the pair on the first 6 inline caches even though they are syntactically present.

**Consequence**: the Lead-filed "Bolt backlog" item for Row S → `cacheTag` sweep is a **no-op**; `revalidateTag('products')` already reaches every cached fetch in `shop/page.tsx`. The correct next-action on Row S is **close the finding**, not schedule a Bolt task.

Additional verification — grep the entire `src/app` tree for bare `"use cache"` directives missing a subsequent `cacheTag`:

```
src/app/(shop)/products/[slug]/page.tsx:71 — "use cache"; 72 cacheLife("minutes"); — NO cacheTag
src/app/(admin)/admin/dashboard/analytics-data.ts:50/100/151/192 — "use cache"; cacheLife only, no cacheTag
```

These 5 sites DO omit `cacheTag`, but they are intentional: PDP detail caches are per-slug (no tag needed — ISR path) and admin analytics are session-scoped (never invalidated via tag). **No P0/P1 action**; non-blocking observation preserved for future Trace cycles.

### Row V — Lint `0w/0e` milestone: 30 consecutive commits

C4869 Lead supervision notes the zero-warning / zero-error lint streak now stands at **30 consecutive commits** through `382de66` (head of #513 cart CLS fix). Re-verified in this audit pass:

```
$ npm run lint
[BABEL] Note: The code generator has deoptimised the styling of .../font-data.ts as it exceeds the max of 500KB.
(exit 0, no eslint output)
```

The babel deopt note on `src/lib/invoice/font-data.ts` is a transient info line from the parser on the vendored PDF font blob — not an eslint diagnostic, does not count against 0w/0e. **Milestone holds.** The guard for future cycles: any commit that introduces an eslint warning or error terminates the streak, regardless of whether it's a functional issue. Keep tripwire grep ready for cycle end: `npm run lint 2>&1 | grep -E '^\S+\s+[0-9]+:[0-9]+' | wc -l` must return 0.


