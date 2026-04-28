# Hetzner Phase 5 — Hardening & best practice (PREP, NOT YET EXECUTED)

**Status: SCRIPTS + CONFIG + RUNBOOK LANDED, NO HARDENING APPLIED ON BOX YET.** Cycle #5145 task #922.

Phase 5 is gated on:

1. **Phase 2 Postgres cutover** (task #919) — locking down Postgres to Tailscale-only is a no-op while the app still uses Turso for production writes; do this *after* the app is reading/writing the Hetzner Postgres so we know the deny rules don't break the live path.
2. **Phase 3 backup deploy** (task #920) — at least one green daily backup + green restore drill before we change auth/SSH/firewall, so a misstep that locks us out is recoverable from R2.
3. **Phase 4 DNS cutover** (task #921) — `securityheaders.com` and `ssllabs.com` test against `jvsatnik.cz`, which only resolves to Hetzner after Phase 4. Until then we test against the IP with `--resolve`.
4. A **supervised maintenance window** with bectly available — Phase 5 includes SSH port change + UFW lockdown, both of which can lock you out of your only remote shell.

This file is the deploy + acceptance + rollback plan; the hardening steps run via `scripts/hetzner/harden-phase5.sh` (idempotent, `--dry` by default).

## Current baseline (probed 2026-04-28 from this dev box)

```text
host:        46.224.219.3 (kryxon, Ubuntu 22.04.5 LTS aarch64)
ssh:         port 22, default sshd_config (root login allowed, password+key both)
ufw:         inactive
fail2ban:    not installed
tailscale:   not installed
unattended-upgrades: installed but status unknown
certbot:     installed (geo.kryxon.cz cert in use)
listening:
  0.0.0.0:80    nginx                    ← keep public
  0.0.0.0:443   nginx                    ← keep public
  0.0.0.0:22    sshd                     ← move behind Tailscale + rate-limit
  0.0.0.0:8001  uvicorn (geoplzen, NOT janicka)  ← lock to localhost or Tailscale
  127.0.0.1:6379 redis                   ← already local-only ✓
  127.0.0.1:5432 postgres                ← already local-only ✓
  127.0.0.1:3000 next                    ← already local-only ✓
nginx TLS:   ssl_protocols TLSv1 TLSv1.1 TLSv1.2 TLSv1.3   ← strip TLS1.0/1.1
nginx HSTS:  not present                 ← add Strict-Transport-Security
nginx CSP:   not present                 ← add CSP, X-Frame, Referrer-Policy, Permissions-Policy
```

Two notes from the probe:

- **`uvicorn` on :8001** belongs to the `geoplzen` project also hosted on this box, not to janicka-shop. Phase 5 lockdown should not break it; UFW rule allows :8001 from Tailscale CIDR only, and the operator (you) keeps console access via Tailscale. If geoplzen actually needs public :8001, exempt it explicitly in the UFW script.
- **The current SSL cert is `geo.kryxon.cz`**, not `janicka-shop.cz`. Phase 4 cutover assumes Phase 1's "Phase 2 certbot for janicka-shop.cz" was already done. If not, Phase 5 SSL hardening must wait for the right cert — otherwise `ssllabs.com` shows `Cert mismatch` regardless of TLS config.

## Hardening checklist — what each step does, why, how to roll back

### 1. UFW — default deny + rate-limited SSH

`scripts/hetzner/harden-phase5.sh ufw --live`

```bash
ufw default deny incoming
ufw default allow outgoing
ufw allow 80/tcp
ufw allow 443/tcp
ufw limit 2222/tcp  # new SSH port (see step 2). 6 conns / 30s before deny.
ufw allow in on tailscale0
ufw enable
```

The `limit` rule is the kernel-level brute-force throttle (covers script-kiddie scanners; fail2ban handles password-guess patterns). `allow in on tailscale0` is what keeps Postgres / Redis / uvicorn reachable from your laptop.

**Rollback:** `ufw disable`. Rules persist on disk; re-enabling restores them.

**Acceptance:**
```text
$ ufw status verbose
Status: active
Logging: on (low)
Default: deny (incoming), allow (outgoing), disabled (routed)
2222/tcp                   LIMIT       Anywhere
80/tcp                     ALLOW       Anywhere
443/tcp                    ALLOW       Anywhere
Anywhere on tailscale0     ALLOW       Anywhere
```

### 2. SSH — port 2222, key-only, no root password

`scripts/hetzner/harden-phase5.sh ssh --live`

Writes `/etc/ssh/sshd_config.d/99-janicka-hardening.conf`:

```text
Port 2222
PermitRootLogin prohibit-password
PasswordAuthentication no
PubkeyAuthentication yes
ChallengeResponseAuthentication no
KbdInteractiveAuthentication no
UsePAM yes
ClientAliveInterval 300
ClientAliveCountMax 2
MaxAuthTries 3
LoginGraceTime 20
AllowUsers root
```

**Drop-in not main config:** `sshd_config.d/*.conf` overrides take effect on `systemctl reload ssh` without touching the distro-managed `sshd_config`. Easier to revert.

**Hard order-of-operations rule (script enforces):**
1. Validate `~/.ssh/authorized_keys` is non-empty for root.
2. Run `sshd -t -f /etc/ssh/sshd_config` against the new drop-in.
3. Open new port in UFW *first* (`ufw limit 2222/tcp`).
4. Reload sshd.
5. Test from a *second* shell that `ssh -p 2222 root@host echo ok` works.
6. Only then `ufw delete allow 22/tcp` (script asks before this step).

**Rollback:** `rm /etc/ssh/sshd_config.d/99-janicka-hardening.conf && systemctl reload ssh`. Old port 22 + password auth come back.

### 3. fail2ban — sshd + nginx jails

`scripts/hetzner/harden-phase5.sh fail2ban --live`

Installs fail2ban, then drops `scripts/hetzner/fail2ban/jail.local` into `/etc/fail2ban/jail.d/janicka.local`:

```ini
[DEFAULT]
bantime = 1h
findtime = 10m
maxretry = 5
backend = systemd

[sshd]
enabled = true
port = 2222
maxretry = 3
bantime = 24h

[nginx-bad-bot]
enabled = true
port = http,https
filter = nginx-bad-bot
logpath = /var/log/nginx/access.log
maxretry = 1
bantime = 7d

[nginx-noscript]
enabled = true
port = http,https
filter = nginx-noscript
logpath = /var/log/nginx/access.log
maxretry = 6
bantime = 1d
```

Filter `nginx-bad-bot` matches User-Agents from `/etc/fail2ban/filter.d/nginx-bad-bot.conf` (shipped with fail2ban, contains AhrefsBot/SemrushBot/MJ12bot — janicka has no SEO need for these and they pull terabytes). `nginx-noscript` matches `\.(php|asp|aspx|jsp|cgi|exe|pl)` — janicka serves only Next.js, anyone scanning for those is hostile.

**Rollback:** `systemctl stop fail2ban && systemctl disable fail2ban`. Bans clear.

**Acceptance:**
```text
$ fail2ban-client status
Status
|- Number of jail:    3
`- Jail list:    nginx-bad-bot, nginx-noscript, sshd
```

### 4. Postgres — Tailscale-only network access

`scripts/hetzner/harden-phase5.sh postgres --live`

`pg_hba.conf` is already `local`+`127.0.0.1/32` from Phase 2 prep. Phase 5 adds the Tailscale CIDR (`100.64.0.0/10`) so you can connect from your laptop for ad-hoc queries:

```text
hostssl janicka_shop  janicka  100.64.0.0/10  scram-sha-256
```

`postgresql.conf`: `listen_addresses = 'localhost,tailscale0'` (script resolves `tailscale0` to its actual IPv4).

Public 0.0.0.0:5432 stays closed at both Postgres *and* UFW levels.

**Rollback:** revert `pg_hba.conf` and `postgresql.conf` from `*.bak.phase5` (script writes backups), `systemctl reload postgresql`.

### 5. Redis — requirepass + ACL user `app`

`scripts/hetzner/harden-phase5.sh redis --live`

`/etc/redis/redis.conf`:

```text
bind 127.0.0.1
requirepass <REDIS_PASSWORD from JARVIS api_keys redis-hetzner>
rename-command FLUSHALL ""
rename-command FLUSHDB  ""
rename-command CONFIG   ""
rename-command DEBUG    ""
```

ACL user (`/etc/redis/users.acl`):

```text
user default off
user app on >$REDIS_PASSWORD ~* +@read +@write +@stream +@list +@hash +@string +@keyspace -@dangerous
```

App reconnects with `REDIS_URL=redis://app:$REDIS_PASSWORD@127.0.0.1:6379/0`. The env-sync timer (step 10) propagates the password from JARVIS to `/opt/janicka-shop/.env`.

**Rollback:** swap `redis.conf` from `.bak.phase5`, restart redis.

### 6. nginx — TLS 1.2+/1.3 only, HSTS preload, OCSP, security headers, brotli

`scripts/hetzner/harden-phase5.sh nginx --live`

Script:
- Drops `scripts/hetzner/nginx-security.conf` into `/etc/nginx/snippets/janicka-security.conf`.
- Edits the janicka vhost to `include snippets/janicka-security.conf;` inside `server { listen 443 }`.
- Replaces the certbot-shipped `options-ssl-nginx.conf` line with the snippet's `ssl_protocols TLSv1.2 TLSv1.3` (strips TLSv1 / TLSv1.1).
- Installs `libnginx-mod-brotli` and adds brotli to the gzip block.
- Runs `nginx -t` before reload; aborts on test failure.

`scripts/hetzner/nginx-security.conf` content (security-headers core):

```nginx
ssl_protocols TLSv1.2 TLSv1.3;
ssl_prefer_server_ciphers off;
ssl_ciphers 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384';
ssl_session_timeout 1d;
ssl_session_cache shared:MozSSL:10m;
ssl_session_tickets off;
ssl_stapling on;
ssl_stapling_verify on;
resolver 1.1.1.1 8.8.8.8 valid=300s;
resolver_timeout 5s;

# HSTS — preload requires includeSubDomains + max-age >= 31536000
add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;

# Defence-in-depth headers
add_header X-Frame-Options                "SAMEORIGIN"          always;
add_header X-Content-Type-Options         "nosniff"             always;
add_header Referrer-Policy                "strict-origin-when-cross-origin" always;
add_header Permissions-Policy             "camera=(), microphone=(), geolocation=(self), payment=(self)" always;
add_header Cross-Origin-Opener-Policy     "same-origin"         always;

# CSP — Next.js needs unsafe-inline for hydration markers; nonce-based CSP is
# a future task, currently enforced via meta in app/layout.tsx for the strict
# parts. This header is the network-level baseline.
add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.vercel-insights.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://*.r2.dev https://imagedelivery.net; font-src 'self' data:; connect-src 'self' https://*.vercel-insights.com https://api.comgate.cz; frame-src 'self' https://payments.comgate.cz; object-src 'none'; base-uri 'self'; form-action 'self' https://payments.comgate.cz; frame-ancestors 'self'; upgrade-insecure-requests" always;
```

**HSTS preload note:** before submitting to `hstspreload.org`, all subdomains of `jvsatnik.cz` must be HTTPS-only. `jarvis-janicka.jvsatnik.cz` already is (proxied through CF tunnel). Don't preload until DNS Phase 4 is stable for at least 7 days — preload is a one-way door (removal takes weeks).

**Rollback:** swap vhost from `.bak.phase5`, `nginx -t && systemctl reload nginx`.

### 7. Certbot — auto-renewal via systemd timer

`scripts/hetzner/harden-phase5.sh certbot --live`

Ubuntu 22.04 ships `certbot.timer` already (runs twice a day). Phase 5 just adds a post-hook so nginx picks up renewed certs without operator intervention:

```bash
mkdir -p /etc/letsencrypt/renewal-hooks/post
cat > /etc/letsencrypt/renewal-hooks/post/reload-nginx.sh <<'EOF'
#!/bin/sh
nginx -t && systemctl reload nginx
EOF
chmod +x /etc/letsencrypt/renewal-hooks/post/reload-nginx.sh
```

**Acceptance:** `systemctl list-timers | grep certbot` shows next-run time; `certbot renew --dry-run` returns "Congratulations, all renewals succeeded."

### 8. logrotate — nginx, app, journald

`scripts/hetzner/harden-phase5.sh logrotate --live`

Drops `/etc/logrotate.d/janicka-shop`:

```text
/var/log/janicka-backup-db.log
/var/log/janicka-backup-images.log
/var/log/janicka-backup-restore-test.log
/var/log/janicka-sync-env.log
/var/log/janicka-audit-scan.log
{
    daily
    rotate 14
    compress
    delaycompress
    missingok
    notifempty
    copytruncate
}
```

nginx already has `/etc/logrotate.d/nginx` from the package (daily, 14 rotations, compressed).

journald: edits `/etc/systemd/journald.conf`:

```text
SystemMaxUse=500M
MaxRetentionSec=7day
ForwardToSyslog=no
```

`systemctl restart systemd-journald`.

### 9. unattended-upgrades — security patches + needrestart for kernel

`scripts/hetzner/harden-phase5.sh upgrades --live`

`/etc/apt/apt.conf.d/50unattended-upgrades`:

```text
Unattended-Upgrade::Allowed-Origins {
    "${distro_id}:${distro_codename}-security";
    "${distro_id}ESMApps:${distro_codename}-apps-security";
    "${distro_id}ESM:${distro_codename}-infra-security";
};
Unattended-Upgrade::Automatic-Reboot "false";
Unattended-Upgrade::Mail "";  # we use telegram via audit-scan instead
```

Reboot left manual on purpose — kernel updates on aarch64 Ubuntu have hit boot regressions before; we take the patch but pick the reboot window.

`/etc/apt/apt.conf.d/20auto-upgrades`:

```text
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
```

`needrestart` already installed; configured to interactively prompt only for non-security restarts.

### 10. Secrets sync — JARVIS api_keys → /opt/janicka-shop/.env

`scripts/hetzner/sync-env-hetzner.sh` runs hourly via `janicka-sync-env.timer`. It:

1. SSHes from the dev box (where JARVIS DB lives) to Hetzner.
2. Writes `/opt/janicka-shop/.env.next` from current api_keys values (atomic).
3. Diffs `.env.next` vs `.env`. If different: copies into place, runs `pm2 restart janicka-shop --update-env`, posts the *names of changed keys* (never values) to Telegram.
4. If same: silent.

**Why pull-from-JARVIS instead of push-to-server-on-rotate:** rotation can be triggered from anywhere (Vercel UI, Comgate dashboard, Stripe dashboard); the dev box reading JARVIS DB hourly catches any path. Push-on-rotate requires every rotation to remember to call us.

**Prerequisite — tag api_keys rows with `category='janicka-shop-prod'`:** the sync filters by this category. As of 2026-04-28 no rows are tagged with it (categories in DB: admin/ai/api/app/cloudflare/comm/database/db/email/infra/infrastructure/service). Before enabling the timer, run from dev box:

```sql
sqlite3 ~/.claude/jarvis-gym/jarvis.db <<EOF
UPDATE api_keys SET category='janicka-shop-prod' WHERE name IN (
    'DATABASE_URL',          -- hetzner-postgres translated to a DATABASE_URL row
    'REDIS_URL',
    'REDIS_PASSWORD',
    'NEXTAUTH_SECRET',
    'NEXTAUTH_URL',
    'COMGATE_MERCHANT',
    'COMGATE_SECRET',
    'PACKETA_API_KEY',
    'RESEND_API_KEY',
    'CLOUDFLARE_R2_ACCESS_KEY',
    'CLOUDFLARE_R2_SECRET_KEY',
    'CLOUDFLARE_R2_BUCKET',
    'CLOUDFLARE_R2_ENDPOINT',
    'TELEGRAM_BOT_TOKEN',
    'TELEGRAM_BECTLY_CHAT'
);
EOF
```

The sync will dry-run-fail without this tagging — that's the script's intentional safety check (line `grep -qE '^(DATABASE_URL|REDIS_URL|NEXTAUTH_SECRET)='`). Verify with `sync-env-hetzner.sh --dry` until it lists the expected key names.

**Acceptance:**

```bash
/usr/local/bin/sync-env-hetzner.sh --dry        # prints diff plan, no writes
systemctl list-timers | grep sync-env           # next run within 1h
journalctl -u janicka-sync-env -n 20            # recent runs
```

### 11. auditd — watch sensitive files, daily Telegram digest

`scripts/hetzner/harden-phase5.sh auditd --live`

Installs `auditd`, drops `/etc/audit/rules.d/janicka.rules`:

```text
-w /etc/passwd            -p wa -k passwd_changes
-w /etc/shadow            -p wa -k shadow_changes
-w /etc/ssh/sshd_config   -p wa -k sshd_changes
-w /etc/ssh/sshd_config.d -p wa -k sshd_changes
-w /etc/nginx             -p wa -k nginx_changes
-w /opt/janicka-shop/.env -p wa -k env_changes
-w /etc/sudoers           -p wa -k sudoers_changes
-w /etc/sudoers.d         -p wa -k sudoers_changes
```

Daily digest via `janicka-audit-scan.service` (in `scripts/hetzner/systemd/`):

```bash
ausearch -k passwd_changes -k shadow_changes -k sshd_changes \
         -k nginx_changes -k env_changes -k sudoers_changes \
         --start yesterday --end now \
  | aureport -i -f \
  | curl -s -X POST -d chat_id=$BECTLY_CHAT -d text="$(cat -)" \
         https://api.telegram.org/bot$TELEGRAM_TOKEN/sendMessage
```

Empty digest → no Telegram message (`if [ -s digest ] then send`). Goal is "if root touched .env without me knowing, I see it tomorrow morning."

## Cutover sequence

Run **in this order** during the supervised window — each step verifies before the next:

```bash
# Pre-flight (safe to run any time, no changes)
./scripts/hetzner/harden-phase5.sh all --dry

# T-0
ssh root@46.224.219.3 'apt update && apt install -y ufw fail2ban tailscale auditd libnginx-mod-brotli'
ssh root@46.224.219.3 'tailscale up --ssh --accept-routes'
# bectly: approve node in Tailscale admin, note the 100.x.y.z IP

./scripts/hetzner/harden-phase5.sh nginx        --live   # least risky, first
./scripts/hetzner/harden-phase5.sh logrotate    --live
./scripts/hetzner/harden-phase5.sh certbot      --live
./scripts/hetzner/harden-phase5.sh upgrades     --live
./scripts/hetzner/harden-phase5.sh auditd       --live
./scripts/hetzner/harden-phase5.sh fail2ban     --live
./scripts/hetzner/harden-phase5.sh postgres     --live   # after Tailscale up
./scripts/hetzner/harden-phase5.sh redis        --live   # then sync-env immediately
./scripts/hetzner/harden-phase5.sh secrets-sync --live   # installs sync-env timer
systemctl start janicka-sync-env.service                  # propagate REDIS_URL now

# Riskiest pair — run only when bectly has a second shell open via Tailscale SSH
./scripts/hetzner/harden-phase5.sh ssh          --live   # adds 2222, keeps 22 open
./scripts/hetzner/harden-phase5.sh ufw          --live   # opens 2222 + 80 + 443 + tailscale, blocks rest

# Verify second shell on :2222 still works, THEN:
./scripts/hetzner/harden-phase5.sh ssh-finalize --live   # closes 22
```

## Acceptance gate (ALL must pass)

| Test | Pass criterion |
|------|----------------|
| `ufw status verbose` | active, only 80/443/2222/tailscale0 in rules |
| `fail2ban-client status sshd` | jail active, find/ban counters working |
| `tailscale status` | online, kryxon node reachable from laptop |
| `psql -h <kryxon-tailscale-ip> -U janicka` from laptop | works |
| `psql -h 46.224.219.3 -U janicka` from laptop | times out (firewalled) |
| `ssh -p 22 root@46.224.219.3` | `Connection refused` |
| `ssh -p 2222 root@46.224.219.3` | works |
| `nginx -T \| grep ssl_protocols` | `TLSv1.2 TLSv1.3` only |
| `curl -sI https://jvsatnik.cz \| grep -i strict-transport` | `max-age=63072000; includeSubDomains; preload` |
| `curl -sI https://jvsatnik.cz \| grep -i content-security-policy` | header present |
| `securityheaders.com/?q=jvsatnik.cz` | grade A |
| `ssllabs.com/ssltest/analyze.html?d=jvsatnik.cz` | grade A or A+ |
| `journalctl _SYSTEMD_UNIT=ssh.service \| grep "Failed password"` | zero post-cutover (or all from banned IPs) |
| `systemctl list-timers \| grep janicka` | sync-env, audit-scan, backup-db, backup-images, restore-test all listed |
| `systemctl list-timers \| grep certbot` | certbot.timer enabled, next-run within 12h |

## Rollback decision tree

- **SSH lockout** → console.hetzner.cloud → noVNC → `rm /etc/ssh/sshd_config.d/99-janicka-hardening.conf && systemctl reload ssh`. UFW will still drop port 22 if step 11 already ran; `ufw disable` from console resolves.
- **App can't reach Postgres after `postgres --live`** → `cp /etc/postgresql/16/main/pg_hba.conf.bak.phase5 /etc/postgresql/16/main/pg_hba.conf && systemctl reload postgresql`.
- **App throwing 500 from Redis after `redis --live`** → ACL user mismatch with what the app reads from `.env`. Run `/usr/local/bin/sync-env-hetzner.sh --live` from dev box, then `pm2 restart janicka-shop --update-env`. If still broken: `cp /etc/redis/redis.conf.bak.phase5 /etc/redis/redis.conf && systemctl restart redis`.
- **HSTS broke a subdomain** → DON'T submit to preload list. The header alone (without preload submission) is browser-cached for max-age but only after the user has visited HTTPS once; removing the header on the server reduces blast radius to the cached duration. If preload was submitted: `hstspreload.org/removal/` → weeks-long process, ~zero rollback options. **This is why preload is a separate manual step after 7 days clean.**
- **Anything in nginx** → `cp /etc/nginx/sites-available/janicka-shop.conf.bak.phase5 /etc/nginx/sites-available/janicka-shop.conf && nginx -t && systemctl reload nginx`.

## Why this is gated, not run-now

All eleven steps are reversible per-step, but two are session-killers if the operator is alone (SSH port flip, UFW enable). The Phase 1-4 trail of `.bak.phase5` files lets us rebuild any one config from disk; what we can't rebuild is "I locked myself out at 02:14 Saturday." Phase 5 lands the scripts and the runbook now so the actual hardening is `./harden-phase5.sh <step> --live` from a known-good baseline once Phase 2/3/4 are in.
