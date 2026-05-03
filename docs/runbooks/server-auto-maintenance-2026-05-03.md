# Hetzner server — automatic maintenance & uptime monitoring

**Setup date**: 2026-05-03
**Server**: `root@46.224.219.3` (Hetzner, Ubuntu 22.04.5 LTS, Linux 5.15)
**Domain**: `https://www.jvsatnik.cz` (CF proxy → nginx → PM2 :3000)
**Owner / on-call**: bectly (Telegram chat `8750673812`, bot `Jarvis_bectly_bot`)

## TL;DR — current state (2026-05-03)

| Concern              | Status     | Mechanism                                         | Last run / next        |
|----------------------|------------|---------------------------------------------------|------------------------|
| OS security updates  | ✅ auto    | `unattended-upgrades` 2.8 + `apt-daily*.timer`    | last 2026-05-03 06:05  |
| TLS cert renewal     | ✅ auto    | `certbot.timer` (twice daily)                     | next ~13h              |
| PM2 survives reboot  | ✅ auto    | `pm2-root.service` enabled (`pm2 resurrect`)      | dump.pm2 = 2026-04-28  |
| Log rotation (pm2)   | ✅ auto    | `/etc/logrotate.d/janicka` + `logrotate.timer`    | daily 00:00            |
| Uptime probe         | ✅ auto    | `janicka-uptime.timer` (1 min) → Telegram alert   | every 60 s             |

## State BEFORE this cycle

Audit on 2026-05-03 07:04:

* `unattended-upgrades 2.8ubuntu1` already installed, security pocket allowed (`jammy-security`, `UbuntuESMApps`, `UbuntuESM`). Last automatic run upgraded `kmod libkmod2` on 2026-05-02. ✅ no change needed.
* `certbot.timer` enabled since 2026-03-16, certs valid 42–45 days. ⚠ Certs are for `kryxon.cz` / `geo.kryxon.cz`; `jvsatnik.cz` is served via Cloudflare proxy with mismatched origin cert (Phase 1 hot-fix per `nginx/sites-enabled/janicka-shop.conf`). Out of scope for auto-maintenance — separate ticket #329 (Phase 2 cert).
* `pm2-root.service` enabled but inactive (normal — `Type=forking` with `pm2 resurrect`; daemon stays up via PM2 itself). `dump.pm2` saved → janicka-shop survives reboot.
* `nginx/1.18.0`, `node v22.22.1`, `npm 10.9.4`, `pm2 6.0.14`. Minor upgrade available `nodejs 22.22.2` from nodesource (manual upgrade — not in `unattended-upgrades` allow-list).
* Disk `/dev/sda1` 12 % used (8.6 G of 75 G). Plenty of headroom.
* Logs: `pm2/janicka-shop-error.log` already 105 K and growing — **no logrotate config existed**. `janicka-deploy.log` 1.7 K (small).
* No uptime probe of any kind.

## Changes applied

### 1. Logrotate for PM2 + deploy logs

`/etc/logrotate.d/janicka`:

```
/var/log/pm2/janicka-shop-error.log
/var/log/pm2/janicka-shop-out.log
/var/log/janicka-deploy.log
{
    daily
    rotate 14
    compress
    delaycompress
    missingok
    notifempty
    copytruncate
    create 0644 root root
}
```

`copytruncate` chosen — PM2 holds the fd open and would keep writing to the rotated inode otherwise.

Verify: `logrotate -d /etc/logrotate.d/janicka` parses clean.

### 2. Uptime probe + Telegram alert

`/usr/local/bin/janicka-uptime-check.sh` — pings `https://www.jvsatnik.cz/api/health` (8 s timeout, follows redirects). Treats `HTTP != 200` **or** `"ok":false` in body as down. State file `/var/lib/janicka-uptime.state` prevents repeat alerts; only edge transitions notify (down → up sends recovery message).

Credentials in `/etc/janicka-uptime.env` (mode 600):

```
TG_BOT=<bot token>
TG_CHAT=<chat_id>
```

Both from JARVIS DB row `api_keys.name='telegram-bot'`.

Systemd unit `/etc/systemd/system/janicka-uptime.service` (oneshot) + `janicka-uptime.timer` (`OnUnitActiveSec=1min`, `OnBootSec=2min`, `AccuracySec=15s`).

Enabled with `systemctl enable --now janicka-uptime.timer`.

First probe at 2026-05-03 07:04:34: `state=up http=200`.

To test alerting end-to-end (without breaking prod): run `pkill -STOP -f "next-server"` momentarily on the server, wait 90 s, expect Telegram red alert; resume with `pkill -CONT`. (Don't bother in normal operation — Telegram quiet means everything is fine.)

## Verification (`systemctl list-timers` snapshot)

```
NEXT                        UNIT                       ACTIVATES
2026-05-03 07:05:34 UTC     janicka-uptime.timer       janicka-uptime.service
2026-05-03 08:53:02 UTC     apt-daily.timer            apt-daily.service
2026-05-03 15:06:53 UTC     certbot.timer              certbot.service
2026-05-04 00:00:00 UTC     logrotate.timer            logrotate.service
2026-05-04 06:40:05 UTC     apt-daily-upgrade.timer    apt-daily-upgrade.service
```

```
$ systemctl is-enabled pm2-root             # → enabled
$ systemctl is-enabled janicka-uptime.timer # → enabled
$ systemctl is-enabled certbot.timer        # → enabled
$ systemctl is-enabled apt-daily-upgrade.timer # → enabled
```

## Known follow-ups (NOT in scope this cycle)

1. **Origin TLS cert mismatch** — nginx serves `geo.kryxon.cz` cert on jvsatnik.cz. Hidden by Cloudflare Full mode. Fix is ticket #329 / Phase 2: issue cert for `jvsatnik.cz` via certbot-cloudflare plugin (DNS-01 — needed because origin not directly reachable on :80).
2. **Node minor patch** — `22.22.1 → 22.22.2` available from nodesource. Nodesource repo not in unattended-upgrades allow-list; manual `apt upgrade nodejs && pm2 restart janicka-shop` when convenient. No CVE = no rush.
3. **Reboot test** — PM2 resurrect verified by config (`pm2-root.service` enabled, `dump.pm2` saved). Live reboot test deferred — would interrupt prod traffic; trust the systemd config until next planned maintenance window.
4. **Two-channel alerting** — currently Telegram-only. If Telegram API itself is down during an outage we'd be blind. Cheap upgrade: also POST to a free UptimeRobot endpoint as backup. Out of scope until first real incident teaches us we need it.

## Operating notes

* Telegram alert format: `🔴 jvsatnik.cz DOWN  HTTP=503` or `🟢 jvsatnik.cz UP  recovered after outage`.
* If alert noise becomes a problem, edit `OnUnitActiveSec` to `2min` or add an N-failure-in-a-row threshold to the script.
* Probe writes `journal -t janicka-uptime` every minute — useful for incident timelines.
* Disable for maintenance: `systemctl stop janicka-uptime.timer` (re-enable with `start`).
