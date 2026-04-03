---
name: sold_filter_audit_cycle10
description: Cycle #10 audit — whether all public product queries filter sold:false, and cart race condition status
type: project
---

All public-facing Prisma product queries verified to include sold:false as of Cycle #10.

One LOW bug: generateMetadata in product detail page queries without sold:false (cosmetic — exposes title/description of sold items to crawlers/OG previews).

Cart race condition: no server-side stock check at checkout time. Purely client-side cart — sold status is never re-validated before order submission. This is a MEDIUM gap.

**Why:** Core second-hand model requires every item to be unique and fully hidden post-sale.

**How to apply:** Any new public product query must include `sold: false`. Checkout flow (when built) must re-validate sold status server-side before confirming order.
