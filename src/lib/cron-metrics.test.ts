import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextResponse } from "next/server";

const { requireCronSecretMock } = vi.hoisted(() => ({
  requireCronSecretMock: vi.fn(),
}));

vi.mock("@/lib/cron-auth", () => ({
  requireCronSecret: requireCronSecretMock,
}));
vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { wrapCronRoute } from "./cron-metrics";

function makeRequest() {
  return new Request("https://example.test/api/cron/x", {
    headers: { authorization: "Bearer test" },
  });
}

describe("wrapCronRoute — auth + GA4 metrics envelope", () => {
  const originalFetch = globalThis.fetch;
  const fetchMock = vi.fn();

  beforeEach(() => {
    requireCronSecretMock.mockReset();
    fetchMock.mockReset();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    delete process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID;
    delete process.env.GA4_API_SECRET;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("short-circuits with 401 when requireCronSecret rejects (no metrics dispatch)", async () => {
    requireCronSecretMock.mockReturnValueOnce(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    );
    const handler = vi.fn();

    const wrapped = wrapCronRoute("test-cron", handler);
    const res = await wrapped(makeRequest());

    expect(res.status).toBe(401);
    expect(handler).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("invokes handler and posts cron_duration_ms when GA4 env is configured", async () => {
    requireCronSecretMock.mockReturnValueOnce(null);
    process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID = "G-TEST";
    process.env.GA4_API_SECRET = "secret";
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    const handler = vi
      .fn()
      .mockResolvedValueOnce(NextResponse.json({ ok: true, sent: 3 }));

    const wrapped = wrapCronRoute("back-in-stock-notify", handler);
    const res = await wrapped(makeRequest());

    expect(handler).toHaveBeenCalledTimes(1);
    expect(res.status).toBe(200);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("https://www.google-analytics.com/mp/collect");
    expect(String(url)).toContain("measurement_id=G-TEST");
    expect(String(url)).toContain("api_secret=secret");
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.events[0].name).toBe("cron_duration_ms");
    expect(body.events[0].params.cron_name).toBe("back-in-stock-notify");
    expect(body.events[0].params.outcome).toBe("ok");
    expect(typeof body.events[0].params.duration_ms).toBe("number");
  });

  it("no-op metrics dispatch when GA4 env is missing (zero-impact on success path)", async () => {
    requireCronSecretMock.mockReturnValueOnce(null);
    const handler = vi
      .fn()
      .mockResolvedValueOnce(NextResponse.json({ ok: true }));

    const wrapped = wrapCronRoute("test-cron", handler);
    const res = await wrapped(makeRequest());

    expect(res.status).toBe(200);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("posts cron_error and returns 500 when handler throws", async () => {
    requireCronSecretMock.mockReturnValueOnce(null);
    process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID = "G-TEST";
    process.env.GA4_API_SECRET = "secret";
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    const handler = vi.fn().mockRejectedValueOnce(new Error("kaboom"));

    const wrapped = wrapCronRoute("similar-items", handler);
    const res = await wrapped(makeRequest());

    expect(res.status).toBe(500);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse(
      (fetchMock.mock.calls[0][1] as RequestInit).body as string,
    );
    expect(body.events[0].name).toBe("cron_error");
    expect(body.events[0].params.cron_name).toBe("similar-items");
    expect(body.events[0].params.error_message).toBe("kaboom");
  });

  it("does not propagate GA4 fetch failures (observability is best-effort)", async () => {
    requireCronSecretMock.mockReturnValueOnce(null);
    process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID = "G-TEST";
    process.env.GA4_API_SECRET = "secret";
    fetchMock.mockRejectedValueOnce(new Error("network down"));
    const handler = vi
      .fn()
      .mockResolvedValueOnce(NextResponse.json({ ok: true, sent: 0 }));

    const wrapped = wrapCronRoute("test-cron", handler);
    const res = await wrapped(makeRequest());

    expect(res.status).toBe(200);
    const payload = await res.json();
    expect(payload).toEqual({ ok: true, sent: 0 });
  });

  it("tags non-2xx handler responses with outcome=handler_error_response", async () => {
    requireCronSecretMock.mockReturnValueOnce(null);
    process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID = "G-TEST";
    process.env.GA4_API_SECRET = "secret";
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    const handler = vi
      .fn()
      .mockResolvedValueOnce(
        NextResponse.json({ error: "smtp" }, { status: 500 }),
      );

    const wrapped = wrapCronRoute("review-request", handler);
    const res = await wrapped(makeRequest());

    expect(res.status).toBe(500);
    const body = JSON.parse(
      (fetchMock.mock.calls[0][1] as RequestInit).body as string,
    );
    expect(body.events[0].name).toBe("cron_duration_ms");
    expect(body.events[0].params.outcome).toBe("handler_error_response");
    expect(body.events[0].params.status_code).toBe(500);
  });
});
