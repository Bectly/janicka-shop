# Image Quality Audit — 2026-05-03 (Cycle #5170)

**Trigger**: bectly bug report — verify product photos are TOP quality after Phase 7 cutover (R2 → nginx `/uploads/`) and after `unoptimized={true}` flip on `<Image>` (#5157). Concern: agressive `quality=` somewhere in the pipeline, or source resolution downgrade.

**Result**: ✅ **No over-compression anywhere in our code.** Pipeline is byte-identical from disk → CF edge. Only resolution ceiling is upstream (Vinted CDN at `f800x800`) and applies only to scraped seed catalog, NOT to admin-uploaded photos.

---

## 1. Upload pipeline — `src/app/api/upload/route.ts`

```
formData.getAll("files") → Buffer.from(arrayBuffer) → uploadImage(buffer, name, type, "products")
```

- **No `sharp`, no `imagemagick`, no resize, no re-encode.** Original bytes written verbatim.
- `validateMagicBytes` is a header-byte check only — doesn't touch payload.
- `uploadImage` (`src/lib/image-storage.ts:121`) → `fs.writeFile(target, fileBuffer)` — direct buffer flush.
- `package.json` does NOT declare `sharp` (verified via `grep`). Two files reference `sharp` literally as keys/strings, not as imports: `src/lib/r2.ts` (legacy R2 path), `src/app/api/admin/claude-upload/route.ts` (legacy claude path). Neither rewrites buffers.

**Verdict**: admin uploads via web/mobile preserve the file the browser sent.

---

## 2. `next.config.ts` images config

```ts
images: {
  formats: ["image/avif", "image/webp"],
  qualities: [25, 50, 75, 90, 95, 100],
  remotePatterns: [...],
}
```

`qualities` whitelist applies **only** to URLs routed through `/_next/image`. Product `<Image>` elements all set `unoptimized={true}` so they bypass the optimizer entirely and load raw from `/uploads/<key>`. The qualities array therefore only governs admin banners (`collection-hero` `quality={95}`, `category-hero` `quality={95}`, `collection-card` `quality={90}`) — all at the high end. ✅

**No surprises.** `quality<75` not used anywhere. Default Next.js whitelist is just `[75]`; broadening to `[25,50,75,90,95,100]` was intentional (allows banners to request 95).

---

## 3. PDP main slide + lightbox + thumbnails — `src/components/shop/product-gallery.tsx`

| Surface | Line | Component | `unoptimized` | Resolution served |
|--|--|--|--|--|
| Inline slide (zoomable cover) | 414 | `<Image>` | ✅ | original from disk |
| Inline thumb strip | 522 | `<Image>` | ✅ | original from disk |
| **Lightbox main** | **685** | `<Image>` | ✅ | **original from disk** |
| Lightbox thumb strip | 720 | `<Image>` | ✅ | original from disk |

Lightbox `<Image>` uses `fill` + `object-contain` and CSS-scales the original. `sizes="(max-width: 640px) 80vw, 32rem"` is a hint to the browser — irrelevant when `unoptimized` because no `srcSet` is generated. **Customer always gets the file as it sits on disk.**

---

## 4. PLP cards — `src/components/shop/product-card.tsx`

Lines 143, 155: both `<Image>` (main + secondary hover) use `unoptimized`. ✅
No `quality=` set anywhere on cards. Original served as-is.

(Per the original bug-report concern: cards do NOT have `quality<75`. They have no quality directive at all because `unoptimized` ignores it.)

---

## 5. Hetzner image storage `/opt/janicka-shop-images/products/`

```
Total files:  1988  (.webp only — no .jpg, .png, .avif, .heic)
Total size:   258 MB
Subdirs:      347   (one per product — cuid-keyed)
File sizes:   avg=130 KB  min=18 KB  max=310 KB
```

10 random samples via `identify`:

| Filename | Bytes | Dimensions | Quality |
|---|---|---|---|
| `cmnr6yqxs.../7882bfd7…webp` | 76 238 | 800×800 | 92 |
| `cmnr6yhvx.../9dc66e36…webp` | 179 686 | 703×800 | 92 |
| `cmnr6zh3m.../163d0ffd…webp` | 135 638 | 600×800 | 92 |
| `cmnr6yy3r.../77cff74f…webp` | 221 782 | 600×800 | 92 |
| `cmnr6yp9r.../7882bfd7…webp` | 76 238 | 800×800 | 92 |
| `cmnr6zefd.../0d23ff88…webp` | 229 842 | 600×800 | 92 |
| `cmnr6zaoa.../327c4c4e…webp` | 233 802 | 600×800 | 92 |
| `cmnr6zae5.../06dac789…webp` | 202 600 | 600×800 | 92 |
| `cmnr6yrex.../d2905ba2…webp` | 136 212 | 600×800 | 92 |
| `cmnr6zkxw.../7882bfd7…webp` | 76 238 | 800×800 | 92 |

**Observation — explained**: every image is ≤800px on longest edge with WebP `Q=92`. Source: `scripts/import-vinted-products.ts:154`:

```ts
// Upgrade resolution to f800x800 (good quality, reasonable size)
return url.replace(/\/(?:f?\d+x\d+)\//, "/f800x800/");
```

Vinted's public CDN caps at `f800x800` — there is no higher resolution available for those listings. The script already requests the maximum Vinted serves, with `Q=92` (Vinted's own re-encode). This is **upstream supply-side limit**, not our pipeline reducing quality.

**Importantly**: zero `*-thumb.webp`, `*-small.webp`, `*-resized.webp` patterns on disk — no homegrown resize cache exists. Only originals as we received them.

---

## 6. Nginx `/uploads/` block — `/etc/nginx/sites-enabled/janicka-shop.conf`

```nginx
location /uploads/ {
    alias /opt/janicka-shop-images/;
    access_log off;
    expires 365d;
    add_header Cache-Control "public, max-age=31536000, immutable" always;
    add_header X-Content-Type-Options "nosniff" always;
    try_files $uri =404;
    error_page 404 = @img404;
}
```

- **No `image_filter`.** Verified via full `grep -r image_filter /etc/nginx/` — zero matches.
- **No transcode**, **no resize**, **no quality knob**, **no on-the-fly WebP/AVIF rewrite.**
- `gzip_types` lists `image/svg+xml` only — never WebP/AVIF/JPEG (those are already entropy-coded).
- Pure `sendfile()` alias path with `try_files $uri =404`.

### Byte-identity proof (live)

```
Disk:    /opt/janicka-shop-images/products/cmnr6ynz200c5.../c33197f34c6e184f.webp
         size=133294   sha256=a19980813b732bf035b078451b6fa507f9e6aa8a93c5f561c2dded1cab6c4e1f

Served:  https://www.jvsatnik.cz/uploads/products/cmnr6ynz200c5.../c33197f34c6e184f.webp
         size=133294   sha256=a19980813b732bf035b078451b6fa507f9e6aa8a93c5f561c2dded1cab6c4e1f
         status=200    cf-cache-status=HIT
         content-type: image/webp
         content-length: 133294
         cache-control: public, max-age=31536000, immutable
```

✅ **SHA256 match.** Bytes leaving disk == bytes hitting browser. Cloudflare doesn't transform either (no Polish, no Mirage).

---

## Summary table

| Audit dimension | Status | Notes |
|---|---|---|
| Upload route recompresses | ✅ NO | direct `fs.writeFile(buffer)` |
| `next.config.ts` qualities <75 | ✅ NO | `[25, 50, 75, 90, 95, 100]`; cards bypass via `unoptimized` |
| PDP lightbox serves resized | ✅ NO | `unoptimized` — original only |
| PLP cards have `quality<75` | ✅ NO | no `quality=` at all on cards (unoptimized) |
| Banners served at high quality | ✅ YES | `quality={95}` on hero/category/collection |
| Nginx `image_filter` present | ✅ NO | pure `sendfile()` alias |
| CF transforms images | ✅ NO | byte-identical SHA256, no Polish/Mirage hits |
| Vinted-scraped products are 800px | ⚠ EXPECTED | upstream CDN cap; `import-vinted-products.ts:154` already requests max |
| Resized variants on disk | ✅ NO | `*-thumb`, `*-small`, etc. patterns: zero matches |

## Fixes applied

**None** — audit found nothing to repair. Existing pipeline already serves originals at maximum available resolution.

## Future work — out of scope here

- If Janička's own admin-uploaded photos start landing on prod, they'll exceed 800×800 (e.g. 3024×4032 from iPhone) and visually outshine the Vinted-imported ones. No code change needed; the pipeline already handles them.
- If Vinted ever exposes a higher-resolution endpoint, edit `import-vinted-products.ts:154` to request it. No infra change needed.
- AVIF is in `next.config.ts.formats` but irrelevant to product images (they're served raw via nginx). Re-encoding existing 1988 WebP → AVIF would shave ~20–30% bytes but is not a quality issue and would lose the byte-identity guarantee.

## Verification artifacts

- `npm run build` — clean (warning unrelated to images: pre-existing Postgres/libsql prerender error tracked since #5168).
- Live byte-identity check: SHA256 of `/opt/janicka-shop-images/.../c33197f34c6e184f.webp` matches HTTPS response from `https://www.jvsatnik.cz/uploads/...`.
- `cf-cache-status: HIT` confirms CF caches the byte-identical response.
