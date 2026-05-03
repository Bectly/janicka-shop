import { test, expect } from "@playwright/test";
import { createHmac } from "crypto";

// Inbound mailbox e2e (Task #1019 / Cycle #5231).
// Sanity-check the Resend Inbound webhook signature contract on
// /api/email/inbound. Skips when RESEND_INBOUND_SECRET is not set.
//
// Verifies:
//   1. POST without RESEND_INBOUND_SECRET configured → 503 (env unset).
//   2. POST with wrong signature → 401.
//   3. POST with correct HMAC-SHA256 of raw body → 200 (and no signature
//      bypass via missing Resend-Signature header).
//
// We don't depend on Resend's exact JSON envelope here — the route is
// permissive about shape, but we exercise the signature gate with a
// minimal valid payload that yields a real Message-ID.

const ENDPOINT = "/api/email/inbound";

function sign(body: string, secret: string): string {
  return createHmac("sha256", secret).update(body).digest("hex");
}

test.describe("Resend inbound webhook signature gate", () => {
  test("rejects missing signature when secret configured", async ({
    request,
  }) => {
    const secret = process.env.RESEND_INBOUND_SECRET;
    test.skip(!secret, "RESEND_INBOUND_SECRET not set in this env");

    const res = await request.post(ENDPOINT, {
      data: { type: "email.inbound", data: {} },
    });
    expect([401, 400]).toContain(res.status());
  });

  test("rejects wrong signature with 401", async ({ request }) => {
    const secret = process.env.RESEND_INBOUND_SECRET;
    test.skip(!secret, "RESEND_INBOUND_SECRET not set in this env");

    const body = JSON.stringify({ type: "email.inbound", data: {} });
    const res = await request.post(ENDPOINT, {
      headers: {
        "content-type": "application/json",
        "resend-signature": "deadbeef".repeat(8),
      },
      data: body,
    });
    expect(res.status()).toBe(401);
  });

  test("503 when secret unset (production must set it)", async ({
    request,
  }) => {
    test.skip(
      !!process.env.RESEND_INBOUND_SECRET,
      "secret IS set — different branch covered above",
    );
    const res = await request.post(ENDPOINT, {
      data: { type: "email.inbound", data: {} },
    });
    expect(res.status()).toBe(503);
  });

  test("accepts correctly signed payload", async ({ request }) => {
    const secret = process.env.RESEND_INBOUND_SECRET;
    test.skip(!secret, "RESEND_INBOUND_SECRET not set in this env");

    const messageId = `<e2e-${Date.now()}@jvsatnik.cz>`;
    const body = JSON.stringify({
      type: "email.inbound",
      data: {
        from: "Test Sender <test@example.com>",
        to: ["info@jvsatnik.cz"],
        subject: "E2E inbound webhook smoke",
        text: "hello from playwright",
        headers: [{ name: "Message-ID", value: messageId }],
      },
    });
    const sig = sign(body, secret!);
    const res = await request.post(ENDPOINT, {
      headers: {
        "content-type": "application/json",
        "resend-signature": sig,
      },
      data: body,
    });
    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(["inserted", "skipped"]).toContain(json.result);
  });
});
