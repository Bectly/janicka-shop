---
name: Admin panel and schema state (Cycle #10)
description: Current state of admin panel, Prisma schema, auth, and image upload as of Cycle #10 audit
type: project
---

Admin panel covers: dashboard, product list, new product, edit product, login. No orders/customers/settings pages yet.

Schema has all core second-hand fields: condition (4 values), brand, sizes (JSON), compareAt (originalPrice), category. No `originalPrice` field by that name — it is `compareAt`. No dedicated `size` scalar — stored as JSON array `sizes`.

No Prisma migrations directory. Schema is applied via `prisma db push` only (dev.db present).

No image upload mechanism implemented. `images` field exists in schema (JSON string) and is wired in seed data, but ProductForm has no upload UI — hardcoded to `"[]"` on create, not updated on edit.

AUTH_SECRET in .env is a placeholder ("development-secret-change-in-production"). Must be rotated before prod deploy.

**Why:** Second-hand model with unikát pieces fully represented in schema, but admin panel is incomplete — missing orders, customers, settings sections, and image upload.

**How to apply:** When auditing next cycle, check if orders/customers/settings admin pages were added and if image upload (UploadThing or Cloudinary) was wired into ProductForm.
