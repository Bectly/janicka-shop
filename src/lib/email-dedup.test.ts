import { describe, it, expect, vi, beforeEach } from "vitest";

const { findFirst, create } = vi.hoisted(() => ({
  findFirst: vi.fn(),
  create: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  getDb: async () => ({ emailDedupLog: { findFirst, create } }),
}));
vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { checkAndRecordEmailDispatch } from "./email-dedup";

describe("checkAndRecordEmailDispatch — cross-pipeline notify dedup gate", () => {
  beforeEach(() => {
    findFirst.mockReset();
    create.mockReset();
  });

  it("allows + records when no prior dispatch within 24h", async () => {
    findFirst.mockResolvedValueOnce(null);
    create.mockResolvedValueOnce({ id: "log_1" });

    const ok = await checkAndRecordEmailDispatch(
      "user@example.com",
      "prod_1",
      "back-in-stock",
    );

    expect(ok).toBe(true);
    expect(findFirst).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        email: "user@example.com",
        productId: "prod_1",
        eventType: "back-in-stock",
      }),
    });
  });

  it("skips when a different eventType fired within 24h for same (email, productId)", async () => {
    findFirst.mockResolvedValueOnce({ eventType: "wishlist-sold" });

    const ok = await checkAndRecordEmailDispatch(
      "user@example.com",
      "prod_1",
      "similar-item-arrived",
    );

    expect(ok).toBe(false);
    expect(create).not.toHaveBeenCalled();
  });

  it("skips when same eventType already exists (unique-constraint race lost)", async () => {
    findFirst.mockResolvedValueOnce(null);
    create.mockRejectedValueOnce(
      Object.assign(new Error("unique constraint"), { code: "P2002" }),
    );

    const ok = await checkAndRecordEmailDispatch(
      "user@example.com",
      "prod_1",
      "back-in-stock",
    );

    expect(ok).toBe(false);
  });

  it("uses 24h cutoff in the lookup query", async () => {
    findFirst.mockResolvedValueOnce(null);
    create.mockResolvedValueOnce({ id: "log_2" });

    const before = Date.now();
    await checkAndRecordEmailDispatch(
      "u@x.cz",
      "p1",
      "wishlist-sold",
    );
    const after = Date.now();

    const call = findFirst.mock.calls[0][0];
    expect(call.where.email).toBe("u@x.cz");
    expect(call.where.productId).toBe("p1");
    const cutoffMs = (call.where.sentAt.gte as Date).getTime();
    const expectedFloor = before - 24 * 60 * 60 * 1000;
    const expectedCeil = after - 24 * 60 * 60 * 1000;
    expect(cutoffMs).toBeGreaterThanOrEqual(expectedFloor);
    expect(cutoffMs).toBeLessThanOrEqual(expectedCeil);
  });

  it("fail-open: lookup error allows the send (logs only)", async () => {
    findFirst.mockRejectedValueOnce(new Error("db down"));

    const ok = await checkAndRecordEmailDispatch(
      "u@x.cz",
      "p1",
      "back-in-stock",
    );

    // Better to send a duplicate than to silently drop a notification.
    expect(ok).toBe(true);
    expect(create).not.toHaveBeenCalled();
  });
});
