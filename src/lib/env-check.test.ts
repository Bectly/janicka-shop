import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

vi.mock("@/lib/logger", () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

async function freshImport() {
  vi.resetModules();
  return await import("./env-check");
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("checkPublicUrlEnv — boot-time guard (production)", () => {
  it("throws on trailing newline", async () => {
    vi.stubEnv("NEXT_PUBLIC_R2_PUBLIC_URL", "https://pub-x.r2.dev\n");
    vi.stubEnv("NODE_ENV", "production");
    const { checkPublicUrlEnv } = await freshImport();
    expect(() => checkPublicUrlEnv("NEXT_PUBLIC_R2_PUBLIC_URL")).toThrow(
      /whitespace/
    );
  });

  it("throws on trailing CRLF", async () => {
    vi.stubEnv("NEXT_PUBLIC_R2_PUBLIC_URL", "https://pub-x.r2.dev\r\n");
    vi.stubEnv("NODE_ENV", "production");
    const { checkPublicUrlEnv } = await freshImport();
    expect(() => checkPublicUrlEnv("NEXT_PUBLIC_R2_PUBLIC_URL")).toThrow(
      /whitespace/
    );
  });

  it("throws on internal whitespace", async () => {
    vi.stubEnv("NEXT_PUBLIC_R2_PUBLIC_URL", "https://pub-x.r2.dev ");
    vi.stubEnv("NODE_ENV", "production");
    const { checkPublicUrlEnv } = await freshImport();
    expect(() => checkPublicUrlEnv("NEXT_PUBLIC_R2_PUBLIC_URL")).toThrow(
      /whitespace/
    );
  });

  it("throws when scheme is missing", async () => {
    vi.stubEnv("NEXT_PUBLIC_R2_PUBLIC_URL", "pub-x.r2.dev");
    vi.stubEnv("NODE_ENV", "production");
    const { checkPublicUrlEnv } = await freshImport();
    expect(() => checkPublicUrlEnv("NEXT_PUBLIC_R2_PUBLIC_URL")).toThrow(
      /valid http\(s\) URL/
    );
  });

  it("throws when scheme is non-http", async () => {
    vi.stubEnv("NEXT_PUBLIC_R2_PUBLIC_URL", "ftp://pub-x.r2.dev");
    vi.stubEnv("NODE_ENV", "production");
    const { checkPublicUrlEnv } = await freshImport();
    expect(() => checkPublicUrlEnv("NEXT_PUBLIC_R2_PUBLIC_URL")).toThrow(
      /valid http\(s\) URL/
    );
  });

  it("does not throw on clean https URL", async () => {
    vi.stubEnv("NEXT_PUBLIC_R2_PUBLIC_URL", "https://pub-x.r2.dev");
    vi.stubEnv("NODE_ENV", "production");
    const { checkPublicUrlEnv } = await freshImport();
    expect(() =>
      checkPublicUrlEnv("NEXT_PUBLIC_R2_PUBLIC_URL")
    ).not.toThrow();
  });

  it("does not throw on clean http URL (allowed shape)", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://internal.test");
    vi.stubEnv("NODE_ENV", "production");
    const { checkPublicUrlEnv } = await freshImport();
    expect(() => checkPublicUrlEnv("NEXT_PUBLIC_APP_URL")).not.toThrow();
  });

  it("returns silently when env is unset and requireSet is false", async () => {
    vi.stubEnv("NEXT_PUBLIC_R2_PUBLIC_URL", "");
    vi.stubEnv("NODE_ENV", "production");
    const { checkPublicUrlEnv } = await freshImport();
    expect(() =>
      checkPublicUrlEnv("NEXT_PUBLIC_R2_PUBLIC_URL")
    ).not.toThrow();
  });

  it("throws when env is unset and requireSet is true", async () => {
    vi.stubEnv("NEXT_PUBLIC_R2_PUBLIC_URL", "");
    vi.stubEnv("NODE_ENV", "production");
    const { checkPublicUrlEnv } = await freshImport();
    expect(() =>
      checkPublicUrlEnv("NEXT_PUBLIC_R2_PUBLIC_URL", { requireSet: true })
    ).toThrow(/missing in production/);
  });

  it("is a no-op in development even with bad input", async () => {
    vi.stubEnv("NEXT_PUBLIC_R2_PUBLIC_URL", "not-a-url\n");
    vi.stubEnv("NODE_ENV", "development");
    const { checkPublicUrlEnv } = await freshImport();
    expect(() =>
      checkPublicUrlEnv("NEXT_PUBLIC_R2_PUBLIC_URL")
    ).not.toThrow();
  });

  it("enforces requiredHostSuffix when set", async () => {
    vi.stubEnv("NEXT_PUBLIC_R2_PUBLIC_URL", "https://example.com");
    vi.stubEnv("NODE_ENV", "production");
    const { checkPublicUrlEnv } = await freshImport();
    expect(() =>
      checkPublicUrlEnv("NEXT_PUBLIC_R2_PUBLIC_URL", {
        requiredHostSuffix: ".r2.dev",
      })
    ).toThrow(/required suffix/);
  });

  it("passes requiredHostSuffix when host matches", async () => {
    vi.stubEnv("NEXT_PUBLIC_R2_PUBLIC_URL", "https://pub-abc.r2.dev");
    vi.stubEnv("NODE_ENV", "production");
    const { checkPublicUrlEnv } = await freshImport();
    expect(() =>
      checkPublicUrlEnv("NEXT_PUBLIC_R2_PUBLIC_URL", {
        requiredHostSuffix: ".r2.dev",
      })
    ).not.toThrow();
  });
});

describe("checkR2PublicUrlEnv / checkAppUrlEnv — wired wrappers", () => {
  it("checkR2PublicUrlEnv throws on whitespace in prod", async () => {
    vi.stubEnv("NEXT_PUBLIC_R2_PUBLIC_URL", "https://pub-x.r2.dev\n");
    vi.stubEnv("NODE_ENV", "production");
    const { checkR2PublicUrlEnv } = await freshImport();
    expect(() => checkR2PublicUrlEnv()).toThrow(/whitespace/);
  });

  it("checkAppUrlEnv throws on missing scheme in prod", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "jvsatnik.cz");
    vi.stubEnv("NODE_ENV", "production");
    const { checkAppUrlEnv } = await freshImport();
    expect(() => checkAppUrlEnv()).toThrow(/valid http\(s\) URL/);
  });

  it("both wrappers no-op in development", async () => {
    vi.stubEnv("NEXT_PUBLIC_R2_PUBLIC_URL", "garbage\n");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "garbage\n");
    vi.stubEnv("NODE_ENV", "development");
    const { checkR2PublicUrlEnv, checkAppUrlEnv } = await freshImport();
    expect(() => checkR2PublicUrlEnv()).not.toThrow();
    expect(() => checkAppUrlEnv()).not.toThrow();
  });

  it("both wrappers no-op when env unset in prod (warn-only handled by getter)", async () => {
    vi.stubEnv("NEXT_PUBLIC_R2_PUBLIC_URL", "");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
    vi.stubEnv("NODE_ENV", "production");
    const { checkR2PublicUrlEnv, checkAppUrlEnv } = await freshImport();
    expect(() => checkR2PublicUrlEnv()).not.toThrow();
    expect(() => checkAppUrlEnv()).not.toThrow();
  });
});
