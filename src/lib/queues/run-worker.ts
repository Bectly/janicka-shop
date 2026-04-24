import { Worker, type WorkerOptions, type Processor } from "bullmq";
import IORedis from "ioredis";
import { QUEUE_NAMES, getRedisUrl, type QueueName } from "./connection";
import { processEmailJob } from "./worker-email";
import { processInvoiceJob } from "./worker-invoice";
import { processPacketaJob } from "./worker-packeta";
import { logger } from "@/lib/logger";

type WorkerKind = "email" | "invoice" | "packeta";

interface Handler {
  name: QueueName;
  processor: Processor;
  concurrency: number;
}

function resolveHandler(kind: WorkerKind): Handler {
  switch (kind) {
    case "email":
      return { name: QUEUE_NAMES.email, processor: processEmailJob as Processor, concurrency: 5 };
    case "invoice":
      return { name: QUEUE_NAMES.invoice, processor: processInvoiceJob as Processor, concurrency: 2 };
    case "packeta":
      return { name: QUEUE_NAMES.packeta, processor: processPacketaJob as Processor, concurrency: 2 };
  }
}

export async function runWorker(kind: WorkerKind): Promise<void> {
  const { name, processor, concurrency } = resolveHandler(kind);

  const connection = new IORedis(getRedisUrl(), {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });

  const options: WorkerOptions = {
    connection,
    concurrency,
    // Let completed jobs stay 24h / failed 7d for debugging.
    removeOnComplete: { age: 24 * 3600, count: 1_000 },
    removeOnFail: { age: 7 * 24 * 3600 },
  };

  const worker = new Worker(name, processor, options);

  worker.on("ready", () => {
    logger.info(`[worker:${kind}] ready (queue=${name}, concurrency=${concurrency})`);
  });
  worker.on("completed", (job) => {
    logger.info(`[worker:${kind}] completed job ${job.id} (${job.name})`);
  });
  worker.on("failed", (job, err) => {
    logger.error(
      `[worker:${kind}] failed job ${job?.id ?? "?"} (${job?.name ?? "?"}): ${err.message}`,
    );
  });
  worker.on("error", (err) => {
    logger.error(`[worker:${kind}] error:`, err.message);
  });

  const shutdown = async (signal: string): Promise<void> => {
    logger.info(`[worker:${kind}] received ${signal} — draining…`);
    try {
      await worker.close();
      await connection.quit();
      logger.info(`[worker:${kind}] clean shutdown`);
      process.exit(0);
    } catch (err) {
      logger.error(`[worker:${kind}] shutdown error:`, err);
      process.exit(1);
    }
  };

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}
