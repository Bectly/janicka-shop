import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  createComgatePayment,
  getComgatePaymentStatus,
  refundComgatePayment,
} from "./comgate";
import { ComgateError } from "./types";

const ENV_KEYS = [
  "COMGATE_MERCHANT_ID",
  "COMGATE_SECRET",
  "COMGATE_TEST",
  "NEXT_PUBLIC_APP_URL",
] as const;
const savedEnv: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const k of ENV_KEYS) savedEnv[k] = process.env[k];
  process.env.COMGATE_MERCHANT_ID = "123456";
  process.env.COMGATE_SECRET = "secret-xyz";
  process.env.COMGATE_TEST = "true";
  process.env.NEXT_PUBLIC_APP_URL = "https://shop.test";
  vi.restoreAllMocks();
});

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (savedEnv[k] === undefined) delete process.env[k];
    else process.env[k] = savedEnv[k];
  }
});

function mockFetchResponse(body: string, ok = true) {
  return vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(body, {
      status: ok ? 200 : 500,
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    }),
  );
}

describe("createComgatePayment", () => {
  it("throws when COMGATE_MERCHANT_ID or COMGATE_SECRET missing", async () => {
    delete process.env.COMGATE_MERCHANT_ID;
    await expect(
      createComgatePayment({
        refId: "JN-260403-A1B2C3D4",
        priceCzk: 100,
        email: "x@y.cz",
        label: "Obj",
      }),
    ).rejects.toThrow(/COMGATE_MERCHANT_ID/);
  });

  it("converts CZK to hellers and returns transId + redirect on success", async () => {
    const spy = mockFetchResponse(
      "code=0&message=OK&transId=ABCD-1234-EFGH&redirect=https%3A%2F%2Fpayments.comgate.cz%2Fclient%2Finstructions%2Findex",
    );

    const result = await createComgatePayment({
      refId: "JN-260403-A1B2C3D4",
      priceCzk: 1234.5,
      email: "customer@example.cz",
      label: "Obj JN",
    });

    expect(result.transId).toBe("ABCD-1234-EFGH");
    expect(result.redirect).toBe(
      "https://payments.comgate.cz/client/instructions/index",
    );

    // Inspect the outgoing body: price must be in hellers (integer), not CZK.
    const call = spy.mock.calls[0];
    expect(call[0]).toBe("https://payments.comgate.cz/v1.0/create");
    const body = new URLSearchParams(call[1]!.body as string);
    expect(body.get("price")).toBe("123450");
    expect(body.get("curr")).toBe("CZK");
    expect(body.get("country")).toBe("CZ");
    expect(body.get("lang")).toBe("cs");
    expect(body.get("prepareOnly")).toBe("true");
    expect(body.get("test")).toBe("true");
    expect(body.get("merchant")).toBe("123456");
    expect(body.get("secret")).toBe("secret-xyz");
    expect(body.get("refId")).toBe("JN-260403-A1B2C3D4");
    expect(body.get("method")).toBe("ALL");
  });

  it("rounds CZK amounts to nearest heller (no floating-point drift)", async () => {
    const spy = mockFetchResponse(
      "code=0&message=OK&transId=T&redirect=https%3A%2F%2Fx",
    );
    await createComgatePayment({
      refId: "R",
      priceCzk: 0.1 + 0.2, // 0.30000000000000004
      email: "a@b.cz",
      label: "L",
    });
    const body = new URLSearchParams(spy.mock.calls[0][1]!.body as string);
    expect(body.get("price")).toBe("30");
  });

  it("appends accessToken to return URL when provided (no leakage without it)", async () => {
    const spy = mockFetchResponse(
      "code=0&message=OK&transId=T&redirect=https%3A%2F%2Fx",
    );
    await createComgatePayment({
      refId: "JN-260403-A1B2C3D4",
      priceCzk: 100,
      email: "a@b.cz",
      label: "L",
      accessToken: "tok-abc/def",
    });
    const body = new URLSearchParams(spy.mock.calls[0][1]!.body as string);
    const returnUrl = body.get("url")!;
    expect(returnUrl).toContain("refId=JN-260403-A1B2C3D4");
    expect(returnUrl).toContain("token=tok-abc%2Fdef");
  });

  it("sets embedded=true only when requested (inline iframe gate)", async () => {
    mockFetchResponse("code=0&message=OK&transId=T&redirect=https%3A%2F%2Fx");
    await createComgatePayment({
      refId: "R",
      priceCzk: 100,
      email: "a@b.cz",
      label: "L",
      embedded: true,
    });
    const body1 = new URLSearchParams(
      (vi.mocked(fetch).mock.calls[0][1]!.body as string),
    );
    expect(body1.get("embedded")).toBe("true");

    vi.mocked(fetch).mockClear();
    mockFetchResponse("code=0&message=OK&transId=T&redirect=https%3A%2F%2Fx");
    await createComgatePayment({
      refId: "R",
      priceCzk: 100,
      email: "a@b.cz",
      label: "L",
    });
    const body2 = new URLSearchParams(
      (vi.mocked(fetch).mock.calls[0][1]!.body as string),
    );
    expect(body2.has("embedded")).toBe(false);
  });

  it("throws ComgateError when API returns a non-zero code", async () => {
    mockFetchResponse("code=1309&message=Merchant%20not%20allowed");
    await expect(
      createComgatePayment({
        refId: "R",
        priceCzk: 100,
        email: "a@b.cz",
        label: "L",
      }),
    ).rejects.toMatchObject({
      name: "ComgateError",
      code: 1309,
      message: expect.stringContaining("Merchant not allowed"),
    });
  });

  it("throws ComgateError when transId or redirect missing from success response", async () => {
    mockFetchResponse("code=0&message=OK");
    await expect(
      createComgatePayment({
        refId: "R",
        priceCzk: 100,
        email: "a@b.cz",
        label: "L",
      }),
    ).rejects.toBeInstanceOf(ComgateError);
  });
});

describe("getComgatePaymentStatus", () => {
  it("parses a PAID status response", async () => {
    mockFetchResponse(
      "code=0&merchant=123456&test=true&price=12345&curr=CZK&label=Obj&refId=R&method=CARD_CZ_CSOB_2&email=a%40b.cz&transId=T&status=PAID",
    );
    const res = await getComgatePaymentStatus("T");
    expect(res.status).toBe("PAID");
    expect(res.price).toBe(12345);
    expect(res.test).toBe(true);
    expect(res.email).toBe("a@b.cz");
  });

  it("maps all four documented Comgate statuses", async () => {
    for (const status of ["PENDING", "PAID", "CANCELLED", "AUTHORIZED"]) {
      vi.mocked(fetch).mockClear?.();
      mockFetchResponse(
        `code=0&merchant=m&test=false&price=100&curr=CZK&label=L&refId=R&method=ALL&email=a%40b.cz&transId=T&status=${status}`,
      );
      const res = await getComgatePaymentStatus("T");
      expect(res.status).toBe(status);
    }
  });

  it("rejects an unknown status value", async () => {
    mockFetchResponse(
      "code=0&merchant=m&test=false&price=0&curr=CZK&label=L&refId=R&method=ALL&email=a%40b.cz&transId=T&status=WEIRD",
    );
    await expect(getComgatePaymentStatus("T")).rejects.toMatchObject({
      name: "ComgateError",
      message: expect.stringContaining("Unknown Comgate payment status"),
    });
  });

  it("propagates API error code as ComgateError", async () => {
    mockFetchResponse("code=1400&message=Transaction%20not%20found");
    await expect(getComgatePaymentStatus("T")).rejects.toMatchObject({
      name: "ComgateError",
      code: 1400,
    });
  });
});

describe("refundComgatePayment", () => {
  it("sends no amount field for a full refund", async () => {
    const spy = mockFetchResponse("code=0&message=OK");
    await refundComgatePayment("T-123");
    const body = new URLSearchParams(spy.mock.calls[0][1]!.body as string);
    expect(body.has("amount")).toBe(false);
    expect(body.get("transId")).toBe("T-123");
  });

  it("sends amount in hellers for a partial refund", async () => {
    const spy = mockFetchResponse("code=0&message=OK");
    await refundComgatePayment("T-123", 49.5);
    const body = new URLSearchParams(spy.mock.calls[0][1]!.body as string);
    expect(body.get("amount")).toBe("4950");
  });

  it("throws ComgateError when refund fails", async () => {
    mockFetchResponse("code=1500&message=Refund%20exceeds%20captured");
    await expect(refundComgatePayment("T-123", 100)).rejects.toMatchObject({
      name: "ComgateError",
      code: 1500,
    });
  });
});
