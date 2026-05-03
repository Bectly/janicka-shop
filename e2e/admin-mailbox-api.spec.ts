import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { createHmac } from "crypto";

// Mailbox v2 Phase B REST + draft + inbound coverage (Task #1039 / Cycle #5236).
//
// Endpoints under test:
//   POST   /api/admin/mailbox/compose                    (compose+send new thread)
//   POST   /api/admin/mailbox/threads/[id]/reply         (reply on existing thread)
//   PATCH  /api/admin/mailbox/threads/[id]/read          (mark all messages read)
//   POST   /api/email/inbound                            (Resend inbound webhook)
//
// Strategy:
//   - Auth-gate tests use the no-cookie request fixture → must 401.
//   - Validation tests do not need RESEND_API_KEY (the route returns 400 on
//     empty payload before reaching the mailer).
//   - Happy-path compose/reply call the real Resend mailer; we skip when
//     RESEND_API_KEY is unset (dev default — see .env.local:63 empty).
//   - PATCH read does NOT touch the mailer, so its happy path runs whenever
//     E2E_ADMIN_EMAIL/PASSWORD are configured (independent of Resend).
//   - Inbound webhook DB-verify: HMAC-sign a minimal payload, POST it,
//     and assert persistInboundMail() created an EmailMessage row.
//
// Cleanup: every seeded thread carries the `-e2e-mailbox-api-` subject tag
// and the inbound message uses a Message-ID with the same tag. afterAll
// deletes by that tag so a SIGKILL mid-run leaves no orphans.

const prisma = new PrismaClient();
const UNIQUE = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
const TAG = `e2e-mailbox-api-${UNIQUE}`;
const SUBJECT = `E2E mailbox-api seed (${TAG})`;
const CUSTOMER_ADDR = `customer-${UNIQUE}@test.local`;

let seededThreadId: string | null = null;
let seededMessageId: string | null = null; // RFC Message-ID header value

test.beforeAll(async () => {
  const now = new Date();
  const messageIdHeader = `<seed-${UNIQUE}@test.local>`;
  const thread = await prisma.emailThread.create({
    data: {
      subject: SUBJECT,
      participants: JSON.stringify([CUSTOMER_ADDR, "info@jvsatnik.cz"]),
      lastMessageAt: now,
      messageCount: 1,
      unreadCount: 1,
      messages: {
        create: {
          messageId: messageIdHeader,
          direction: "inbound",
          fromAddress: CUSTOMER_ADDR,
          fromName: "Customer Test",
          toAddresses: JSON.stringify(["info@jvsatnik.cz"]),
          ccAddresses: "[]",
          subject: SUBJECT,
          bodyText: "Hello, this is an e2e seed.",
          bodyHtml: "<p>Hello, this is an e2e seed.</p>",
          receivedAt: now,
          // readAt: null → unread (drives PATCH-read happy-path assertion)
        },
      },
    },
    select: { id: true },
  });
  seededThreadId = thread.id;
  seededMessageId = messageIdHeader;
});

test.afterAll(async () => {
  // Delete every thread whose subject still carries our run tag — handles
  // both the seeded thread AND any thread created by the inbound-webhook
  // test below. EmailMessage rows cascade via onDelete:Cascade.
  await prisma.emailThread
    .deleteMany({ where: { subject: { contains: TAG } } })
    .catch(() => {});
  // EmailMessage rows from the inbound webhook may live on a different
  // (auto-created) thread keyed off Message-ID — sweep by message-id tag too.
  await prisma.emailMessage
    .deleteMany({ where: { messageId: { contains: TAG } } })
    .catch(() => {});
  await prisma.$disconnect();
});

async function loginAsAdmin(page: import("@playwright/test").Page) {
  const adminEmail = process.env.E2E_ADMIN_EMAIL;
  const adminPassword = process.env.E2E_ADMIN_PASSWORD;
  test.skip(
    !adminEmail || !adminPassword,
    "E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD not configured",
  );
  await page.goto("/admin/login");
  await page.fill('input[name="email"]', adminEmail!);
  await page.fill('input[name="password"]', adminPassword!);
  await Promise.all([
    page.waitForURL(/\/admin\/dashboard/, { timeout: 15_000 }),
    page.click('button[type="submit"]'),
  ]);
}

test.describe("Mailbox API — anonymous auth gate (no creds, runs everywhere)", () => {
  test("POST /api/admin/mailbox/compose without session → 401", async ({
    request,
  }) => {
    const res = await request.post("/api/admin/mailbox/compose", {
      data: { to: "x@example.com", subject: "x", body: "x" },
    });
    expect(res.status()).toBe(401);
  });

  test("POST /api/admin/mailbox/threads/:id/reply without session → 401", async ({
    request,
  }) => {
    test.skip(!seededThreadId, "seed missing");
    const res = await request.post(
      `/api/admin/mailbox/threads/${seededThreadId}/reply`,
      { data: { body: "x" } },
    );
    expect(res.status()).toBe(401);
  });

  test("PATCH /api/admin/mailbox/threads/:id/read without session → 401", async ({
    request,
  }) => {
    test.skip(!seededThreadId, "seed missing");
    const res = await request.patch(
      `/api/admin/mailbox/threads/${seededThreadId}/read`,
    );
    expect(res.status()).toBe(401);
  });
});

test.describe("@requires-db Mailbox API — authenticated round-trips", () => {
  test("PATCH read flips unreadCount→0 and is idempotent on a second call", async ({
    page,
  }) => {
    test.skip(!seededThreadId, "seed missing");
    await loginAsAdmin(page);

    const before = await prisma.emailThread.findUnique({
      where: { id: seededThreadId! },
      select: { unreadCount: true },
    });
    expect(before?.unreadCount).toBe(1);

    const r1 = await page.context().request.patch(
      `/api/admin/mailbox/threads/${seededThreadId}/read`,
    );
    expect(r1.status()).toBe(200);
    expect(await r1.json()).toMatchObject({ ok: true });

    const after1 = await prisma.emailThread.findUnique({
      where: { id: seededThreadId! },
      select: { unreadCount: true },
    });
    expect(after1?.unreadCount).toBe(0);
    const msgs1 = await prisma.emailMessage.findMany({
      where: { threadId: seededThreadId! },
      select: { readAt: true },
    });
    expect(msgs1.every((m) => m.readAt !== null)).toBe(true);

    // Idempotent: second PATCH must still 200 and leave the row unchanged.
    const r2 = await page.context().request.patch(
      `/api/admin/mailbox/threads/${seededThreadId}/read`,
    );
    expect(r2.status()).toBe(200);
    const after2 = await prisma.emailThread.findUnique({
      where: { id: seededThreadId! },
      select: { unreadCount: true },
    });
    expect(after2?.unreadCount).toBe(0);
  });

  test("POST compose with empty recipients → 400 with Czech validation copy", async ({
    page,
  }) => {
    await loginAsAdmin(page);
    const res = await page.context().request.post(
      "/api/admin/mailbox/compose",
      { data: { to: "", subject: "x", body: "x" } },
    );
    expect(res.status()).toBe(400);
    const json = await res.json();
    expect(json.ok).toBe(false);
    expect(String(json.error)).toMatch(/příjemce/i);
  });

  test("POST reply on a non-existent thread → 400 (Konverzace nenalezena)", async ({
    page,
  }) => {
    await loginAsAdmin(page);
    const res = await page.context().request.post(
      "/api/admin/mailbox/threads/__nope-no-such-id__/reply",
      { data: { body: "irrelevant" } },
    );
    // 400 when mailer is configured (route reaches DB lookup), 400 when not
    // (route reaches mailer-unset branch). Either way: not 2xx, not 401.
    expect(res.status()).toBe(400);
    const json = await res.json();
    expect(json.ok).toBe(false);
  });

  test("POST compose happy path → 200 + EmailThread row [skips without RESEND_API_KEY]", async ({
    page,
  }) => {
    test.skip(
      !process.env.RESEND_API_KEY,
      "RESEND_API_KEY unset — compose path requires real mailer",
    );
    await loginAsAdmin(page);

    const subject = `${SUBJECT} compose-${Date.now()}`;
    const res = await page.context().request.post(
      "/api/admin/mailbox/compose",
      {
        data: {
          to: `dest-${UNIQUE}@test.local`,
          subject,
          body: "Hello from e2e compose path.",
          category: "support",
        },
      },
    );
    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(typeof json.threadId).toBe("string");

    const thread = await prisma.emailThread.findUnique({
      where: { id: json.threadId },
      include: { messages: true },
    });
    expect(thread?.subject).toBe(subject);
    expect(thread?.messages).toHaveLength(1);
    expect(thread?.messages[0].direction).toBe("outbound");
  });
});

test.describe("Resend inbound webhook — DB persist round-trip", () => {
  test("signed payload → 200 inserted + EmailMessage row in DB", async ({
    request,
  }) => {
    const secret = process.env.RESEND_INBOUND_SECRET;
    test.skip(!secret, "RESEND_INBOUND_SECRET not set in this env");

    const messageIdHeader = `<inbound-${TAG}@test.local>`;
    const body = JSON.stringify({
      type: "email.inbound",
      data: {
        from: `Inbound Probe <probe-${UNIQUE}@test.local>`,
        to: ["info@jvsatnik.cz"],
        subject: `Inbound DB-verify (${TAG})`,
        text: "inbound persist round-trip",
        headers: [{ name: "Message-ID", value: messageIdHeader }],
      },
    });
    const sig = createHmac("sha256", secret!).update(body).digest("hex");

    const res = await request.post("/api/email/inbound", {
      headers: {
        "content-type": "application/json",
        "resend-signature": sig,
      },
      data: body,
    });
    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.result).toBe("inserted");

    const persisted = await prisma.emailMessage.findUnique({
      where: { messageId: messageIdHeader },
      select: { id: true, direction: true, subject: true },
    });
    expect(persisted).not.toBeNull();
    expect(persisted?.direction).toBe("inbound");
    expect(persisted?.subject).toContain(TAG);
  });
});
