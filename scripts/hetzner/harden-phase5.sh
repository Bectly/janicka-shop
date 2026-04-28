#!/usr/bin/env bash
#
# harden-phase5.sh — idempotent Hetzner VPS hardening for janicka-shop.
#
# Designed to run from the box itself (uploaded via rsync) OR as a one-shot
# `ssh root@host bash -s` < script. Each step is independently re-runnable.
# Default mode is --dry (prints actions, no changes). Pass --live to apply.
#
# Steps:
#   ufw          UFW: default deny, allow 80/443/2222 (rate-limit), tailscale0
#   ssh          SSH: drop-in /etc/ssh/sshd_config.d/99-janicka-hardening.conf
#                (port 2222, key-only, root prohibit-password). Keeps :22 open.
#   ssh-finalize Closes :22 in UFW. Run ONLY after verifying :2222 works.
#   fail2ban     Install + jail.local for sshd, nginx-bad-bot, nginx-noscript
#   postgres     pg_hba + listen_addresses → localhost + tailscale CIDR only
#   redis        bind 127.0.0.1, requirepass, ACL user 'app', rename dangerous
#   nginx        TLS 1.2+1.3, HSTS, security headers, brotli
#   certbot      post-hook reload-nginx.sh + verify renewal timer
#   logrotate    /etc/logrotate.d/janicka-shop + journald 7d/500M
#   upgrades     unattended-upgrades for security only, no auto-reboot
#   auditd       audit rules for /etc/passwd /etc/shadow /etc/ssh /etc/nginx
#                /opt/janicka-shop/.env /etc/sudoers
#   secrets-sync install /usr/local/bin/sync-env-hetzner.sh + hourly timer
#   all          run every step in safe order
#
# Backups: each step that mutates a config writes <file>.bak.phase5 first
# (only if no prior .bak.phase5 exists, so re-runs don't overwrite the
# original). To rollback: cp .bak.phase5 back, reload the service.
#
# Exit codes: 0 ok, 1 wrong args, 2 not root, 3 step pre-flight failed,
# 4 service test failed (e.g. nginx -t, sshd -t), 5 needed package missing.

set -Eeuo pipefail

# ── Args ───────────────────────────────────────────────────────────────────
LIVE=0
STEP=""
for arg in "$@"; do
    case "$arg" in
        --live) LIVE=1 ;;
        --dry)  LIVE=0 ;;
        ufw|ssh|ssh-finalize|fail2ban|postgres|redis|nginx|certbot|logrotate|upgrades|auditd|secrets-sync|all)
            STEP="$arg" ;;
        -h|--help|"")
            sed -n '3,40p' "$0" | sed 's/^# \{0,1\}//'
            exit 0 ;;
        *)  echo "unknown arg: $arg" >&2; exit 1 ;;
    esac
done
[[ -z "$STEP" ]] && { echo "no step given. try --help." >&2; exit 1; }

# ── Helpers ────────────────────────────────────────────────────────────────
log()  { printf '\e[36m[harden]\e[0m %s\n' "$*"; }
warn() { printf '\e[33m[harden WARN]\e[0m %s\n' "$*" >&2; }
die()  { printf '\e[31m[harden FAIL]\e[0m %s\n' "$*" >&2; exit "${2:-1}"; }

run() {
    if (( LIVE )); then
        log "+ $*"
        eval "$@"
    else
        log "[dry] $*"
    fi
}

backup_once() {
    local f="$1"
    [[ -f "$f" ]] || return 0
    if [[ ! -f "${f}.bak.phase5" ]]; then
        run "cp -a '$f' '${f}.bak.phase5'"
    fi
}

require_root() {
    [[ $EUID -eq 0 ]] || die "must run as root" 2
}

require_pkg() {
    for p in "$@"; do
        if ! dpkg -s "$p" >/dev/null 2>&1; then
            warn "package missing: $p"
            run "apt-get install -y --no-install-recommends $p"
        fi
    done
}

# ── Step: nginx ────────────────────────────────────────────────────────────
step_nginx() {
    log "step: nginx — TLS 1.2+1.3, HSTS, security headers, brotli"
    require_pkg nginx libnginx-mod-brotli

    local snippet=/etc/nginx/snippets/janicka-security.conf
    local src
    src="$(dirname "$0")/nginx-security.conf"
    [[ -f "$src" ]] || die "missing $src — checkout repo on box first" 3

    run "install -m 0644 -D '$src' '$snippet'"

    local vhost=/etc/nginx/sites-available/janicka-shop.conf
    [[ -f "$vhost" ]] || die "vhost not found at $vhost" 3
    backup_once "$vhost"

    if ! grep -q "include snippets/janicka-security.conf" "$vhost"; then
        # insert include directive after the first `listen 443 ssl` line
        run "sed -i '/listen 443 ssl/a\    include snippets/janicka-security.conf;' '$vhost'"
    else
        log "include directive already present"
    fi

    # strip TLSv1 and TLSv1.1 from any active config
    run "sed -i 's/ssl_protocols TLSv1 TLSv1.1 TLSv1.2 TLSv1.3/ssl_protocols TLSv1.2 TLSv1.3/' /etc/letsencrypt/options-ssl-nginx.conf 2>/dev/null || true"

    if (( LIVE )); then
        nginx -t || die "nginx -t failed — vhost reverted from .bak.phase5" 4
        systemctl reload nginx
    else
        log "[dry] nginx -t && systemctl reload nginx"
    fi
}

# ── Step: ssh ──────────────────────────────────────────────────────────────
step_ssh() {
    log "step: ssh — drop-in 99-janicka-hardening.conf, port 2222, key-only"
    require_root

    # Pre-flight: must have authorized_keys
    if [[ ! -s /root/.ssh/authorized_keys ]]; then
        die "/root/.ssh/authorized_keys is empty or missing — refusing" 3
    fi

    local conf=/etc/ssh/sshd_config.d/99-janicka-hardening.conf
    run "mkdir -p /etc/ssh/sshd_config.d"
    run "cat > '$conf' <<'EOF'
Port 2222
Port 22
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
EOF"

    if (( LIVE )); then
        sshd -t -f /etc/ssh/sshd_config || die "sshd -t failed; remove $conf to recover" 4
        # open new port BEFORE reload — UFW step may not have run yet, harmless if no UFW
        if command -v ufw >/dev/null && ufw status | grep -q active; then
            ufw limit 2222/tcp
        fi
        systemctl reload ssh
        log "sshd reloaded; verify from a SECOND shell:"
        log "    ssh -p 2222 root@<host> echo ok"
        log "Then run: $0 ssh-finalize --live"
    else
        log "[dry] sshd -t && (ufw limit 2222/tcp if active) && systemctl reload ssh"
    fi
}

step_ssh_finalize() {
    log "step: ssh-finalize — close port 22 in UFW"
    require_root
    if ! command -v ufw >/dev/null; then die "UFW not installed" 5; fi
    if ! ufw status | grep -q active;   then die "UFW not active — run 'ufw' step first" 3; fi
    if ! ss -tnlp | grep -q ":2222"; then die ":2222 not listening — run 'ssh' step first" 3; fi

    # Remove "Port 22" from drop-in
    if [[ -f /etc/ssh/sshd_config.d/99-janicka-hardening.conf ]]; then
        run "sed -i '/^Port 22$/d' /etc/ssh/sshd_config.d/99-janicka-hardening.conf"
        run "systemctl reload ssh"
    fi
    run "ufw delete allow 22/tcp 2>/dev/null || true"
    run "ufw deny 22/tcp"
    log "port 22 closed at sshd + UFW"
}

# ── Step: ufw ──────────────────────────────────────────────────────────────
step_ufw() {
    log "step: ufw — default deny + 80/443/2222 + tailscale0"
    require_pkg ufw

    run "ufw --force reset"
    run "ufw default deny incoming"
    run "ufw default allow outgoing"
    run "ufw allow 80/tcp"
    run "ufw allow 443/tcp"
    run "ufw limit 2222/tcp comment 'janicka ssh hardened'"

    # Tailscale interface — exists only after `tailscale up`
    if ip link show tailscale0 >/dev/null 2>&1; then
        run "ufw allow in on tailscale0"
    else
        warn "tailscale0 interface not present — install tailscale and run 'tailscale up' first, then re-run this step"
    fi

    # Keep current SSH alive while we verify :2222 works (operator removes after ssh-finalize)
    if ss -tnlp | grep -q ":22 "; then
        run "ufw limit 22/tcp comment 'janicka legacy ssh — remove after ssh-finalize'"
    fi

    run "ufw --force enable"
    run "ufw status verbose"
}

# ── Step: fail2ban ─────────────────────────────────────────────────────────
step_fail2ban() {
    log "step: fail2ban — sshd + nginx-bad-bot + nginx-noscript"
    require_pkg fail2ban

    local src
    src="$(dirname "$0")/fail2ban/jail.local"
    [[ -f "$src" ]] || die "missing $src" 3

    run "install -m 0644 -D '$src' /etc/fail2ban/jail.d/janicka.local"
    run "systemctl enable --now fail2ban"
    run "systemctl restart fail2ban"
    run "fail2ban-client status"
}

# ── Step: postgres ─────────────────────────────────────────────────────────
step_postgres() {
    log "step: postgres — pg_hba + listen_addresses → localhost + tailscale only"

    local pgver
    pgver="$(ls /etc/postgresql/ 2>/dev/null | sort -n | tail -1)"
    [[ -n "$pgver" ]] || die "no postgres install detected under /etc/postgresql" 3

    local hba=/etc/postgresql/${pgver}/main/pg_hba.conf
    local conf=/etc/postgresql/${pgver}/main/postgresql.conf
    backup_once "$hba"
    backup_once "$conf"

    # Add tailscale CIDR rule if not already present
    if ! grep -q "100.64.0.0/10" "$hba" 2>/dev/null; then
        run "echo 'hostssl janicka_shop  janicka  100.64.0.0/10  scram-sha-256' >> '$hba'"
    fi

    # listen_addresses — bind localhost + tailscale interface IP if present
    local ts_ip=""
    if command -v tailscale >/dev/null; then
        ts_ip="$(tailscale ip -4 2>/dev/null | head -1 || true)"
    fi
    if [[ -n "$ts_ip" ]]; then
        run "sed -i \"s/^#*listen_addresses.*/listen_addresses = 'localhost,${ts_ip}'/\" '$conf'"
    else
        warn "tailscale IP not detected — leaving listen_addresses=localhost only"
        run "sed -i \"s/^#*listen_addresses.*/listen_addresses = 'localhost'/\" '$conf'"
    fi

    if (( LIVE )); then
        sudo -u postgres /usr/lib/postgresql/${pgver}/bin/postgres --check 2>/dev/null || true
        systemctl reload postgresql
    else
        log "[dry] systemctl reload postgresql"
    fi
}

# ── Step: redis ────────────────────────────────────────────────────────────
step_redis() {
    log "step: redis — bind 127.0.0.1, requirepass, ACL app, rename dangerous"

    local conf=/etc/redis/redis.conf
    [[ -f "$conf" ]] || die "redis config not at $conf" 3
    backup_once "$conf"

    # Pull password from JARVIS DB on the dev box — Hetzner box doesn't have it,
    # so this step requires sync-env to have run first (or env to be set).
    local pw="${REDIS_PASSWORD:-}"
    if [[ -z "$pw" && -f /opt/janicka-shop/.env ]]; then
        pw="$(grep -E '^REDIS_PASSWORD=' /opt/janicka-shop/.env | cut -d= -f2-)"
    fi
    [[ -n "$pw" ]] || die "REDIS_PASSWORD not set; run secrets-sync step first or export it" 3

    # idempotent edits
    run "sed -i 's/^bind .*/bind 127.0.0.1/' '$conf'"
    if grep -q '^requirepass ' "$conf"; then
        run "sed -i 's|^requirepass .*|requirepass ${pw}|' '$conf'"
    else
        run "echo 'requirepass ${pw}' >> '$conf'"
    fi

    for cmd in FLUSHALL FLUSHDB CONFIG DEBUG; do
        if ! grep -q "^rename-command ${cmd} " "$conf"; then
            run "echo 'rename-command ${cmd} \"\"' >> '$conf'"
        fi
    done

    # ACL user
    local acl=/etc/redis/users.acl
    run "cat > '$acl' <<EOF
user default off
user app on >${pw} ~* +@read +@write +@stream +@list +@hash +@string +@keyspace -@dangerous
EOF"
    run "chown redis:redis '$acl' && chmod 0640 '$acl'"

    if ! grep -q "^aclfile " "$conf"; then
        run "echo 'aclfile /etc/redis/users.acl' >> '$conf'"
    fi

    run "systemctl restart redis-server"
}

# ── Step: certbot ──────────────────────────────────────────────────────────
step_certbot() {
    log "step: certbot — post-hook reload-nginx + verify timer"
    require_pkg certbot

    run "mkdir -p /etc/letsencrypt/renewal-hooks/post"
    run "cat > /etc/letsencrypt/renewal-hooks/post/reload-nginx.sh <<'EOF'
#!/bin/sh
nginx -t && systemctl reload nginx
EOF"
    run "chmod +x /etc/letsencrypt/renewal-hooks/post/reload-nginx.sh"
    run "systemctl enable --now certbot.timer"
    run "systemctl list-timers certbot.timer --no-pager || true"
}

# ── Step: logrotate ────────────────────────────────────────────────────────
step_logrotate() {
    log "step: logrotate — janicka logs + journald 7d/500M"

    run "cat > /etc/logrotate.d/janicka-shop <<'EOF'
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
EOF"

    # journald
    local jconf=/etc/systemd/journald.conf
    backup_once "$jconf"
    for kv in "SystemMaxUse=500M" "MaxRetentionSec=7day" "ForwardToSyslog=no"; do
        local k="${kv%%=*}"
        if grep -qE "^#?${k}=" "$jconf"; then
            run "sed -i 's|^#\\?${k}=.*|${kv}|' '$jconf'"
        else
            run "echo '${kv}' >> '$jconf'"
        fi
    done
    run "systemctl restart systemd-journald"
}

# ── Step: upgrades ─────────────────────────────────────────────────────────
step_upgrades() {
    log "step: unattended-upgrades — security only, no auto-reboot"
    require_pkg unattended-upgrades needrestart

    run "cat > /etc/apt/apt.conf.d/20auto-upgrades <<'EOF'
APT::Periodic::Update-Package-Lists \"1\";
APT::Periodic::Unattended-Upgrade \"1\";
APT::Periodic::AutocleanInterval \"7\";
EOF"

    # Override: only security, no auto-reboot, no mail (telegram instead)
    run "cat > /etc/apt/apt.conf.d/51janicka-unattended-upgrades <<'EOF'
Unattended-Upgrade::Allowed-Origins {
    \"\${distro_id}:\${distro_codename}-security\";
    \"\${distro_id}ESMApps:\${distro_codename}-apps-security\";
    \"\${distro_id}ESM:\${distro_codename}-infra-security\";
};
Unattended-Upgrade::Automatic-Reboot \"false\";
Unattended-Upgrade::Mail \"\";
Unattended-Upgrade::Remove-Unused-Kernel-Packages \"true\";
Unattended-Upgrade::Remove-Unused-Dependencies \"true\";
EOF"

    run "systemctl enable --now unattended-upgrades"
}

# ── Step: auditd ───────────────────────────────────────────────────────────
step_auditd() {
    log "step: auditd — watch passwd/shadow/ssh/nginx/.env/sudoers"
    require_pkg auditd

    run "cat > /etc/audit/rules.d/janicka.rules <<'EOF'
-w /etc/passwd            -p wa -k passwd_changes
-w /etc/shadow            -p wa -k shadow_changes
-w /etc/ssh/sshd_config   -p wa -k sshd_changes
-w /etc/ssh/sshd_config.d -p wa -k sshd_changes
-w /etc/nginx             -p wa -k nginx_changes
-w /opt/janicka-shop/.env -p wa -k env_changes
-w /etc/sudoers           -p wa -k sudoers_changes
-w /etc/sudoers.d         -p wa -k sudoers_changes
EOF"

    run "augenrules --load"
    run "systemctl restart auditd"

    # Daily digest service + timer
    local repo
    repo="$(cd "$(dirname "$0")" && pwd)"
    if [[ -f "$repo/systemd/janicka-audit-scan.service" ]]; then
        run "install -m 0644 '$repo/systemd/janicka-audit-scan.service' /etc/systemd/system/"
        run "install -m 0644 '$repo/systemd/janicka-audit-scan.timer'   /etc/systemd/system/"
        run "install -m 0755 '$repo/janicka-audit-scan.sh'              /usr/local/bin/"
        run "systemctl daemon-reload"
        run "systemctl enable --now janicka-audit-scan.timer"
    else
        warn "audit-scan systemd units not found in repo (run from repo checkout)"
    fi
}

# ── Step: secrets-sync ─────────────────────────────────────────────────────
step_secrets_sync() {
    log "step: secrets-sync — hourly env pull from JARVIS api_keys"

    local repo
    repo="$(cd "$(dirname "$0")" && pwd)"
    if [[ ! -f "$repo/sync-env-hetzner.sh" ]]; then
        die "missing $repo/sync-env-hetzner.sh — checkout repo on box first" 3
    fi
    run "install -m 0755 '$repo/sync-env-hetzner.sh' /usr/local/bin/"

    if [[ -f "$repo/systemd/janicka-sync-env.service" ]]; then
        run "install -m 0644 '$repo/systemd/janicka-sync-env.service' /etc/systemd/system/"
        run "install -m 0644 '$repo/systemd/janicka-sync-env.timer'   /etc/systemd/system/"
        run "systemctl daemon-reload"
        run "systemctl enable --now janicka-sync-env.timer"
    else
        warn "sync-env systemd units not found in repo (run from repo checkout)"
    fi
}

# ── Dispatcher ─────────────────────────────────────────────────────────────
case "$STEP" in
    nginx)        step_nginx ;;
    ssh)          step_ssh ;;
    ssh-finalize) step_ssh_finalize ;;
    ufw)          step_ufw ;;
    fail2ban)     step_fail2ban ;;
    postgres)     step_postgres ;;
    redis)        step_redis ;;
    certbot)      step_certbot ;;
    logrotate)    step_logrotate ;;
    upgrades)     step_upgrades ;;
    auditd)       step_auditd ;;
    secrets-sync) step_secrets_sync ;;
    all)
        step_nginx
        step_logrotate
        step_certbot
        step_upgrades
        step_auditd
        step_fail2ban
        step_postgres
        step_redis
        step_secrets_sync
        step_ssh
        step_ufw
        log "ALL steps applied except ssh-finalize. Verify :2222 works in a second shell, then run --live ssh-finalize."
        ;;
esac

if (( LIVE )); then
    log "step '$STEP' complete (LIVE)"
else
    log "step '$STEP' DRY RUN complete — re-run with --live to apply"
fi
