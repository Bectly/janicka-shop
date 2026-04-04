import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

let _client: PrismaClient | undefined;

export function getPrisma(): PrismaClient {
  if (_client) return _client;
  if (globalForPrisma.prisma) {
    _client = globalForPrisma.prisma;
    return _client;
  }

  if (process.env.TURSO_AUTH_TOKEN && process.env.DATABASE_URL?.startsWith("libsql://")) {
    // Dynamic require — only runs in Node.js runtime, never in Edge
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { createClient } = require("@libsql/client");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { PrismaLibSql } = require("@prisma/adapter-libsql");
    const libsql = createClient({
      url: process.env.DATABASE_URL,
      authToken: process.env.TURSO_AUTH_TOKEN,
    });
    const adapter = new PrismaLibSql(libsql);
    _client = new PrismaClient({ adapter } as any);
  } else {
    _client = new PrismaClient();
  }

  if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prisma = _client;
  }
  return _client;
}

// Lazy getter — does NOT init at import time (safe for Edge middleware)
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    return (getPrisma() as any)[prop];
  },
});
