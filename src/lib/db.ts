import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  prismaInitPromise: Promise<PrismaClient> | undefined;
};

async function createClient(): Promise<PrismaClient> {
  const tursoUrl = process.env.TURSO_DATABASE_URL;
  const tursoToken = process.env.TURSO_AUTH_TOKEN;

  if (tursoUrl && tursoToken) {
    const { PrismaLibSQL } = await import("@prisma/adapter-libsql");
    const adapter = new PrismaLibSQL({
      url: tursoUrl.trim(),
      authToken: tursoToken.trim(),
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Prisma constructor types don't expose `adapter` without bundler resolution
    return new PrismaClient({ adapter } as any);
  }

  // Local SQLite — enable WAL mode for concurrent readers during build
  // (prevents SQLITE_CANTOPEN / lock errors when Next.js build workers run in parallel)
  // Wrapped in try-catch: WAL pragma can fail in Next.js Cache env (different CWD) — non-fatal
  const client = new PrismaClient();
  try {
    await client.$executeRaw`PRAGMA journal_mode = WAL`;
  } catch {
    // Non-fatal — WAL mode is a perf optimization, not required for correctness
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
