# Resend env vars — Vercel set runbook (2026-05-03)

**Status: required for outbound mail (transport) and the planned inbound webhook
(C5126). Without `RESEND_API_KEY` every transactional/marketing send is a
silent no-op (logger warn + skip), and inbound replies cannot land in the
admin mailbox.**

This runbook is for the human (Janička / bectly) — Bolt cannot log into
Vercel. Follow it once per environment (Production + Preview).

## TL;DR — the 3 vars

| Var | Purpose | Required? | Where to get it |
| --- | --- | --- | --- |
| `RESEND_API_KEY` | Auth for `client.emails.send()` in `src/lib/email/resend-transport.ts` | **YES** — without it all sends silently skip | Resend dashboard → API Keys → Create (`re_…`) |
| `RESEND_INBOUND_SECRET` | HMAC secret for verifying inbound webhook signatures (planned `/api/email/inbound/route.ts`, persist path already exists at `src/lib/email/inbound-persist.ts`) | **YES** once the inbound route is wired (C5126); reserve the name now to keep envs aligned | Resend dashboard → Webhooks → Endpoint → "Signing secret" (`whsec_…`) |
| `RESEND_FROM` (= role-based `EMAIL_FROM_*` set) | Verified-domain sender identities used per-flow | **YES** — must be on a verified domain (`jvsatnik.cz`) | Resend dashboard → Domains → verify `jvsatnik.cz` (SPF + DKIM + DMARC) |

> The codebase doesn't have a single `RESEND_FROM` — it splits sender identity
> by role (orders / info / newsletter / support / reply-to). See "Sender
> identities" below for the full list. All four addresses must be on the same
> verified Resend domain.

## 1) `RESEND_API_KEY`

- **Format**: `re_` + 32+ alphanumeric chars (e.g. `re_AbCd1234…`).
- **Where to get**: <https://resend.com/api-keys> → "Create API key" →
  permission **Sending access** (full access not required) → scope **Production**
  domain → copy once (Resend won't show it again).
- **Where to set**: Vercel project `janicka-shop` → Settings → Environment
  Variables → "Add new" → key `RESEND_API_KEY`, value `re_…`, scope **Production**
  (also Preview if you want preview deploys to send real mail; otherwise leave
  Preview unset and let it skip).
- **Reverify**: redeploy → `vercel env ls production | grep RESEND_API_KEY` →
  must show "Encrypted".

## 2) `RESEND_INBOUND_SECRET` (reserved — C5126 inbound route)

- **Format**: Resend webhook secret, prefix `whsec_` + base64-ish payload.
  Treat as opaque; do not log.
- **Where to get**: <https://resend.com/webhooks> → "Add endpoint" → URL
  `https://jvsatnik.cz/api/email/inbound` → events **Inbound email** → save →
  copy "Signing secret".
- **Where to set**: Vercel → Env Vars → `RESEND_INBOUND_SECRET`, scope
  **Production**. Preview can stay unset (no inbound traffic on preview URLs).
- **Verification handler** (when route lands): use Resend's documented HMAC
  scheme — `crypto.createHmac("sha256", secret).update(rawBody).digest("hex")`
  compared in constant time against the `Resend-Signature` header. Reject with
  401 on mismatch; do **not** parse the body before signature verification
  (replay defence).
- **Reverify**: send a test event from the Resend webhooks dashboard → check
  Vercel logs for the signature-OK path → confirm an `EmailMessage` row appears
  via `persistInboundMail()`.

## 3) `RESEND_FROM` — sender identities

The codebase does **not** read a single `RESEND_FROM`. It reads four role-based
vars from `src/lib/email/addresses.ts`:

| Var | Default | Used by |
| --- | --- | --- |
| `EMAIL_FROM_ORDERS` | `Janička <objednavky@jvsatnik.cz>` | Order confirm / paid / shipped / delivery-check |
| `EMAIL_FROM_INFO` | `Janička <info@jvsatnik.cz>` | Account welcome, email-change verify, generic transactional |
| `EMAIL_FROM_NEWSLETTER` | `Janička <novinky@jvsatnik.cz>` | Newsletter welcome, campaigns (Mother's Day, customs, win-back, browse-abandon) |
| `EMAIL_FROM_SUPPORT` | `Janička <podpora@jvsatnik.cz>` | Password reset, refund/return correspondence, mailbox replies |
| `EMAIL_REPLY_TO` | `podpora@jvsatnik.cz` | `Reply-To` header on outbound mail so customer replies hit the inbound mailbox |

- **Format**: RFC 5322 `Name <local@domain>` or bare `local@domain`. The local
  part of every address must resolve on a Resend-verified domain — otherwise
  Resend rejects the send with `403`.
- **Where to verify the domain**: <https://resend.com/domains> → click
  `jvsatnik.cz` → state must be **Verified** (SPF / DKIM / DMARC all green).
  Add the three DNS records Resend prints, then click "Verify".
- **Where to set in Vercel**: Settings → Env Vars → add each `EMAIL_FROM_*` and
  `EMAIL_REPLY_TO` with scope **Production** (and **Preview** if preview should
  send real mail). The defaults baked into `addresses.ts` already point at the
  right addresses, so if you accept the defaults you only **must** set
  `RESEND_API_KEY`. Override `EMAIL_FROM_*` only if the address changes.

## Where consumed (callsites)

`RESEND_API_KEY`:

- `src/lib/email/resend-transport.ts:51` — `getMailer()` factory; returns null
  + warns when missing, every other email module then no-ops.
- `src/lib/email.ts` — 24 transactional flows guard on the same env (lines
  259, 289, 441, 615, 807, 943, 1085, 1142, 1249, 1485, 1623, 1712, 1814,
  1905, 1993, 2059, 2166, 2412, 2589, 3014, 3143).
- `src/lib/email/similar-item.ts:168`
- `src/lib/email/wishlist-sold.ts:154`
- `src/app/(admin)/admin/mailbox/actions.ts:231,358` — admin reply path
  surfaces the env-missing state to the operator.
- `src/app/api/admin/email-preview/route.ts:148`
- `src/app/api/cron/back-in-stock-notify/route.ts:26`
- `src/app/api/cron/similar-items/route.ts:26`

`RESEND_INBOUND_SECRET`: **not yet read** in `src/`. Reserved name for the
inbound route landing in C5126. Persist path that the route will call:
`src/lib/email/inbound-persist.ts` (`persistInboundMail()`).

`EMAIL_FROM_ORDERS` / `EMAIL_FROM_INFO` / `EMAIL_FROM_NEWSLETTER` /
`EMAIL_FROM_SUPPORT` / `EMAIL_REPLY_TO`:

- `src/lib/email/addresses.ts:1-10` — single source of truth, re-exported as
  `FROM_ORDERS` / `FROM_INFO` / `FROM_NEWSLETTER` / `FROM_SUPPORT` / `REPLY_TO`
  and consumed by every send-site in `src/lib/email.ts` and the admin mailbox
  actions.

## Smoke-test recipe (after setting Production env vars)

1. **Build green**: `vercel --prod` (or push to `main` and watch the deploy).
   The build itself doesn't read `RESEND_API_KEY`; this is just a sanity gate.
2. **Health probe** — the `/api/health` endpoint reports an `email` field
   (`ok` when both `RESEND_API_KEY` and the `jvsatnik.cz`-domain `EMAIL_FROM_*`
   are present, `missing_env` with the offending var name when not):

   ```bash
   curl -s https://jvsatnik.cz/api/health | jq '.email'
   # expected: "ok"
   ```

3. **Real-send smoke** (outbound, costs 1 Resend credit) — admin mailbox reply
   from the admin UI: Admin → Mailbox → open any thread → "Odpovědět" → send
   to a throwaway address. A 200 plus a row in `EmailMessage` with
   `direction = "outbound"` and a `messageId` starting with the Resend
   thread id confirms transport is live.
4. **Real-send CLI alternative**:

   ```bash
   RESEND_API_KEY=re_… node -e '
     import("resend").then(({Resend}) => new Resend(process.env.RESEND_API_KEY)
       .emails.send({
         from: "Janička <objednavky@jvsatnik.cz>",
         to: "you@example.com",
         subject: "Resend smoke",
         text: "If you got this, prod transport is configured."
       }).then(r => console.log(r), e => { console.error(e); process.exit(1); }));
   '
   ```

5. **Inbound smoke** (only after the C5126 webhook route lands):

   ```bash
   curl -X POST https://jvsatnik.cz/api/email/inbound \
     -H "Content-Type: application/json" \
     -H "Resend-Signature: <sha256-hmac-of-body-with-RESEND_INBOUND_SECRET>" \
     --data-binary @sample-inbound.json
   ```

   A 401 on a wrong signature, 200 + `EmailMessage` row on a correct one.

## Acceptance

- [ ] Vercel build green after env vars set.
- [ ] `curl https://jvsatnik.cz/api/health` returns 200 and `.email == "ok"`.
- [ ] Admin mailbox reply send returns success (no "E-mailová služba není
      nakonfigurovaná" error toast).
- [ ] (After C5126 lands) inbound webhook 401s on wrong signature, 200s on
      correct signature, and the message appears in admin mailbox.
- [ ] `vercel env ls production` shows `RESEND_API_KEY` and (once webhook is
      wired) `RESEND_INBOUND_SECRET` as Encrypted.

## Rollback

If a bad key takes prod down (it shouldn't — sends fail-closed and warn), the
fastest revert is Vercel → Env Vars → edit `RESEND_API_KEY` → set to empty →
redeploy. Every send-site falls back to the warn-and-skip branch within one
deploy. Inbound stays parked until a valid signing secret is restored.
