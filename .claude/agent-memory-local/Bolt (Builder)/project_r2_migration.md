---
name: R2 Migration
description: UploadThing removed, Cloudflare R2 integrated for image/video storage. Bucket created April 2026. One manual step remaining — S3 API token.
type: project
---

UploadThing fully replaced with Cloudflare R2. Build is clean.

**Why:** UploadThing was $25/month with no token ever configured — no production upload path existed. R2 is free 10GB with no egress fees.

**Bucket:** `janicka-shop-images`, EEUR region (Eastern Europe for CZ latency)
**Public URL:** `https://pub-88d95c0ca85d4cb999122434d83fb3c9.r2.dev`
**Account ID:** `22f33409517699050d2eb775dab80565`

**ONE MANUAL STEP REMAINING:** Create S3-compatible API token at:
`dash.cloudflare.com → R2 → Manage R2 API Tokens → Create API Token`
Scope: bucket `janicka-shop-images`, permission: Object Read & Write
Then set `R2_ACCESS_KEY_ID` and `R2_SECRET_ACCESS_KEY` in `.env` (and Vercel env vars for production).

**How to apply:** When bectly asks about image upload or R2 status, check if the S3 token has been created yet by checking .env for non-placeholder values.
