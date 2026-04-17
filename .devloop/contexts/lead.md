# Lead — Tech Lead

## STANDING ORDER — DevChat + Telegram FIRST, Every Cycle
Janicka (shop owner) writes on the live site via DevChat. Her messages are TOP PRIORITY. Check BEFORE anything else.

```bash
# 1) Load key from JARVIS DB (never hardcode)
DEVCHAT_KEY=$(sqlite3 ~/.claude/jarvis-gym/jarvis.db "SELECT key_value FROM api_keys WHERE name='devchat-api-key';")

# 2) Pull new messages
curl -s -H "Authorization: Bearer $DEVCHAT_KEY" \
  'https://janicka-shop.vercel.app/api/dev-chat?status=new'

# 3) Respond + resolve (per message)
curl -s -X PATCH -H "Authorization: Bearer $DEVCHAT_KEY" \
  -H "Content-Type: application/json" \
  -d '{"response":"...","status":"resolved"}' \
  'https://janicka-shop.vercel.app/api/dev-chat/MESSAGE_ID'

# 4) Telegram (bectly quick checks from phone)
curl -s 'https://api.telegram.org/bot8670872030:AAGWccuYhWYWoRqdR5IVqfXEXD6K3cQEFFI/getUpdates?offset=-5'
```

If Janicka reports a bug / requests a change → create a Bolt task IMMEDIATELY this cycle. Respond stručně, česky.

API verified working 2026-04-17: `GET /api/dev-chat?status=new` with Bearer returns 200, 0 new messages. Telegram also returned empty.

## STANDING ORDER — Telegram Update Every Cycle
At the END of every Lead cycle, send a SHORT Telegram update to bectly (max 5-6 lines).

```bash
curl -s https://api.telegram.org/bot8670872030:AAGWccuYhWYWoRqdR5IVqfXEXD6K3cQEFFI/sendMessage \
  --data-urlencode "chat_id=8750673812" \
  --data-urlencode "parse_mode=Markdown" \
  --data-urlencode "text=Lead Report Cycle XXXX
- bullet 1 (what acked)
- bullet 2 (what directed)
- queue status
- blockers"
```

Use `--data-urlencode` — plain `-d` breaks on `&` (e.g. "T&C"). Format: cycle number, 2-4 bullets (acked/directed), queue status, blockers. Must happen EVERY cycle — do not skip.

## Current State (C3518)
Team idle ~234 cycles waiting on work. All major launch blockers DONE. April 28 Vinted T&C campaign send is 11 days out (today 2026-04-17).

## Just Acked
- **#227 Trace — GDPR unsubscribe audit** → DONE (C3517 commit d2e8952)
- **#228 Trace — HMAC fix across templates** → DONE for 8/9 templates; similar-item.ts left uncommitted, included in this Lead cycle (C3518).

## Gap Found & Fixed (C3518)
`signUnsubscribeToken()` threw if `UNSUBSCRIBE_HMAC_SECRET` missing — would have killed every email send on Vercel if env var forgotten. Hardened to warn-once + emit `plain.<b64email>` fallback that `verifyUnsubscribeToken()` still accepts. Protects Apr 28 campaign from env-config mistake.

## Open Backlog
| # | Agent | Task |
|---|-------|------|
| 229 | Bolt | Admin dashboard warning banner when `UNSUBSCRIBE_HMAC_SECRET` missing at runtime |
| 230 | bectly | `openssl rand -hex 32` → Vercel env `UNSUBSCRIBE_HMAC_SECRET` |
| 231 | Bolt | Wishlist sold-item email (Once Again case: 40% CR) |
| 232 | Trace | E2E smoke /odhlasit-novinky with `?token=...` on Vercel preview |

## Directive
- **Bolt** → #229 (force_next set)
- **Trace** → #232 after Bolt commits
- **Scout** → idle until Apr 28 send, then resume Vinted CZ media scan

## Campaign Schedule
- Apr 28 17:00 CET — Vinted T&C warm list send (subject A/B)
- Apr 30 09:00 CET — Vinted cold list (enforcement deadline)
- May 1/7/9 — Den matek sequence

## Last 5 Lead Cycles
- C3518: Unstuck 234-cycle idle loop; HMAC env-safe fallback; 4 new tasks
- C3278: Acked #218/#221; Trace → #219 E2E; Bolt → #221 campaign hardening
- C3262/3263: Analytics gap → #215/#216/#217
- C3222: Admin login unblocked; default password risk → #110
- C2771: Den matek banner + quick-add measurements + Vinted T&C urgency
