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
  return await import("./site-url");
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("getSiteUrl — whitespace stripping", () => {
  it("strips trailing newline", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://www.jvsatnik.cz\n");
    vi.stubEnv("NODE_ENV", "production");
    const { getSiteUrl } = await freshImport();
    expect(getSiteUrl()).toBe("https://www.jvsatnik.cz");
  });

  it("strips trailing CRLF", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://www.jvsatnik.cz\r\n");
    vi.stubEnv("NODE_ENV", "production");
    const { getSiteUrl } = await freshImport();
    expect(getSiteUrl()).toBe("https://www.jvsatnik.cz");
  });

  it("strips surrounding spaces", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "  https://www.jvsatnik.cz  ");
    vi.stubEnv("NODE_ENV", "production");
    const { getSiteUrl } = await freshImport();
    expect(getSiteUrl()).toBe("https://www.jvsatnik.cz");
  });

  it("returns clean value untouched", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://www.jvsatnik.cz");
    vi.stubEnv("NODE_ENV", "production");
    const { getSiteUrl } = await freshImport();
    expect(getSiteUrl()).toBe("https://www.jvsatnik.cz");
  });

  it("falls back in production when env is missing", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    vi.stubEnv("NODE_ENV", "production");
    const { getSiteUrl } = await freshImport();
    expect(getSiteUrl()).toBe("https://www.jvsatnik.cz");
  });

  it("falls back to localhost in development when env is missing", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    vi.stubEnv("NODE_ENV", "development");
    const { getSiteUrl } = await freshImport();
    expect(getSiteUrl()).toBe("http://localhost:3000");
  });

  it("allows localhost in development", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "http://localhost:3000");
    vi.stubEnv("NODE_ENV", "development");
    const { getSiteUrl } = await freshImport();
    expect(getSiteUrl()).toBe("http://localhost:3000");
  });
});

describe("checkSiteUrlEnv — boot-time guard (production)", () => {
  it("throws on trailing newline", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://www.jvsatnik.cz\n");
    vi.stubEnv("NODE_ENV", "production");
    const { checkSiteUrlEnv } = await freshImport();
    expect(() => checkSiteUrlEnv()).toThrow(/whitespace/);
  });

  it("throws on internal whitespace", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://www.jvsatnik.cz ");
    vi.stubEnv("NODE_ENV", "production");
    const { checkSiteUrlEnv } = await freshImport();
    expect(() => checkSiteUrlEnv()).toThrow(/whitespace/);
  });

  it("throws on *.vercel.app host", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://janicka-shop-abcd.vercel.app");
    vi.stubEnv("NODE_ENV", "production");
    const { checkSiteUrlEnv } = await freshImport();
    expect(() => checkSiteUrlEnv()).toThrow(/vercel\.app/);
  });

  it("does not throw on clean canonical URL", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://www.jvsatnik.cz");
    vi.stubEnv("NODE_ENV", "production");
    const { checkSiteUrlEnv } = await freshImport();
    expect(() => checkSiteUrlEnv()).not.toThrow();
  });

  it("is a no-op in development even with bad input", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://preview.vercel.app\n");
    vi.stubEnv("NODE_ENV", "development");
    const { checkSiteUrlEnv } = await freshImport();
    expect(() => checkSiteUrlEnv()).not.toThrow();
  });
});
