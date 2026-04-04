import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  prismaInitPromise: Promise<PrismaClient> | undefined;
};

async function createClient(): Promise<PrismaClient> {
  if (process.env.TURSO_AUTH_TOKEN && process.env.DATABASE_URL?.startsWith("libsql://")) {
    const { createClient } = await import("@libsql/client");
    const { PrismaLibSql } = await import("@prisma/adapter-libsql");
    const libsql = createClient({
      url: process.env.DATABASE_URL,
      authToken: process.env.TURSO_AUTH_TOKEN,
    });
    const adapter = new PrismaLibSql(libsql as any);
    return new PrismaClient({ adapter } as any);
  }
  return new PrismaClient();
}

export async function getDb(): Promise<PrismaClient> {
  if (globalForPrisma.prisma) return globalForPrisma.prisma;
  if (!globalForPrisma.prismaInitPromise) {
    globalForPrisma.prismaInitPromise = createClient().then((c) => {
      globalForPrisma.prisma = c;
      return c;
    });
  }
  return globalForPrisma.prismaInitPromise;
}

// Synchronous export for backward compat — works after first getDb() call
// For new code, prefer `const db = await getDb()`
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop: string) {
    // If already initialized, use directly
    if (globalForPrisma.prisma) {
      return (globalForPrisma.prisma as any)[prop];
    }
    // Return a model-like proxy that auto-awaits initialization
    return new Proxy({} as any, {
      get(_, method: string) {
        return (...args: any[]) =>
          getDb().then((db) => (db as any)[prop][method](...args));
      },
    });
  },
});
