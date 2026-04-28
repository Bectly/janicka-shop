# Hetzner Phase 7 — Image storage cutover R2 → /opt/janicka-shop-images (PREP)

**Status: ABSTRACTION LANDED, CUTOVER GATED.** Phase 7 is gated on Phases 2 (Postgres cutover #930), 3 (R2-as-backup #920), and 5 (hardening #922) closing — without the app actually running on Hetzner there is no local nginx to serve `/uploads/*`, and without rclone + backup buckets there is no nightly `/opt/janicka-shop-images → R2` mirror to act as the disaster-recovery copy.

This document is the deploy + acceptance + rollback plan for cycle #5149 task #933. The deliverables in the repo at this commit are:

```
src/lib/image-storage.ts              # backend abstraction (r2 default | local)
src/app/api/upload/route.ts           # uses uploadImage() instead of uploadToR2
docs/runbooks/image-storage-phase7.md # this file
```

The Phase 3 prep already shipped `scripts/hetzner/nginx-uploads.conf` (server block snippet) and `scripts/hetzner/janicka-backup-images.sh` (weekly mirror). Phase 7 wires the application to actually use them.

## Live pre-flight probe — 2026-04-28 (C5149 task #933)

Same `root@46.224.219.3` blockers as Phase 3 (#920) — Phase 7 cannot execute until Phase 3 unblocks.

| Check | State | Blocker? |
|---|---|---|
| Phase 2 app cutover (Turso → Hetzner Postgres) | ❌ app still on Turso/Vercel | YES (#930) |
| Phase 3 image migration (`/opt/janicka-shop-images` populated) | ❌ dir does not exist | YES (Phase 3 step 5) |
| Phase 3 nginx `/uploads/*` block deployed | ❌ snippet in repo, not in `/etc/nginx/sites-available/janicka-shop.conf` | YES (Phase 3 step 7) |
| Phase 3 backup-images timer healthy | ❌ unit not enabled | YES (Phase 3 § Deploy) |
| `IMAGE_STORAGE_BACKEND` env var present | ❌ not set in Vercel or Hetzner `.env.production` | NO at code level (default `r2`) — YES at cutover |
| Drafts pipeline still on R2 | ✅ intentional — see § Out of scope | — |

**Conclusion**: code abstraction is safe to land today (default backend = `r2` = exact current behavior). Cutover is a single env-var flip + nginx reload, gated on Phases 2/3/5.

## Why

Two-pronged motivation:

1. **User directive**: "kompletně na serveru". With R2 as live CDN, every image byte rendered to a customer is an external fetch. Phase 7 brings the serving stack onto Hetzner so the entire request path — DNS → nginx → app → DB → static assets — is local SSD.
2. **R2 cost ceiling**: free tier (10 GB storage + 1M Class-A ops/month) is fine at 252 MB / 1998 objects today, but Class-B read ops are billed at $0.36/M after 10M. As traffic grows the egress crossover point favours nginx-on-VPS.

After Phase 7, R2 keeps **two roles**:
- Backup target for `/opt/janicka-shop-images` (weekly rclone sync, Phase 3 `janicka-backup-images.sh`).
- Drafts staging during admin product creation (see § Out of scope below — out of cutover scope, refactored separately).

## What the abstraction does

`src/lib/image-storage.ts` exposes four functions that mirror the existing `r2.ts` API one-to-one:

| New (image-storage) | Old (r2) | Behavior diff |
|---|---|---|
| `uploadImage(buf, name, ct, folder?, key?)` | `uploadToR2(buf, name, ct, folder?, key?)` | Same return shape `{ key, url }`. Backend chosen at call time. |
| `buildImageUrl(key)` | `buildR2Url(key)` | Local backend prepends `IMAGE_PUBLIC_URL_BASE` (default `/uploads`). |
| `extractImageKey(url)` | `extractR2Key(url)` | Local backend matches `IMAGE_PUBLIC_URL_BASE`, falls back to R2 origin so historical links still resolve. |
| `getImagePublicUrlBase()` | `getR2PublicUrl()` | Same shape (no trailing slash). |

Backend selection is purely runtime via `IMAGE_STORAGE_BACKEND={r2|local}`. Anything other than `local` (including unset, empty, typo) falls back to `r2` — typos must not silently switch to filesystem writes that vanish on the next Vercel deploy.

The local backend writes to `LOCAL_IMAGES_DIR/<key>` (default `/opt/janicka-shop-images`) using the same key format the R2 backend produces (`<folder>/<uuid>-<sanitized-name>`) — switching the env does not change how new keys look, so existing DB rows and emitted URLs both keep resolving.

Path-traversal guard: keys are server-generated (UUID + sanitized basename) and `path.resolve` against the images dir is verified to stay inside it.

## Cutover prerequisites in order

Same supervised window as Phase 3 — these run together:

1. Close Phases 2/3/5 per their respective runbooks (`postgres-cutover-phase2.md`, `r2-backup-phase3.md`, `hetzner-hardening-phase5.md`).
2. Confirm `/opt/janicka-shop-images` exists and `rclone copy r2:janicka-shop-images-public /opt/janicka-shop-images` ran clean (Phase 3 § 5). Sanity: `du -sh /opt/janicka-shop-images` should match the bucket (~252 MB / 1998 objects today).
3. Confirm nginx `/uploads/*` block deployed and `curl -I https://janicka-shop.cz/uploads/<known-key>.webp` returns 200 + 1y immutable cache (Phase 3 § 7).
4. Confirm `janicka-backup-images.timer` is enabled and ran at least once (so today's writes will be in the next mirror window).
5. Set `IMAGE_STORAGE_BACKEND=local` and `IMAGE_PUBLIC_URL_BASE=https://janicka-shop.cz/uploads` in `/opt/janicka-shop/.env.production` via `scripts/hetzner/sync-env-hetzner.sh` (Phase 5 # 922 idempotent sync). `LOCAL_IMAGES_DIR` defaults to `/opt/janicka-shop-images` and only needs to be set if the path differs.
6. `pm2 restart janicka-shop` (or `systemctl restart janicka-shop` depending on Phase 2 supervisor choice).

## Deploy steps (T-0)

```bash
# 1. Gate-check: confirm prerequisites green.
ssh root@46.224.219.3 'test -d /opt/janicka-shop-images && \
  ls /opt/janicka-shop-images | head -3 && \
  systemctl is-active janicka-backup-images.timer && \
  curl -sk https://janicka-shop.cz/uploads/$(ls /opt/janicka-shop-images/products | head -1) -I | head -3'

# 2. Flip backend + URL base in .env.production.
ssh root@46.224.219.3 'cd /opt/janicka-shop && \
  printf "IMAGE_STORAGE_BACKEND=local\nIMAGE_PUBLIC_URL_BASE=https://janicka-shop.cz/uploads\n" >> .env.production && \
  echo "--- diff ---" && tail -3 .env.production'
# (Or use sync-env-hetzner.sh once IMAGE_STORAGE_BACKEND lands in JARVIS api_keys.)

# 3. Restart app.
ssh root@46.224.219.3 'pm2 restart janicka-shop && pm2 logs janicka-shop --lines 30 --nostream'

# 4. Smoke a fresh upload.
#    From admin UI: open /admin/products/new, upload one image.
#    Verify: returned URL starts with https://janicka-shop.cz/uploads/products/...
#    Verify: file exists at /opt/janicka-shop-images/products/<key>
ssh root@46.224.219.3 'ls -lat /opt/janicka-shop-images/products | head -5'

# 5. Smoke an existing product (DB key resolves to new URL prefix).
curl -sI https://janicka-shop.cz/uploads/products/<existing-key>.webp | head -5
# Expect: 200, Cache-Control: public, max-age=31536000, immutable, ETag, X-Powered-By absent
```

## Acceptance criteria

| Check | Pass condition |
|---|---|
| Backend = local at runtime | `pm2 logs janicka-shop` shows env-check log line "image backend: local" within 60s of restart (env-check follow-on) |
| New uploads land on disk | `inotifywait /opt/janicka-shop-images/products` fires within 2s of an admin upload; file size matches request body |
| Existing product URLs resolve | Pick 5 random products; `curl -I` each image URL returns 200 from nginx (no `X-Powered-By: Next.js`) |
| Cache headers correct | `Cache-Control: public, max-age=31536000, immutable` + ETag on every `/uploads/*` response |
| R2 reads stop | `wrangler r2 bucket sql 'SELECT COUNT(*) FROM events WHERE bucket="janicka-shop-images" AND action="get_object" AND timestamp > now()-INTERVAL '1 hour''` trends to 0 over the next hour (Cloudflare R2 audit log; replace with bucket-analytics dashboard if SQL not enabled) |
| Backup timer healthy | `systemctl status janicka-backup-images.timer` shows next run within 7 days; last run exit=0 |
| R2 public bucket can be sealed | After 7-day cooldown: change `r2:janicka-shop-images-public` to private; confirm site still serves all images |

## Out of scope (intentional, refactored separately)

The drafts pipeline (admin/claude-upload, admin/drafts/[batchId]/publish, cron/cleanup-drafts) and the inbound-mail attachment persist (`src/lib/email/inbound-persist.ts`) **stay on R2** in this commit. They use list/copy/delete operations across thousands of orphaned drafts; refactoring them adds non-trivial code (filesystem walk, atomic move, list pagination) that doesn't belong in the same commit as the simple URL-prefix flip.

Two acceptable strategies for the follow-up PR:

- **Option A — drafts stay on R2 forever**: cheapest; drafts are throwaway (24h cleanup), R2 free tier easily covers them. Only the published-product writes go local. Requires `r2.ts` to keep working alongside `image-storage.ts`.
- **Option B — drafts also go local**: completes the "kompletně na serveru" directive. Need `localList(prefix)`, `localCopy(src, dest)`, `localDelete(key)` in `image-storage.ts` + audit each caller for atomicity (drafts publish must be all-or-nothing across N images).

Recommend **Option A** unless R2 free tier headroom shrinks — keeps the cutover surface area small.

## Rollback

### New uploads land on disk but customer-facing reads break

Symptoms: `/uploads/<key>` returns 404 or 5xx for any new upload.

```bash
# 1. Revert backend env.
ssh root@46.224.219.3 'cd /opt/janicka-shop && \
  sed -i "/^IMAGE_STORAGE_BACKEND=/d; /^IMAGE_PUBLIC_URL_BASE=/d" .env.production && \
  pm2 restart janicka-shop'

# 2. Hand-migrate any uploads that landed locally back to R2 (keys identical).
ssh root@46.224.219.3 'rclone copy /opt/janicka-shop-images r2:janicka-shop-images-public --include "products/**"'

# 3. URLs revert to *.r2.dev next render. New uploads go back to R2. Investigate.
```

### Historical *.r2.dev URLs in emitted emails break

Mitigation built-in: `extractImageKey` falls back to `extractR2Key` for the local backend, and the R2 public bucket is kept read-only for 7 days post-cutover (Phase 3 § 5). Customer email recipients will keep resolving the old URLs through R2 during that window.

For long-term safety, optionally configure a Cloudflare Workers rule on the R2 public origin: `pub-88d95c0ca85d4cb999122434d83fb3c9.r2.dev/*` → 301 → `https://janicka-shop.cz/uploads/$1`. One-line worker, removes the 7-day cliff.

### Disk fills

Symptoms: `df -h /opt` >85%.

```bash
# 1. Confirm growth source (drafts vs products).
ssh root@46.224.219.3 'du -sh /opt/janicka-shop-images/* | sort -h'

# 2. Drafts >24h old should be auto-cleaned by cron/cleanup-drafts. If they
#    were ported to local in the follow-up PR and the cron didn't run,
#    force a run.
curl -X POST https://janicka-shop.cz/api/cron/cleanup-drafts -H "Authorization: Bearer $CRON_SECRET"

# 3. If product images themselves are the source, image-size cap on upload
#    (MAX_IMAGE_SIZE = 4 MB in api/upload/route.ts) should already bound this.
#    At 4 MB × 1998 objects = 8 GB max even at full saturation. Hetzner SSD
#    has way more headroom than that.
```

## Open questions before deploy

- **CSP**: `img-src` and `connect-src` in `next.config.ts` currently allow `pub-88d95c0ca85d4cb999122434d83fb3c9.r2.dev`. Same-origin `/uploads/*` is already covered by `'self'`. After 7-day cooldown the R2 origin can be removed from CSP — small follow-up commit, safe to defer.
- **`next.config.ts` remotePatterns**: keep R2 entry during the 7-day cooldown so `<Image>` doesn't reject historical URLs while emails-in-flight resolve. Remove in the same follow-up that strips R2 from CSP.
- **Vercel**: this cutover is Hetzner-only. Vercel deploys keep `IMAGE_STORAGE_BACKEND` unset → R2 backend → no behavior change. The DR-failover plan (Phase 6, `dr-failover.md`) needs to know that R2 must stay live-readable for warm-DR Vercel to serve images during a Hetzner outage. Already noted there.
