import { describe, it, expect, vi, beforeEach } from "vitest";

const authMock = vi.fn();

vi.mock("@/lib/auth", () => ({
  auth: () => authMock(),
}));

import { requireAdmin } from "@/lib/require-admin";

describe("requireAdmin", () => {
  beforeEach(() => {
    authMock.mockReset();
  });

  it("throws Unauthorized when there is no session", async () => {
    authMock.mockResolvedValue(null);
    await expect(requireAdmin()).rejects.toThrow("Unauthorized");
  });

  it("throws Unauthorized when session has no user", async () => {
    authMock.mockResolvedValue({ user: undefined });
    await expect(requireAdmin()).rejects.toThrow("Unauthorized");
  });

  it("throws Unauthorized when user role is customer (not admin)", async () => {
    authMock.mockResolvedValue({
      user: { id: "c1", email: "buyer@example.com", role: "customer" },
    });
    await expect(requireAdmin()).rejects.toThrow("Unauthorized");
  });

  it("throws Unauthorized when role is missing entirely", async () => {
    authMock.mockResolvedValue({
      user: { id: "x", email: "x@example.com" },
    });
    await expect(requireAdmin()).rejects.toThrow("Unauthorized");
  });

  it("returns the session when role is admin", async () => {
    const session = {
      user: { id: "a1", email: "admin@example.com", role: "admin" },
    };
    authMock.mockResolvedValue(session);
    await expect(requireAdmin()).resolves.toBe(session);
  });
});
