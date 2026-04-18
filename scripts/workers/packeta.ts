import { runWorker } from "../../src/lib/queues/run-worker";

runWorker("packeta").catch((err) => {
  console.error("[worker:packeta] failed to start:", err);
  process.exit(1);
});
