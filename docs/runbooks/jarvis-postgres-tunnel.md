# JARVIS → Hetzner Postgres tunnel (autossh)

**Status: tunnel live 2026-05-03 (cycle #5212 task #996).** Bectly machine maintains a persistent encrypted forward to the Hetzner Postgres so JARVIS can read/write `janicka_shop` over loopback.

## Topology

```
┌──────────────────┐                    ┌────────────────────────┐
│ bectly fedora    │   SSH (autossh)    │ root@46.224.219.3      │
│ 127.0.0.1:5433   │ ─────────────────→ │ 127.0.0.1:5432 (PG 16) │
└──────────────────┘                    └────────────────────────┘
```

- Local listen: `127.0.0.1:5433` and `[::1]:5433`
- Remote target: `127.0.0.1:5432` on `46.224.219.3` (Postgres only listens on loopback)
- SSH user: `root`, key `~/.ssh/kryxon_hetzner`

## Files

| File | Purpose |
|---|---|
| `~/.ssh/config` (Host `hetzner-postgres-tunnel`) | identity + keepalive options |
| `~/.config/systemd/user/jarvis-postgres-tunnel.service` | runs `autossh -M 0 -N -L 5433:127.0.0.1:5432 hetzner-postgres-tunnel` |
| `~/.claude/jarvis-gym/jarvis.toml` `[postgres_sync]` | port + role + alias config consumers can read |

## Why `-M 0`

`autossh-1.4g-15.fc41` passes `-M <port>` straight through to `ssh`, which then interprets `-M` as `ControlMaster` (no arg) and treats the port number as the destination host — silently breaks the local forward. `-M 0` disables autossh's monitor port; combined with `ServerAliveInterval=30 / ServerAliveCountMax=3` and systemd `Restart=always`, dead connections are detected within ~90 s and the unit is respawned by systemd.

## Operate

```bash
systemctl --user status jarvis-postgres-tunnel.service
systemctl --user restart jarvis-postgres-tunnel.service
SYSTEMD_PAGER=cat journalctl --user -u jarvis-postgres-tunnel.service -n 50 --no-pager

# quick connectivity probe (uses existing janicka role, just to verify the tunnel)
PGPASSWORD='<from api_keys hetzner-postgres>' \
  psql -h 127.0.0.1 -p 5433 -U janicka -d janicka_shop -c "SELECT 1"
```

## Required Postgres GRANTs (BECTLY ACTION)

The acceptance check uses a `jarvis_writer` role that does **not yet exist** on the Hetzner cluster — only `janicka` (the app role) is provisioned. Run the following on the VPS once you can supervise:

```bash
ssh root@46.224.219.3
sudo -u postgres psql -d janicka_shop <<'SQL'
-- 1) Create role with a strong password (store in JARVIS DB api_keys, name='hetzner-postgres-jarvis-writer').
CREATE ROLE jarvis_writer LOGIN PASSWORD 'CHANGE_ME_STRONG_PASSWORD' NOSUPERUSER NOCREATEDB NOCREATEROLE;

-- 2) Read everything in the public schema (where Prisma puts tables).
GRANT CONNECT ON DATABASE janicka_shop TO jarvis_writer;
GRANT USAGE ON SCHEMA public TO jarvis_writer;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO jarvis_writer;
GRANT SELECT, USAGE ON ALL SEQUENCES IN SCHEMA public TO jarvis_writer;

-- 3) Write only the JARVIS-owned tables (keep eshop tables read-only for safety).
--    Adjust the table list once the manager-sync architecture finalises which tables JARVIS writes.
--    Phase 1 candidate set:
--      ManagerArtifact, ManagerNote, ManagerActivity
GRANT INSERT, UPDATE, DELETE ON "ManagerArtifact", "ManagerNote", "ManagerActivity" TO jarvis_writer;

-- 4) Default privileges so future Prisma migrations keep the role usable.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT ON TABLES TO jarvis_writer;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, USAGE ON SEQUENCES TO jarvis_writer;

-- 5) pg_hba.conf already allows host=127.0.0.1 with scram-sha-256 — no change needed.
SQL
```

After GRANT, register the password in JARVIS DB:

```bash
sqlite3 ~/.claude/jarvis-gym/jarvis.db <<SQL
INSERT INTO api_keys (category, name, service, key_value, endpoint)
VALUES ('hetzner', 'hetzner-postgres-jarvis-writer', 'postgresql',
        'CHANGE_ME_STRONG_PASSWORD',
        'postgresql://jarvis_writer:CHANGE_ME_STRONG_PASSWORD@127.0.0.1:5433/janicka_shop');
SQL
```

Then verify acceptance criterion 1:

```bash
PGPASSWORD='CHANGE_ME_STRONG_PASSWORD' \
  psql -h 127.0.0.1 -p 5433 -U jarvis_writer -d janicka_shop -c "SELECT 1"
# expect:  ?column? = 1
```

## Verified this cycle (#5212)

- `systemctl --user status jarvis-postgres-tunnel.service` → `active (running)`
- `psql -h 127.0.0.1 -p 5433 -U janicka -d janicka_shop -c "SELECT 1"` → `1` (proxy proven; `inet_server_addr() = 127.0.0.1, port = 5432` confirms remote loopback)
- Manual `kill <ssh-child>` ×2 → systemd respawned the unit and reopened the forward in ≤8 s each time (counter at 2 in the journal).
- Idle survival: `ServerAliveInterval=30` + `ServerAliveCountMax=3` keeps the tunnel up well past 5 min idle; systemd would respawn within ~90 s if the keepalive fails.

## Open

- `jarvis_writer` role + GRANT (above) — bectly action.
- Decide which tables JARVIS may write to in the manager-sync architecture (currently a placeholder list).
- Move SSH from `root@` to a dedicated low-privilege user once a non-root tunnel account exists on the VPS.
