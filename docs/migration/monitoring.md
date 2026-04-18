# Uptime Monitoring — UptimeRobot → Telegram

Task #344. Two endpoints wire UptimeRobot's free HTTP checks to the JARVIS
Telegram bot so bectly gets a phone push the moment janicka-shop goes down.

## Endpoints

### `GET /api/health`

Returns a flat JSON readiness probe. UptimeRobot is configured to treat any
non-2xx response as DOWN.

Response shape:

```json
{
  "ok": true,
  "db": "ok",          // "ok" | "down"
  "redis": "ok",       // "ok" | "down" | "n/a" (when REDIS_URL is unset)
  "ts": "2026-04-18T10:00:00.000Z",
  "version": "0.1.0",
  "commit": "abc123",
  "node": "v22.x",
  "env": "production",
  "uptimeSeconds": 3600
}
```

- `db` probes Prisma with `SELECT 1`, 2s timeout.
- `redis` pings only when `REDIS_URL` is set; `n/a` means "not configured for
  this deployment" and does not affect `ok`.
- Returns `200` when `db === "ok"`. Returns `503` when `db === "down"` (that's
  the signal UptimeRobot watches for).
- Response is always uncached (`Cache-Control: no-store`).

### `POST /api/alerts/uptime`

Receives UptimeRobot's "Web-Hook" alert and forwards a Czech-labelled message
to the JARVIS admin chat.

Auth:
- Header `X-Uptime-Secret: <value>` **or** query string `?token=<value>`.
- Compared in constant time against `UPTIMEROBOT_WEBHOOK_SECRET`.
- When the env var is unset the route returns `503` — unauthenticated hits
  never silently succeed.

Expected JSON body (configure as the UptimeRobot "POST value"):

```json
{
  "monitorFriendlyName": "*monitorFriendlyName*",
  "alertType": *alertType*,
  "alertTypeFriendlyName": "*alertTypeFriendlyName*",
  "alertDetails": "*alertDetails*",
  "monitorURL": "*monitorURL*"
}
```

`alertType` mapping: `1` = DOWN (🔴), `2` = UP (🟢), `3` = SSL expiring (⚠️).

## Required environment variables

| Name | Where | Purpose |
| ---- | ----- | ------- |
| `TELEGRAM_BOT_TOKEN` | Vercel prod + preview | JARVIS bot token (api_keys: `telegram-bot`) |
| `TELEGRAM_ALERT_CHAT_ID` | Vercel prod | Override for admin chat id. Defaults to `8750673812` (bectly) when unset. |
| `UPTIMEROBOT_WEBHOOK_SECRET` | Vercel prod | Shared secret for the webhook query/header. Generate with `openssl rand -hex 24`. |
| `REDIS_URL` | Vercel prod (optional) | Enables the Redis ping in `/api/health`. Leave unset to get `redis: "n/a"`. |

Set via Vercel CLI:

```bash
VERCEL_TOKEN=$(sqlite3 ~/.claude/jarvis-gym/jarvis.db \
  "SELECT key_value FROM api_keys WHERE name='vercel'")

vercel env add UPTIMEROBOT_WEBHOOK_SECRET production --token "$VERCEL_TOKEN"
vercel env add TELEGRAM_BOT_TOKEN production --token "$VERCEL_TOKEN"
# TELEGRAM_ALERT_CHAT_ID only if overriding the 8750673812 default
```

## UptimeRobot configuration

1. Create monitor:
   - **Type**: HTTP(s)
   - **URL**: `https://janicka-shop.vercel.app/api/health` (swap for
     `.cz` domain once DNS flip #329 lands)
   - **Interval**: 5 minutes (free tier)
   - **Keyword**: (optional) `"ok":true` — catches degraded-but-200 responses.
2. Create **Alert Contact** → type **Web-Hook**:
   - **URL**: `https://janicka-shop.vercel.app/api/alerts/uptime?token=<UPTIMEROBOT_WEBHOOK_SECRET>`
   - **POST Value (JSON)**: paste the body shown above.
   - **Send as JSON**: enable.
3. Attach the web-hook contact to the monitor.
4. Optional: a second monitor pointing at `/` (homepage) for a "user-flow" view.

## Smoke test

Once deployed:

```bash
# health endpoint
curl -sS https://janicka-shop.vercel.app/api/health | jq
# expect ok=true, db=ok, redis=ok|n/a

# webhook (replace SECRET)
curl -sS -X POST \
  "https://janicka-shop.vercel.app/api/alerts/uptime?token=SECRET" \
  -H 'Content-Type: application/json' \
  -d '{"monitorFriendlyName":"janicka-shop","alertType":1,"alertDetails":"smoke test","monitorURL":"https://janicka-shop.vercel.app"}'
# expect {"ok":true,"delivered":true} and a 🔴 DOWN — janicka-shop message in Telegram
```

## Hetzner cutover notes

When we migrate off Vercel (#329 DNS flip), the monitor URL switches to
`https://janicka.cz/api/health`. Nginx must NOT rate-limit `/api/health`
(keep it out of the `limit_req` zone) — UptimeRobot treats 429 as DOWN.
The alert webhook path `/api/alerts/uptime` is hit infrequently enough that
it can sit inside the default rate-limit bucket.
