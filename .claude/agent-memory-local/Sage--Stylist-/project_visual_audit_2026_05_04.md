---
name: Visual audit 2026-05-04 — full shop audit
description: Full-page visual audit (24 screenshots, 12 pages × 2 viewports). Key findings and status of Hero Phase 1.5.
type: project
---

Plošný audit provedený 2026-05-04. Screenshoty v docs/audits/visual-audit-2026-05-04/screenshots/.

**Hero Phase 1.5 (done, committed in cycle 5269+5278):**
- min-h-screen → min-h-[60vh] lg:min-h-[65vh]
- padding: py-10/24/32 → py-12/16/24
- logo: 280/400/520px → 200/280/360px
- tagline: text-2xl/3xl/4xl → text-xl/2xl/3xl

**CatalogHero / CategoryHero padding (done):**
- pt-20/24/32 → pt-12/16/20 in src/components/shop/category-hero.tsx

**Issues found and current status:**
1. CRITICAL — Privacy/Terms: [DOPLNIT IČO/JMÉNO/ADRESA] still live in production. Blocked on bectly providing real business data. Cycle #5275 confirmed, no code edit possible.
2. Collections empty on prod — den-matek-2026 only in dev DB. Cycle #5277 assessed, waiting bectly decision on seeding.
3. PDP mobile sticky ATC — already exists (mobile-sticky-atc.tsx, IntersectionObserver on #atc-sentinel). Cycle #5276 confirmed.
4. /about redesign — editorial hero with admin photo or monogram, pull-quote. Done in cycle #5278.
5. /rozmery table — BOKY column truncated on mobile (overflow). NOT fixed yet.
6. 404 page product with broken image — data issue (product has no photos), code handles correctly with initial letter fallback.

**Why:** Hero was full-screen (100vh) blocking peek-strip and pushing conversion content below fold. bectly explicitly asked for size reduction.

**How to apply:** When doing hero/category header work: reference these size targets. Don't regress py padding back to py-24/32 range without bectly approval.
