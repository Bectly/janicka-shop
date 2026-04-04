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
    return new PrismaClient({ adapter } as any);
  }
  return new PrismaClient();
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
