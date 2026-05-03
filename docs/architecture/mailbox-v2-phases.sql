-- Mailbox v2 — JARVIS task_queue draft INSERTs
-- Author: Bolt (cycle #5230, task_id=1018)
-- Date: 2026-05-03
-- Status: DRAFT — DO NOT EXECUTE without bectly approval of design doc
--   docs/architecture/mailbox-v2-2026-05-03.md
--
-- Project: janicka-shop (project_id=15 in JARVIS DB)
-- Schema columns assumed: id, project_id, agent_type, title, description, status, priority, created_at
-- (verify against actual task_queue schema before execution; many JARVIS task_queue tables include extra fields)

BEGIN TRANSACTION;

-- =========================================================================
-- PHASE A — INBOUND INFRASTRUCTURE
-- =========================================================================

-- A.1 — DNS configuration (BLOCKED bectly: requires Cloudflare DNS access)
INSERT INTO task_queue (project_id, agent_type, title, description, status, priority)
VALUES (15, 'BOLT',
  'Mailbox v2 Phase A.1 — DNS records for jvsatnik.cz',
  'Add MX/SPF/DKIM/DMARC records via Cloudflare DNS for jvsatnik.cz. Records (see design doc §3): MX 10/20/30 → cloudflare mx pool, SPF include _spf.resend.com + _spf.mx.cloudflare.net ~all, DKIM resend._domainkey TXT (key from Resend dashboard), DMARC p=quarantine sp=quarantine adkim=s aspf=s rua=mailto:dmarc@jvsatnik.cz. Verify mail-tester.com score ≥ 9/10. BLOCKED on bectly providing CF API token or doing it himself.',
  'blocked', 1);

-- A.2 — Cloudflare Email Routing rules (BLOCKED on A.1)
INSERT INTO task_queue (project_id, agent_type, title, description, status, priority)
VALUES (15, 'BOLT',
  'Mailbox v2 Phase A.2 — Cloudflare Email Routing setup',
  'Configure CF Email Routing in dashboard: 7 explicit aliases (objednavky, info, kontakt, reklamace, podpora, marketing, faktury) + catch-all *@jvsatnik.cz → all forward to inbound@resend.com (Resend Inbound webhook target). Add dmarc@jvsatnik.cz → forward to bectly+dmarc@gmail.com for DMARC reports. BLOCKED on A.1.',
  'blocked', 2);

-- A.3 — Resend Inbound webhook handler
INSERT INTO task_queue (project_id, agent_type, title, description, status, priority)
VALUES (15, 'BOLT',
  'Mailbox v2 Phase A.3 — Resend Inbound webhook + provider switch',
  'Create POST /api/webhooks/resend-inbound/route.ts: validate resend-signature header (HMAC SHA256 with RESEND_WEBHOOK_SECRET), parse payload (Resend gives parsed mime: from/to/subject/bodyText/bodyHtml/attachments/headers), upload attachments to R2 (mailbox/{messageId}/{filename}), call inboundPersist() to write EmailMessage (idempotent via messageId unique). Refactor src/lib/email/inbound-persist.ts to drop self-rolled mime parser (Resend already parsed); cut to ~80 LOC. Add MAILBOX_INBOUND_PROVIDER env (resend-webhook|imap) — default resend-webhook. Keep imap-sync.ts behind imap flag for 30-day fallback then remove.',
  'open', 3);

-- A.4 — Domain alignment bugfix
INSERT INTO task_queue (project_id, agent_type, title, description, status, priority)
VALUES (15, 'BOLT',
  'Mailbox v2 Phase A.4 — fix info@janicka.cz → info@jvsatnik.cz (5 occurrences)',
  'Find/replace info@janicka.cz → info@jvsatnik.cz in: src/app/(shop)/contact/page.tsx:15 (1×), src/app/(shop)/privacy/page.tsx:35,271,319,385 (4×). Run npm run build. P0 because janicka.cz domain has no MX records — customer mails sent to it disappear. Verify no other occurrences via grep.',
  'open', 1);

-- A.5 — Extra alias env vars
INSERT INTO task_queue (project_id, agent_type, title, description, status, priority)
VALUES (15, 'BOLT',
  'Mailbox v2 Phase A.5 — extend src/lib/email/addresses.ts with new aliases',
  'Add EMAIL_FROM_REKLAMACE, EMAIL_FROM_KONTAKT, EMAIL_FROM_FAKTURY, EMAIL_FROM_MARKETING exports with sensible Janička <{alias}@jvsatnik.cz> defaults. Update src/lib/email-templates use sites where alias-specific from address makes sense (e.g. refund email → EMAIL_FROM_REKLAMACE). Document in design doc §3.',
  'open', 4);

-- =========================================================================
-- PHASE B — SCHEMA ADDITIONS
-- =========================================================================

-- B.1 — EmailThread/Message column adds (Postgres-priority)
INSERT INTO task_queue (project_id, agent_type, title, description, status, priority)
VALUES (15, 'BOLT',
  'Mailbox v2 Phase B.1 — EmailThread/Message schema additions',
  'Add columns: EmailThread.aliasLabel (String?), folder (String default "inbox"), snoozedUntil (DateTime?). EmailMessage: searchVector tsvector (Postgres only via raw migration with GENERATED ALWAYS AS clause + GIN index, see design doc §7). Add @@index([folder, archived, trashed, lastMessageAt]) and [snoozedUntil]. Update both prisma/schema.prisma and prisma/schema.postgres.prisma. Run prisma migrate dev. BLOCKED on Postgres cutover (HT#45) for searchVector — adds work on SQLite fine, just no FTS in dev.',
  'blocked', 5);

-- B.2 — New models: Label, Draft, Signature, Template, Rule
INSERT INTO task_queue (project_id, agent_type, title, description, status, priority)
VALUES (15, 'BOLT',
  'Mailbox v2 Phase B.2 — new Prisma models',
  'Add models per design doc §5: EmailLabel, EmailThreadLabel (m:m), EmailDraft, EmailSignature, EmailTemplate, EmailRule. Migration name 20260504_mailbox_v2_phase_b. Mirror in schema.postgres.prisma (verify JSON fields use String, BigInt where appropriate). Run prisma migrate, prisma generate, npm run build to confirm clean. No UI yet.',
  'open', 6);

-- =========================================================================
-- PHASE C — UI REBUILD (P0)
-- =========================================================================

-- C.1 — 3-pane layout shell
INSERT INTO task_queue (project_id, agent_type, title, description, status, priority)
VALUES (15, 'SAGE',
  'Mailbox v2 Phase C.1 — 3-pane layout shell',
  'Rewrite src/app/(admin)/admin/mailbox/page.tsx to 3-pane: left sidebar (folders/labels/compose CTA, 240px), middle (thread list, 380-480px), right (selected thread reader, flex). Tablet (≥768): collapse sidebar to icons. Mobile (<768): single-pane stack with route push. Use shadcn ResizablePanel for desktop. Czech UI strings. See design doc §4.1 + §6 wireframes.',
  'open', 7);

-- C.2 — Thread list with snippets/badges
INSERT INTO task_queue (project_id, agent_type, title, description, status, priority)
VALUES (15, 'SAGE',
  'Mailbox v2 Phase C.2 — thread list item + folders + search',
  'Build thread-list-item component: unread dot + sender + smart-formatted time (today=14:32, yesterday=Včera, older=23. dub) + subject + plaintext snippet (120 chars) + alias-label badge + flagged ⭐ + 📎 attachment-count. Folder filter sidebar (Inbox/Hvězdičkové/Odeslané/Koncepty/Spam/Archiv/Koš + custom labels). Search bar in header (full-text via tsvector on Postgres, LIKE fallback on SQLite). Hover quick actions (archive/trash/mark-read). Pagination cursor-based 50/page.',
  'open', 8);

-- C.3 — Thread reader with collapsible quotes
INSERT INTO task_queue (project_id, agent_type, title, description, status, priority)
VALUES (15, 'SAGE',
  'Mailbox v2 Phase C.3 — thread reader',
  'Build thread reader pane: chronological message list, first message expanded, replies collapsed by default with "▶ {sender} {time}" header click-to-expand. DOMPurify-sanitized HTML body (server-side, allowlist tags). Quoted text auto-detect (lines starting > or "Dne {date} napsal:") collapse with "Zobrazit citaci" toggle. Attachment thumbnails grid below body, click → R2 signed URL (15min TTL). Inline image cid: rewriting. Block external images by default with "Zobrazit obrázky" toggle (privacy).',
  'open', 9);

-- =========================================================================
-- PHASE D — COMPOSE + OUTBOUND PERSIST
-- =========================================================================

-- D.1 — TipTap compose drawer
INSERT INTO task_queue (project_id, agent_type, title, description, status, priority)
VALUES (15, 'BOLT',
  'Mailbox v2 Phase D.1 — TipTap compose drawer',
  'Build right-side drawer compose component (lazy-load TipTap to avoid admin TTI hit). Toolbar: B/I/U/S, lists, link, blockquote, code, H1-H3, undo/redo, vložit signaturu, vložit šablonu. Fields: From (alias dropdown), To (autocomplete from EmailMessage.fromAddress + Customer.email), CC, BCC, Subject. Attachments dropzone → R2 upload → store keys in form state. Form: react-hook-form + zod. Mobile: full-screen modal.',
  'open', 10);

-- D.2 — sendComposeAction with thread continuity
INSERT INTO task_queue (project_id, agent_type, title, description, status, priority)
VALUES (15, 'BOLT',
  'Mailbox v2 Phase D.2 — sendComposeAction + outbound EmailMessage persist',
  'Server action sendComposeAction(): admin role check (CRITICAL — see security audit memory: 9 admin actions miss role check), generate Message-ID = <{cuid}@jvsatnik.cz>, call Resend send with custom headers (Message-ID, In-Reply-To if reply, References = parent.References + parent.Message-ID, List-Unsubscribe per RFC 8058), persist EmailMessage (direction=outbound), update EmailThread.lastMessageAt + messageCount. Reply/Reply-All/Forward action variants prefill body with quoted parent. Rate limit 100 sends/h per admin via Upstash Redis sliding window.',
  'open', 11);

-- =========================================================================
-- PHASE E — P1 FEATURES
-- =========================================================================

-- E.1 — Labels + drafts auto-save + snooze + star
INSERT INTO task_queue (project_id, agent_type, title, description, status, priority)
VALUES (15, 'BOLT',
  'Mailbox v2 Phase E.1 — labels + drafts auto-save + snooze + star',
  'Labels: CRUD UI in mailbox sidebar settings (color picker, name), m:m EmailThreadLabel, sidebar filter by label, multi-label per thread chip UI. Drafts: debounced 5s auto-save server action → EmailDraft, "Uloženo v 14:32" indicator, restore on compose reopen. Snooze: dropdown (1h/zítra ráno/příští týden/vlastní) → EmailThread.snoozedUntil, hourly cron /api/cron/email-snooze-unsnooze. Star: toggle button → EmailThread.flagged, "Hvězdičkové" virtual folder.',
  'open', 12);

-- E.2 — Signatures + templates + rules
INSERT INTO task_queue (project_id, agent_type, title, description, status, priority)
VALUES (15, 'BOLT',
  'Mailbox v2 Phase E.2 — signatures + templates + rules',
  'Signatures: per-alias default + override, HTML editor in /admin/mailbox/settings/signatures, image embed via R2. Templates: categories (order_confirmation/refund/complaint_reply/custom), variable substitution {customer_name}/{order_id}, picker in compose toolbar. Rules: form builder with conditions ([{field,op,value}]) and actions ([{type,value}]), priority ordering, applied to inbound mail in /api/webhooks/resend-inbound after persist (before email sent to user as notification).',
  'open', 13);

-- E.3 — Keyboard shortcuts + multi-select bulk + sidebar unread badge
INSERT INTO task_queue (project_id, agent_type, title, description, status, priority)
VALUES (15, 'SAGE',
  'Mailbox v2 Phase E.3 — keyboard shortcuts + bulk actions + unread badge',
  'react-hotkeys-hook bindings: j/k navigate threads, c compose, r reply, a reply-all, f forward, e archive, # delete, m mute, s star, / focus search, ? help overlay (Gmail mapping). Multi-select: shift-click range, "Vybrat vše" checkbox header, bulk toolbar (archive/delete/label/mark-read). Admin sidebar: unread count badge polling 30s server action getUnreadCount() — P1 upgrade SSE later if needed.',
  'open', 14);

-- =========================================================================
-- (PHASE F — P2 AI features intentionally NOT drafted; depends on Phase E feedback + Manager Workspace stability)
-- =========================================================================

COMMIT;
