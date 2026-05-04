---
name: Brand shadow token — pink glow, not generic shadow-lg
description: All card hover shadows must use the branded rgba(180,130,140,...) pink glow, not Tailwind shadow-lg
type: feedback
---

All interactive cards (product, collection, pick) must use the branded pink shadow on hover, not generic Tailwind utilities.

**Why:** ProductCard establishes the brand pattern: `hover:shadow-[0_20px_50px_-12px_rgba(180,130,140,0.22)]`. CollectionCard had `hover:shadow-lg` — visually inconsistent, broke brand cohesion. Fixed in 2026-05-04 audit.

**How to apply:** When writing or reviewing any card component with hover interaction, verify shadow uses `rgba(180,130,140,x)` family. Scale the blur/spread proportionally to the card size (product card = 50px blur, collection card = 40px blur).
