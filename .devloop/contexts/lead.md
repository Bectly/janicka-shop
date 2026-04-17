# Lead — Tech Lead

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
