---
name: haptic-press class — required on all interactive cards
description: Every tappable card component must include haptic-press CSS class for touch feel consistency
type: feedback
---

All interactive card links (product-card, collection-card, pick-card, etc.) must include the `haptic-press` class.

**Why:** `haptic-press` is defined in globals.css and provides press-down tactile feedback on touch devices. CollectionCard was missing it while ProductCard had it — inconsistent touch UX. Found in 2026-05-04 audit.

**How to apply:** When writing any `<Link>` that acts as a card container, add `haptic-press` alongside the `group` class on the same element.
