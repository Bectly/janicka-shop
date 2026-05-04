---
name: Collection banners visual audit 2026-05-04
description: Full audit of collection-card.tsx, collection-hero.tsx. 6 fixes implemented, 2 followup tasks open.
type: project
---

Audit provedena na žádost bectly ("moc se mi nezdají ty bannery těch kolekcí").

**Implemented fixes (all in one session, build EXIT=0):**
1. CollectionCard: `hover:shadow-lg` → branded pink shadow `rgba(180,130,140,0.20)` + `duration-300` → `duration-500` + `hover:-translate-y-0.5` → `hover:-translate-y-1` + added `haptic-press`
2. CollectionCard: gradient overlay `via-black/15` → `via-black/25` for better WCAG contrast on count pill
3. CollectionCard: CTA "Prohlédnout →" text removed, kept only arrow glyph (whole card is the link — text was redundant noise)
4. CollectionCard: padding `p-4 sm:p-5` → `p-4 lg:p-5` (sm breakpoint was tightest, freed 4px)
5. CollectionHero: added `min-h-[260px] sm:min-h-[320px] lg:min-h-[380px]` for consistent hero height
6. CollectionHero: watermark opacity `0.03` → `0.05` (was visually dead)

**Open followup tasks (not implemented — need bectly decision):**
A. CollectionCard aspect ratio on sm breakpoint: `aspect-[4/3]` at 2-col sm grid = 127px card height, text still tight. Options: tall card (`sm:aspect-[3/4]`), or expand gradient coverage. Depends on real collection image content.
B. CollectionHero: convert scroll listener to CSS `animation-timeline: scroll()` pure CSS parallax (eliminates hydration pass). Safari 17.4+ support OK but needs testing.

**Why:** Collection editorial is key Janička differentiator vs Unimoda (which has no collections, just product dump). Visual weight of collection cards should match that positioning.
