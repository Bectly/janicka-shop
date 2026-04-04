import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

let _initPromise: Promise<PrismaClient> | undefined;

async function initPrisma(): Promise<PrismaClient> {
  if (globalForPrisma.prisma) return globalForPrisma.prisma;

  let client: PrismaClient;

  // Production: use Turso (libsql) — dynamic import to avoid Edge bundling
  if (process.env.TURSO_AUTH_TOKEN && process.env.DATABASE_URL?.startsWith("libsql://")) {
    const { createClient } = await import("@libsql/client");
    const { PrismaLibSql } = await import("@prisma/adapter-libsql");
    const libsql = createClient({
      url: process.env.DATABASE_URL!,
      authToken: process.env.TURSO_AUTH_TOKEN,
    });
    const adapter = new PrismaLibSql(libsql as any);
    client = new PrismaClient({ adapter } as any);
  } else {
    // Dev: use local SQLite
    client = new PrismaClient();
  }

  if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prisma = client;
  }
  return client;
}

function getDb(): Promise<PrismaClient> {
  if (!_initPromise) {
    _initPromise = initPrisma();
  }
  return _initPromise;
}

// Proxy that lazily initializes Prisma on first property access
// This lets existing code use `prisma.product.findMany()` without await on the import
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    if (globalForPrisma.prisma) {
      return (globalForPrisma.prisma as any)[prop];
    }
    // Return an async-compatible trap
    const promise = getDb();
    return new Proxy(() => {}, {
      get(_, subProp) {
        return (...args: any[]) =>
          promise.then((client) => (client as any)[prop][subProp](...args));
      },
      apply(_, __, args) {
        return promise.then((client) => (client as any)[prop](...args));
      },
    });
  },
});

export { getDb };
