import { NextResponse } from "next/server";
import { connection } from "next/server";
import { getDb } from "@/lib/db";

const startedAt = Date.now();

type ProbeStatus = "ok" | "down" | "n/a";

async function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return await Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`timeout after ${ms}ms`)), ms),
    ),
  ]);
}

async function pingDb(): Promise<ProbeStatus> {
  try {
    const db = await withTimeout(getDb(), 2000);
    await withTimeout(db.$queryRaw`SELECT 1`, 2000);
    return "ok";
  } catch {
    return "down";
  }
}

type EmailProbe = "ok" | "missing_env" | "error";

interface EmailProbeResult {
  status: EmailProbe;
  missing?: string;
}

function probeEmail(): EmailProbeResult {
  try {
    const apiKey = process.env.RESEND_API_KEY?.trim();
    if (!apiKey) return { status: "missing_env", missing: "RESEND_API_KEY" };

    const senderVars = [
      "EMAIL_FROM_ORDERS",
      "EMAIL_FROM_INFO",
      "EMAIL_FROM_NEWSLETTER",
      "EMAIL_FROM_SUPPORT",
      "EMAIL_REPLY_TO",
    ] as const;
    for (const name of senderVars) {
      const raw = process.env[name]?.trim();
      if (!raw) continue;
      if (!raw.includes("@")) {
        return { status: "missing_env", missing: `${name} (invalid address)` };
      }
    }

    return { status: "ok" };
  } catch {
    return { status: "error" };
  }
}

async function pingRedis(): Promise<ProbeStatus> {
  if (!process.env.REDIS_URL) return "n/a";
  try {
    const { default: Redis } = await import("ioredis");
    const client = new Redis(process.env.REDIS_URL, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      connectTimeout: 1500,
      commandTimeout: 1500,
      retryStrategy: () => null,
    });
    try {
      await withTimeout(client.connect(), 1500);
      await withTimeout(client.ping(), 1500);
      return "ok";
    } finally {
      client.disconnect();
    }
  } catch {
    return "down";
  }
}

export async function GET() {
  await connection();

  const [db, redis] = await Promise.all([pingDb(), pingRedis()]);
  const email = probeEmail();
  const ok = db === "ok";

  return NextResponse.json(
    {
      ok,
      db,
      redis,
      email: email.status,
      ...(email.missing ? { emailMissing: email.missing } : {}),
      ts: new Date().toISOString(),
      version: process.env.npm_package_version ?? null,
      commit: process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GIT_COMMIT_SHA ?? null,
      node: process.version,
      env: process.env.NODE_ENV ?? "unknown",
      uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
    },
    {
      status: ok ? 200 : 503,
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    },
  );
}
