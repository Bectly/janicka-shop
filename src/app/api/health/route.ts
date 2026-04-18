import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const startedAt = Date.now();

export async function GET() {
  return NextResponse.json(
    {
      status: "ok",
      version: process.env.npm_package_version ?? null,
      commit: process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GIT_COMMIT_SHA ?? null,
      node: process.version,
      env: process.env.NODE_ENV ?? "unknown",
      uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
      now: new Date().toISOString(),
    },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    }
  );
}
