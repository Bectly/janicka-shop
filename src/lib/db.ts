import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

let _client: PrismaClient | undefined;

async function initTurso(): Promise<PrismaClient> {
  const { createClient } = await import("@libsql/client");
  const { PrismaLibSql } = await import("@prisma/adapter-libsql");
  const libsql = createClient({
    url: process.env.DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN!,
  });
  const adapter = new PrismaLibSql(libsql as any);
  return new PrismaClient({ adapter } as any);
}

const isTurso = typeof process !== "undefined" &&
  process.env.TURSO_AUTH_TOKEN &&
  process.env.DATABASE_URL?.startsWith("libsql://");

// For Edge runtime (middleware) — prisma is never actually called there,
// just imported through the module graph. Return a dummy that throws on use.
const isEdge = typeof (globalThis as any).EdgeRuntime === "string";

let _initPromise: Promise<PrismaClient> | undefined;

function getClient(): Promise<PrismaClient> {
  if (_client) return Promise.resolve(_client);
  if (globalForPrisma.prisma) {
    _client = globalForPrisma.prisma;
    return Promise.resolve(_client);
  }
  if (!_initPromise) {
    _initPromise = (isTurso ? initTurso() : Promise.resolve(new PrismaClient())).then((c) => {
      _client = c;
      if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = c;
      return c;
    });
  }
  return _initPromise;
}

// Proxy that awaits initialization on every property access
// Works with both sync (dev/SQLite) and async (prod/Turso) init
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop: string) {
    if (isEdge) {
      throw new Error("prisma cannot be used in Edge runtime");
    }
    if (_client) return (_client as any)[prop];
    // For model access (product, category, etc.) — return a proxy that awaits
    return new Proxy({} as any, {
      get(_, method: string) {
        return (...args: any[]) =>
          getClient().then((c) => (c as any)[prop][method](...args));
      },
    });
  },
});
