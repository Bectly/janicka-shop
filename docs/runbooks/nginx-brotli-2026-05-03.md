# Origin nginx — Brotli + cache observability (kryxon)

Date: 2026-05-03 · Task #968 (Cycle #5183, Guard) · Source: docs/perf-reports/2026-05-03-summary.md (P7 + recommendation #6)

Two changes on the Hetzner origin (`root@46.224.219.3`, Ubuntu 22.04, nginx 1.18.0-6ubuntu14.10, arm64):

1. **`$upstream_cache_status` in access log** — observability for proxy_cache MISS/HIT/STALE/BYPASS without origin SSH.
2. **`ngx_brotli` dynamic module** — Brotli encoding for text assets, expected -15-20 % transfer on JS/CSS over gzip.

Cloudflare sits in front and re-compresses on its edge, so this affects origin → CF transfer only. CF currently fronts mostly DYNAMIC content for our app, so Brotli on origin reduces the bytes shipped on cache misses and on direct-to-origin requests.

---

## 1. log_format with cache status

### What changed
`/etc/nginx/nginx.conf`, http block:

```nginx
log_format combined_cache '$remote_addr - $remote_user [$time_local] "$request" '
                          '$status $body_bytes_sent "$http_referer" '
                          '"$http_user_agent" cs=$upstream_cache_status';
access_log /var/log/nginx/access.log combined_cache;
```

`$upstream_cache_status` is empty for non-proxied locations (e.g. `/uploads/`); it renders as `-` in logs (default nginx behaviour for empty vars in log_format with quoted strings — here it appears as `cs=` with no value, which is fine for awk parsing).

### Verification
```bash
# After reload, two homepage hits — second should hit:
curl -s -o /dev/null https://www.jvsatnik.cz/
curl -s -o /dev/null https://www.jvsatnik.cz/
tail -2 /var/log/nginx/access.log
# → cs=MISS … cs=HIT
```

### Cache hit ratio (one-liner)
```bash
tail -10000 /var/log/nginx/access.log | \
  awk '{ for(i=1;i<=NF;i++) if($i ~ /^cs=/) { sub(/^cs=/,"",$i); c[$i]++ } } END { for(k in c) printf "%-10s %d\n", k, c[k] }'
```
Empty values (non-proxied paths like `/_next/static/`, `/uploads/`) are tagged as `cs=` and skipped by the awk regex `/^cs=/` — adjust pattern if needed.

### Rollback
```bash
cp /etc/nginx/nginx.conf.bak.2026-05-03 /etc/nginx/nginx.conf
nginx -t && systemctl reload nginx
```
(Backup created before patch.)

---

## 2. ngx_brotli dynamic module

### Why dynamic
The Ubuntu nginx package is built with `--with-compat`, which makes dynamic modules built against any 1.18.x source ABI-compatible. We compile against upstream `nginx-1.18.0` source and load via `load_module` — package upgrades to nginx 1.18.x will keep working; an upgrade across minor version (1.20+) requires rebuilding the modules.

### Build steps (already executed)

```bash
# Build deps
DEBIAN_FRONTEND=noninteractive apt-get install -y \
  build-essential libpcre3-dev libssl-dev zlib1g-dev \
  brotli libbrotli-dev

# Source + module
mkdir -p /tmp/brotli-build && cd /tmp/brotli-build
wget https://nginx.org/download/nginx-1.18.0.tar.gz
tar xzf nginx-1.18.0.tar.gz
git clone --depth 1 --recursive https://github.com/google/ngx_brotli.git

# Configure + build (only modules, not full nginx)
cd /tmp/brotli-build/nginx-1.18.0
./configure --with-compat --add-dynamic-module=/tmp/brotli-build/ngx_brotli
make modules

# Install
cp objs/ngx_http_brotli_filter_module.so /usr/lib/nginx/modules/
cp objs/ngx_http_brotli_static_module.so /usr/lib/nginx/modules/
```

The compiled `.so` files dynamically link against system `libbrotlienc.so.1` and `libbrotlicommon.so.1` (verified via `ldd`), so `/tmp/brotli-build` can be cleaned up safely.

```bash
ldd /usr/lib/nginx/modules/ngx_http_brotli_filter_module.so
# libbrotlienc.so.1 => /lib/aarch64-linux-gnu/libbrotlienc.so.1
# libbrotlicommon.so.1 => /lib/aarch64-linux-gnu/libbrotlicommon.so.1
```

### Configuration

`/etc/nginx/modules-enabled/50-mod-http-brotli.conf` (new):
```nginx
load_module modules/ngx_http_brotli_filter_module.so;
load_module modules/ngx_http_brotli_static_module.so;
```

`/etc/nginx/nginx.conf`, http block, just under `gzip on;`:
```nginx
##
# Brotli Settings (added 2026-05-03 task #968)
##
brotli on;
brotli_static on;
brotli_comp_level 6;
brotli_types text/plain text/css text/xml text/javascript
             application/javascript application/x-javascript
             application/json application/xml application/xml+rss
             application/rss+xml application/atom+xml
             image/svg+xml font/ttf font/otf;
```

`brotli_static on` will serve `*.br` precompressed files when present (Next/build doesn't emit them today; on-the-fly compression covers the gap).

### Verification (origin-direct, bypass CF)

```bash
# Pick any /_next/static/chunks JS asset:
curl -sI -H 'Accept-Encoding: br' \
  --resolve www.jvsatnik.cz:443:127.0.0.1 -k \
  https://www.jvsatnik.cz/_next/static/chunks/<some>.js | grep -i content-encoding
# → content-encoding: br

curl -sI -H 'Accept-Encoding: gzip' \
  --resolve www.jvsatnik.cz:443:127.0.0.1 -k \
  https://www.jvsatnik.cz/_next/static/chunks/<some>.js | grep -i content-encoding
# → content-encoding: gzip   (fallback still works)
```

Through CF (depends on CF Accept-Encoding negotiation):
```bash
curl -sI -H 'Accept-Encoding: br' https://www.jvsatnik.cz/_next/static/chunks/<some>.js
# → content-encoding: br
```

Sanity numbers from the install run (small JS chunk, 30 510 B uncompressed):
- `Accept-Encoding: br`   → 8 947 B (-71 %)
- `Accept-Encoding: gzip` → 9 259 B (-70 %)
- no encoding              → 30 510 B

The gzip→brotli delta is ~3 % on this chunk; bigger gains on larger CSS/JS bundles.

### Rollback

```bash
# 1. Remove load_module conf
rm /etc/nginx/modules-enabled/50-mod-http-brotli.conf

# 2. Restore nginx.conf (or just delete the brotli block under gzip on;)
cp /etc/nginx/nginx.conf.bak.2026-05-03 /etc/nginx/nginx.conf

# 3. Validate + reload
nginx -t && systemctl reload nginx
```
The `.so` files in `/usr/lib/nginx/modules/` can stay — they're inert without `load_module`.

If `nginx -t` fails after the install (ABI mismatch on a future package upgrade), the safe path is the same: drop the `load_module` lines and reload. Rebuild against the new upstream source when ready.

---

## Files touched on origin

| Path | Change |
|---|---|
| `/etc/nginx/nginx.conf` | + `log_format combined_cache`, `access_log … combined_cache`, `brotli on/static/comp_level/types` |
| `/etc/nginx/nginx.conf.bak.2026-05-03` | backup of pre-patch config |
| `/etc/nginx/modules-enabled/50-mod-http-brotli.conf` | new — load_module directives |
| `/usr/lib/nginx/modules/ngx_http_brotli_filter_module.so` | new — compiled module |
| `/usr/lib/nginx/modules/ngx_http_brotli_static_module.so` | new — compiled module |

No app-side code changes; nothing in this repo to deploy.

## Followups

- Wire build-time Brotli pre-compression into the Next standalone tarball (next-gen-app/server.js already gzip-precompresses chunks; adding `.br` siblings would let `brotli_static` serve them without runtime CPU cost). Track as a separate Bolt task.
- Re-run Lighthouse mobile to capture the transfer-size delta against C5182 baseline (76/74 perf, 4.1 MB page weight).
