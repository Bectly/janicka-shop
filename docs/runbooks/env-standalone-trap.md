# The Next.js standalone .env trap (and the auto-sync hook that fixes it)

**Status: live since cycle #5155 task #934. Required reading before any
post-build edit to `/opt/janicka-shop/.env.production` on Hetzner.**

## The trap

`next build` with `output: "standalone"` (Next.js 16) copies
`.env.production` from the repo root into `.next/standalone/.env.production`
**at build time**. The PM2-managed runtime (`node .next/standalone/server.js`)
reads env vars **only** from that bundled copy — it's resolved relative to the
process cwd, which is the standalone dir.

So this sequence silently breaks production:

```bash
ssh root@46.224.219.3
cd /opt/janicka-shop
echo "AUTH_TRUST_HOST=true" >> .env.production    # ← outer file edited
pm2 restart janicka-shop                           # ← restarts, reads STALE standalone copy
```

The outer edit lives in `/opt/janicka-shop/.env.production`. The runtime keeps
reading `/opt/janicka-shop/.next/standalone/.env.production`, which still has
the old contents. Result: silent prod misconfiguration. This caused the
2026-04-28 ~13:00 NextAuth 500 outage during Phase 7 cutover (~30 min until
manually fixed by `cp` of outer over standalone + restart).

## The fix

`scripts/hetzner/sync-env-standalone.sh` mirrors outer → standalone, atomically,
with the right ownership.

```bash
# Idempotent diff (exit 0 = clean, 1 = drifted, 2 = error)
/opt/janicka-shop/scripts/hetzner/sync-env-standalone.sh --check

# Apply (no-op if already in sync)
/opt/janicka-shop/scripts/hetzner/sync-env-standalone.sh --apply
```

After `--apply`, the standalone copy is `chown www-data:www-data`, `chmod 640`,
and identical to the outer file byte-for-byte.

## Auto-trigger via systemd .path watcher

Manual remembering doesn't scale. The `.path` unit in
`scripts/hetzner/systemd/` watches the outer file with inotify and fires the
matching `.service` on every modify. The service runs the sync script, then
issues `pm2 reload janicka-shop --update-env` so the change takes effect
immediately.

Install (one-time, on the Hetzner VPS):

```bash
sudo cp /opt/janicka-shop/scripts/hetzner/systemd/janicka-env-standalone-sync.{service,path} \
        /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now janicka-env-standalone-sync.path
sudo systemctl status janicka-env-standalone-sync.path     # expect: active (waiting)
```

Verify the watcher fires:

```bash
# Touching the file should trigger the .service within ~1–2s of the inotify event
# (the .service has a 1s coalescing sleep so editor write-then-rename settles first).
sudo touch /opt/janicka-shop/.env.production
sudo journalctl -u janicka-env-standalone-sync.service -n 20 --no-pager
sudo tail -5 /var/log/sync-env-standalone.log
```

You should see an `APPLIED:` line in the log if the file actually changed, or
`OK: already in sync` if nothing diverged.

## Operating rules

1. **Any time** you edit `/opt/janicka-shop/.env.production` post-build, the
   .path watcher will sync within seconds — but if the watcher is not yet
   installed, run `sync-env-standalone.sh --apply` manually before
   `pm2 restart janicka-shop`.
2. The hourly `sync-env-hetzner.sh` (Phase 5 timer) writes the outer file
   atomically — that mv triggers `IN_MODIFY` and the watcher catches it. So
   JARVIS-driven secret rotations are covered automatically.
3. **Never** edit `.next/standalone/.env.production` directly. The next
   `npm run build` will overwrite it from the outer file — your edit will
   vanish silently. Edit outer; let the watcher sync.
4. After every `npm run build`, the standalone copy is freshly built from
   outer → it's already in sync. No action needed.

## Why not fix Next.js?

Standalone-bundle env resolution is upstream Next.js behavior; patching it in
`next.config.ts` has no supported hook. The outer-vs-standalone divergence is
inherent to `output: "standalone"`. We treat it as deploy ergonomics, not a
framework bug.

## Out of scope (explicitly NOT touched by this hook)

- Consolidating `.env`, `.env.local`, `.env.production`, `.env.production.bak.*`
  into one canonical file. They serve different purposes (local dev / Vercel
  / VPS) and the bak files are intentional rollback breadcrumbs.
- Switching the supervisor from pm2 to systemd. The hook calls `pm2 reload` if
  pm2 is on PATH and silently no-ops otherwise; a future supervisor migration
  can swap the `ExecStartPost` line.
- Replacing `output: "standalone"` with a full-deps bundle. Larger change,
  separate task.

## Related

- `scripts/hetzner/sync-env-hetzner.sh` — pulls JARVIS api_keys → outer
  `.env.production` hourly. The .path watcher then mirrors outer → standalone.
- `docs/runbooks/postgres-cutover-phase2.md` § Step 5b — sync after env edit.
- `docs/runbooks/image-storage-phase7.md` § Step 5b — same.
- `docs/runbooks/dr-failover.md` § Env-var parity — same on Hetzner side.
