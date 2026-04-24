/**
 * P4.3 — Worker queue integration tests.
 *
 * Exercises BullMQ queue mechanics against a real Redis instance using an
 * isolated test queue (`janicka-test-p43`) and an in-process test processor
 * (no Resend, no DB). The point is to validate:
 *
 *   Test 1 — throughput:         50 jobs delivered within 60s at concurrency 5
 *   Test 2 — mid-job kill:       job is re-queued and retried after stalled check
 *   Test 3 — bad payload:        isolated to failed queue, does not block healthy jobs
 *   Test 4 — graceful shutdown:  SIGTERM drains in-flight, no lost jobs
 *   Test 5 — Redis restart:      documented (run on staging, not local — local Redis
 *                                is shared with other JARVIS services)
 *
 * Usage:
 *   REDIS_URL=redis://localhost:6379 npx tsx scripts/workers/test-queue-integration.ts [1|2|3|4|all]
 *
 * Output: JSON summary on stdout + human log on stderr. Exits non-zero on failure.
 */

import { Queue, Worker, QueueEvents, type Processor } from "bullmq";
import IORedis from "ioredis";
import { spawn } from "node:child_process";

const TEST_QUEUE = "janicka-test-p43";
const REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6379";

interface TestResult {
  name: string;
  passed: boolean;
  durationMs: number;
  details: Record<string, unknown>;
  error?: string;
}

function log(msg: string): void {
  process.stderr.write(`[test-queue] ${msg}\n`);
}

function makeConnection(): IORedis {
  return new IORedis(REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });
}

async function drainTestQueue(): Promise<void> {
  const conn = makeConnection();
  const q = new Queue(TEST_QUEUE, { connection: conn });
  await q.obliterate({ force: true }).catch(() => undefined);
  await q.close();
  await conn.quit();
}

// ── Test 1: throughput ─────────────────────────────────────────────────────
async function test1Throughput(): Promise<TestResult> {
  const start = Date.now();
  const conn = makeConnection();
  const q = new Queue(TEST_QUEUE, {
    connection: conn,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "exponential", delay: 1_000 },
      removeOnComplete: true,
      removeOnFail: { age: 3600 },
    },
  });

  const TOTAL = 50;
  let processed = 0;

  const processor: Processor = async (job) => {
    // Simulate the shape of a real email send (100-200ms network latency).
    await new Promise((r) => setTimeout(r, 100 + Math.random() * 100));
    processed++;
    return { id: job.data.id };
  };

  const workerConn = makeConnection();
  const worker = new Worker(TEST_QUEUE, processor, {
    connection: workerConn,
    concurrency: 5,
  });

  const events = new QueueEvents(TEST_QUEUE, { connection: makeConnection() });
  await events.waitUntilReady();

  // Enqueue 50 jobs.
  const enqueueStart = Date.now();
  for (let i = 0; i < TOTAL; i++) {
    await q.add("test-throughput", { id: i });
  }
  const enqueueMs = Date.now() - enqueueStart;

  // Wait for drain (all processed) with 60s cap.
  const DEADLINE = 60_000;
  const t0 = Date.now();
  while (processed < TOTAL && Date.now() - t0 < DEADLINE) {
    await new Promise((r) => setTimeout(r, 100));
  }
  const drainMs = Date.now() - t0;

  await worker.close();
  await events.close();
  await q.close();
  await conn.quit();
  await workerConn.quit();

  const passed = processed === TOTAL && drainMs < 60_000;

  return {
    name: "Test 1: 50-job throughput within 60s",
    passed,
    durationMs: Date.now() - start,
    details: {
      total: TOTAL,
      processed,
      concurrency: 5,
      enqueueMs,
      drainMs,
      throughputJobsPerSec: +(processed / (drainMs / 1000)).toFixed(2),
    },
  };
}

// ── Test 2: mid-job kill → retry ───────────────────────────────────────────
async function test2MidJobKill(): Promise<TestResult> {
  const start = Date.now();
  await drainTestQueue();

  const conn = makeConnection();
  // Shorter stalled check + short lock so stalled recovery completes quickly.
  // Production defaults (30s lock / 30s stalled check) are fine — this test
  // validates the mechanism works, not the timing.
  const STALLED_CHECK_MS = 1_500;
  const LOCK_DURATION_MS = 3_000;

  // Spawn subprocess that will pick up a single job, "hang" forever, then be
  // SIGKILL'd. Once its lock expires (LOCK_DURATION_MS after kill), the retry
  // worker's stalled check will reclaim the job and reprocess it.
  const workerScript = `
    import { Worker } from "bullmq";
    import IORedis from "ioredis";
    const conn = new IORedis("${REDIS_URL}", { maxRetriesPerRequest: null, enableReadyCheck: false });
    const w = new Worker("${TEST_QUEUE}", async (job) => {
      process.stderr.write("subprocess: picked job " + job.id + "\\n");
      process.stdout.write("READY\\n");
      await new Promise(() => {}); // hang forever — parent kills us
    }, {
      connection: conn,
      concurrency: 1,
      stalledInterval: ${STALLED_CHECK_MS},
      maxStalledCount: 3,
      lockDuration: ${LOCK_DURATION_MS},
    });
    w.on("error", () => {});
  `;

  // Enqueue one job BEFORE starting the killable worker, so it's the first to
  // be picked. Use attempts=5 so retries are generous.
  const q = new Queue(TEST_QUEUE, { connection: conn });
  await q.add(
    "test-stall",
    { kind: "stall" },
    { attempts: 5, backoff: { type: "fixed", delay: 500 } },
  );

  // IMPORTANT: `npx tsx -e` spawns a *nested* node --eval child. A plain
  // child.kill("SIGKILL") terminates the npx/tsx wrapper but orphans the real
  // worker, which then keeps renewing the Redis lock forever and defeats the
  // stalled-recovery mechanism under test. Launch detached so the whole
  // process group shares a PGID, then kill the group.
  const child = spawn("npx", ["tsx", "-e", workerScript], {
    env: { ...process.env, REDIS_URL },
    stdio: ["ignore", "pipe", "pipe"],
    detached: true,
  });

  // Wait until subprocess reports it picked the job (READY), then kill it.
  const picked = await new Promise<boolean>((resolve) => {
    const timer = setTimeout(() => resolve(false), 15_000);
    child.stdout.on("data", (buf: Buffer) => {
      if (buf.toString().includes("READY")) {
        clearTimeout(timer);
        resolve(true);
      }
    });
  });

  const killGroup = (): void => {
    if (child.pid) {
      try {
        process.kill(-child.pid, "SIGKILL");
      } catch {
        try { child.kill("SIGKILL"); } catch { /* ignore */ }
      }
    }
  };

  if (!picked) {
    killGroup();
    await q.close();
    await conn.quit();
    return {
      name: "Test 2: mid-job kill → retry",
      passed: false,
      durationMs: Date.now() - start,
      details: {},
      error: "subprocess did not pick up job within 15s",
    };
  }

  log("killing subprocess mid-job (SIGKILL to process group)");
  killGroup();
  await new Promise((r) => setTimeout(r, 200));

  // Debug: verify job is still in active state (stuck on dead worker).
  const debugQ = new Queue(TEST_QUEUE, { connection: makeConnection() });
  log(`post-kill: active=${await debugQ.getActiveCount()} wait=${await debugQ.getWaitingCount()}`);
  await debugQ.close();

  // Start retry worker. It should pick up the stalled job after stalled check.
  let retryCompleted = false;
  let retryAttempts = 0;
  const retryConn = makeConnection();
  const retryWorker = new Worker(
    TEST_QUEUE,
    async (job) => {
      retryAttempts = job.attemptsMade + 1;
      retryCompleted = true;
      return { ok: true };
    },
    {
      connection: retryConn,
      concurrency: 1,
      stalledInterval: STALLED_CHECK_MS,
      maxStalledCount: 3,
      lockDuration: LOCK_DURATION_MS,
    },
  );

  // Wait up to 30s for stalled check + retry to land.
  const retryDeadline = Date.now() + 30_000;
  let ticks = 0;
  while (!retryCompleted && Date.now() < retryDeadline) {
    await new Promise((r) => setTimeout(r, 500));
    ticks++;
    if (ticks % 4 === 0) {
      const dq = new Queue(TEST_QUEUE, { connection: makeConnection() });
      log(
        `tick ${ticks}: active=${await dq.getActiveCount()} wait=${await dq.getWaitingCount()} failed=${await dq.getFailedCount()} completed=${await dq.getCompletedCount()}`,
      );
      await dq.close();
    }
  }

  await retryWorker.close();
  await q.close();
  await conn.quit();
  await retryConn.quit();

  return {
    name: "Test 2: mid-job kill → retry",
    passed: retryCompleted,
    durationMs: Date.now() - start,
    details: {
      stalledCheckMs: STALLED_CHECK_MS,
      lockDurationMs: LOCK_DURATION_MS,
      retryCompleted,
      retryAttemptsMade: retryAttempts,
    },
  };
}

// ── Test 3: bad payload isolation ──────────────────────────────────────────
async function test3BadPayloadIsolation(): Promise<TestResult> {
  const start = Date.now();
  await drainTestQueue();

  const conn = makeConnection();
  const q = new Queue(TEST_QUEUE, {
    connection: conn,
    defaultJobOptions: {
      attempts: 2,
      backoff: { type: "fixed", delay: 500 },
      removeOnComplete: true,
      removeOnFail: false,
    },
  });

  let healthyProcessed = 0;
  let badFailed = 0;

  const processor: Processor = async (job) => {
    if (job.data?.bad) {
      throw new Error("intentional bad payload");
    }
    await new Promise((r) => setTimeout(r, 50));
    healthyProcessed++;
    return { ok: true };
  };

  const workerConn = makeConnection();
  const worker = new Worker(TEST_QUEUE, processor, {
    connection: workerConn,
    concurrency: 3,
  });
  worker.on("failed", () => {
    badFailed++;
  });

  // Interleave 10 healthy + 2 bad jobs.
  for (let i = 0; i < 10; i++) {
    await q.add("healthy", { i });
    if (i === 3 || i === 7) await q.add("bad", { bad: true, i });
  }

  // Wait for 10 healthy to complete.
  const deadline = Date.now() + 30_000;
  while (healthyProcessed < 10 && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 100));
  }

  // Give a moment for both bad jobs to exhaust retries (attempts=2).
  await new Promise((r) => setTimeout(r, 2_000));

  const failedJobs = await q.getFailed();
  const waitingCount = await q.getWaitingCount();
  const activeCount = await q.getActiveCount();

  await worker.close();
  await q.close();
  await conn.quit();
  await workerConn.quit();

  const passed = healthyProcessed === 10 && failedJobs.length === 2;

  return {
    name: "Test 3: bad payload isolated, healthy jobs unblocked",
    passed,
    durationMs: Date.now() - start,
    details: {
      healthyProcessed,
      badFailed,
      failedQueueSize: failedJobs.length,
      remainingWaiting: waitingCount,
      remainingActive: activeCount,
    },
  };
}

// ── Test 4: graceful shutdown (SIGTERM drain) ──────────────────────────────
async function test4GracefulShutdown(): Promise<TestResult> {
  const start = Date.now();
  await drainTestQueue();

  const conn = makeConnection();
  const q = new Queue(TEST_QUEUE, { connection: conn });

  // Enqueue 5 slow jobs (500ms each). Start worker at concurrency 2.
  // Fire SIGTERM (worker.close) after 250ms. Expect: no jobs lost — all 5
  // eventually complete (in-flight drained, remaining picked up when restarted).
  for (let i = 0; i < 5; i++) {
    await q.add("slow", { i }, { attempts: 1, removeOnComplete: false });
  }

  let processedFirstRun = 0;
  const workerConn1 = makeConnection();
  const worker1 = new Worker(
    TEST_QUEUE,
    async () => {
      await new Promise((r) => setTimeout(r, 500));
      processedFirstRun++;
    },
    { connection: workerConn1, concurrency: 2 },
  );

  await new Promise((r) => setTimeout(r, 250));

  // Graceful close — should let in-flight jobs finish.
  log("calling worker.close() to simulate SIGTERM graceful drain");
  await worker1.close();
  await workerConn1.quit();
  const firstRunProcessed = processedFirstRun;

  // Restart worker — remaining jobs should resume.
  let processedSecondRun = 0;
  const workerConn2 = makeConnection();
  const worker2 = new Worker(
    TEST_QUEUE,
    async () => {
      await new Promise((r) => setTimeout(r, 500));
      processedSecondRun++;
    },
    { connection: workerConn2, concurrency: 2 },
  );

  const deadline = Date.now() + 15_000;
  while (firstRunProcessed + processedSecondRun < 5 && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 100));
  }

  const completedJobs = await q.getCompletedCount();
  const failedJobs = await q.getFailedCount();

  await worker2.close();
  await workerConn2.quit();
  await q.close();
  await conn.quit();

  const totalProcessed = firstRunProcessed + processedSecondRun;
  const passed = totalProcessed === 5 && failedJobs === 0;

  return {
    name: "Test 4: graceful shutdown + restart — no lost jobs",
    passed,
    durationMs: Date.now() - start,
    details: {
      firstRunProcessed,
      secondRunProcessed: processedSecondRun,
      totalProcessed,
      completedInRedis: completedJobs,
      failed: failedJobs,
    },
  };
}

// ── Main ───────────────────────────────────────────────────────────────────
async function main(): Promise<void> {
  const target = process.argv[2] ?? "all";
  const results: TestResult[] = [];

  const run = async (fn: () => Promise<TestResult>): Promise<void> => {
    try {
      const r = await fn();
      results.push(r);
      log(`${r.passed ? "PASS" : "FAIL"}: ${r.name} (${r.durationMs}ms)`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      results.push({
        name: fn.name,
        passed: false,
        durationMs: 0,
        details: {},
        error: msg,
      });
      log(`ERROR: ${fn.name}: ${msg}`);
    }
  };

  await drainTestQueue();

  if (target === "1" || target === "all") await run(test1Throughput);
  if (target === "2" || target === "all") await run(test2MidJobKill);
  if (target === "3" || target === "all") await run(test3BadPayloadIsolation);
  if (target === "4" || target === "all") await run(test4GracefulShutdown);

  await drainTestQueue();

  const passed = results.every((r) => r.passed);
  process.stdout.write(
    JSON.stringify(
      {
        suite: "worker-queue-p4.3",
        passed,
        redisUrl: REDIS_URL.replace(/:[^:@]+@/, ":***@"),
        testQueue: TEST_QUEUE,
        results,
      },
      null,
      2,
    ) + "\n",
  );

  process.exit(passed ? 0 : 1);
}

main().catch((err) => {
  console.error("[test-queue] fatal:", err);
  process.exit(2);
});
