import { runWorker } from "../../src/lib/queues/run-worker";

runWorker("email").catch((err) => {
  console.error("[worker:email] failed to start:", err);
  process.exit(1);
});
