import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  prismaInitPromise: Promise<PrismaClient> | undefined;
};

// #524f Phase 1b: opt-in query logging for one-day Vercel baseline.
// Enable by setting PERF_PROFILE_PRISMA=1 in Vercel env (preview or prod).
// Emits `[prisma-query] <ms>ms <sql>` to stdout so Vercel log filters pick it up.
const prismaQueryLog = process.env.PERF_PROFILE_PRISMA === "1";

type PrismaLogConfig = ConstructorParameters<typeof PrismaClient>[0];

function buildLogConfig(): PrismaLogConfig | undefined {
  if (!prismaQueryLog) return undefined;
  return {
    log: [
      { emit: "event", level: "query" },
      { emit: "stdout", level: "warn" },
      { emit: "stdout", level: "error" },
    ],
  } as PrismaLogConfig;
}

function attachQueryListener(client: PrismaClient) {
  if (!prismaQueryLog) return;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Prisma event types are opaque when log:event is conditional
  (client as any).$on("query", (e: { duration: number; query: string; params: string }) => {
    // Keep params out of stdout to avoid leaking PII; only duration + normalized query.
    console.log(`[prisma-query] ${e.duration}ms ${e.query}`);
  });
}

async function createClient(): Promise<PrismaClient> {
  const dbUrl = process.env.DATABASE_URL ?? "";
  const tursoUrl = process.env.TURSO_DATABASE_URL;
  const tursoToken = process.env.TURSO_AUTH_TOKEN;
  const logConfig = buildLogConfig();

  // Postgres: native connection (Phase 2 cutover, primary path).
  if (dbUrl.startsWith("postgres")) {
    const client = new PrismaClient(logConfig);
    attachQueryListener(client);
    return client;
  }

  // Turso/libsql legacy path — only functional when schema.prisma provider
  // is "sqlite". Kept for emergency rollback (revert schema + this branch).
  if (tursoUrl && tursoToken) {
    const { PrismaLibSQL } = await import("@prisma/adapter-libsql/web");
    const adapter = new PrismaLibSQL({
      url: tursoUrl.trim(),
      authToken: tursoToken.trim(),
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Prisma constructor types don't expose `adapter` without bundler resolution
    const client = new PrismaClient({ adapter, ...(logConfig ?? {}) } as any);
    attachQueryListener(client);
    return client;
  }

  // Local SQLite dev — only valid with sqlite-provider schema.
  const client = new PrismaClient(logConfig);
  attachQueryListener(client);
  try {
    await client.$executeRaw`PRAGMA journal_mode = WAL`;
  } catch {
    // Non-fatal — postgres rejects PRAGMA, sqlite WAL is a perf optimization.
  }
  return client;
}

export async function getDb(): Promise<PrismaClient> {
  if (globalForPrisma.prisma) return globalForPrisma.prisma;
  if (!globalForPrisma.prismaInitPromise) {
    globalForPrisma.prismaInitPromise = createClient()
      .then((c) => {
        globalForPrisma.prisma = c;
        return c;
      })
      .catch((err) => {
        globalForPrisma.prismaInitPromise = undefined; // allow retry on next call
        throw err;
      });
  }
  return globalForPrisma.prismaInitPromise;
}
