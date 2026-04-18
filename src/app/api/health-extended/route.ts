import { NextResponse } from "next/server";
import { connection } from "next/server";
import os from "node:os";
import { statfs } from "node:fs/promises";

const startedAt = Date.now();

const THRESHOLDS = {
  cpuLoadPct: 80,
  memPct: 90,
  diskPct: 85,
  swapPct: 50,
};

export async function GET(request: Request) {
  // Opt into dynamic rendering under `cacheComponents: true`.
  await connection();

  // Auth: require bearer token matching CRON_SECRET so threshold data isn't
  // publicly scrapeable (exposes RAM/CPU of origin box — reconnaissance aid).
  const expected = process.env.CRON_SECRET ?? process.env.HEALTH_EXTENDED_SECRET;
  if (expected) {
    const header = request.headers.get("authorization") ?? "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : "";
    if (token !== expected) {
      return NextResponse.json({ status: "unauthorized" }, { status: 401 });
    }
  }

  const loadAvg1min = os.loadavg()[0];
  const cpuCount = os.cpus().length || 1;
  const cpuLoadPct = Math.round((loadAvg1min / cpuCount) * 100);

  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const memPct = totalMem > 0 ? Math.round(((totalMem - freeMem) / totalMem) * 100) : 0;

  let diskPct = 0;
  try {
    const s = await statfs("/");
    const total = s.blocks * s.bsize;
    const free = s.bavail * s.bsize;
    diskPct = total > 0 ? Math.round(((total - free) / total) * 100) : 0;
  } catch {
    diskPct = -1;
  }

  const cpuBreach = cpuLoadPct >= THRESHOLDS.cpuLoadPct;
  const memBreach = memPct >= THRESHOLDS.memPct;
  const diskBreach = diskPct >= THRESHOLDS.diskPct;
  const anyBreach = cpuBreach || memBreach || diskBreach;

  return NextResponse.json(
    {
      status: anyBreach ? "breach" : "ok",
      thresholds: THRESHOLDS,
      cpu_load_pct: cpuLoadPct,
      cpu_load_1min: Number(loadAvg1min.toFixed(2)),
      cpu_count: cpuCount,
      mem_pct: memPct,
      mem_total_mb: Math.round(totalMem / 1024 / 1024),
      mem_free_mb: Math.round(freeMem / 1024 / 1024),
      disk_pct: diskPct,
      uptime_seconds: Math.round((Date.now() - startedAt) / 1000),
      now: new Date().toISOString(),
      breaches: {
        cpu: cpuBreach,
        mem: memBreach,
        disk: diskBreach,
      },
    },
    {
      headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
    }
  );
}
