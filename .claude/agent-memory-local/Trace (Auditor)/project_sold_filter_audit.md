---
name: sold_filter_audit_cycle10
description: Cycle #10 audit — whether all public product queries filter sold:false, and cart race condition status
type: project
---

All public-facing Prisma product queries verified to include `sold: false` as of Cycle #25.

Previously noted LOW bug (generateMetadata missing sold:false) is now FIXED — Cycle #25 confirmed both `generateMetadata` and the main page handler both include `{ slug, active: true, sold: false }`.

Cart race condition for un-cancellation TOCTOU was fixed in Cycle #21 (moved sold-check inside $transaction).

Outstanding gap from Cycle #25 audit: products/page.tsx fetches ALL matching products without a take cap, then paginates in JS. With size filter active, the Prisma query has no upper bound and loads every matching product into memory. For small catalogs this is fine; at scale it will OOM.

**Why:** Core second-hand model requires every item to be unique and fully hidden post-sale.

**How to apply:** Any new public product query must include `sold: false`. Checkout flow must re-validate sold status server-side. The products catalog query should eventually add a reasonable `take` cap or switch to DB-level pagination.
