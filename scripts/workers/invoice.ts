import { runWorker } from "../../src/lib/queues/run-worker";

runWorker("invoice").catch((err) => {
  console.error("[worker:invoice] failed to start:", err);
  process.exit(1);
});
