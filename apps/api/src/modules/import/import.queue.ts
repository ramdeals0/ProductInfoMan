import { processImportJob } from "./import.service.js";
import { loadApiEnv } from "@productinfoman/config";
import { getQueueDepth } from "../../lib/queue-backpressure.js";
import { observeWorkerJob, setQueueDepthMetrics } from "../../plugins/metrics.js";
import { retryWithBackoff } from "../../lib/resilience/retry.js";

type ImportQueuePayload = {
  importJobId: string;
  organizationId: string;
};

const QUEUE_NAME = "import-jobs";

let importQueue: import("bullmq").Queue<ImportQueuePayload> | null = null;
let importWorker: import("bullmq").Worker<ImportQueuePayload> | null = null;

function useSyncProcessing(): boolean {
  return process.env.IMPORT_SYNC === "true" || !process.env.REDIS_URL;
}

async function getQueue() {
  if (useSyncProcessing()) return null;
  if (importQueue) return importQueue;

  const { Queue } = await import("bullmq");
  const connection = { url: process.env.REDIS_URL! };
  importQueue = new Queue<ImportQueuePayload>(QUEUE_NAME, { connection });
  return importQueue;
}

export async function enqueueImportJob(importJobId: string, organizationId: string): Promise<void> {
  if (useSyncProcessing()) {
    setImmediate(() => {
      runImportJob(importJobId, organizationId).catch(console.error);
    });
    return;
  }

  const queue = await getQueue();
  await queue!.add(
    "process-import",
    { importJobId, organizationId },
    {
      jobId: importJobId,
      attempts: 3,
      backoff: { type: "exponential", delay: 2000 },
      removeOnComplete: 100,
      removeOnFail: 100,
    },
  );
}

async function runImportJob(importJobId: string, organizationId: string): Promise<void> {
  const startedAt = Date.now();
  try {
    await retryWithBackoff(() => processImportJob(importJobId, organizationId), {
      attempts: 3,
      initialDelayMs: 1000,
      label: "import-job",
    });
    observeWorkerJob("import", "success", startedAt);
  } catch (error) {
    observeWorkerJob("import", "failure", startedAt);
    throw error;
  }
}

export async function startImportWorker(): Promise<void> {
  if (useSyncProcessing() || importWorker) return;

  const { Worker } = await import("bullmq");
  const { IMPORT_WORKER_CONCURRENCY } = loadApiEnv();
  const connection = { url: process.env.REDIS_URL! };

  importWorker = new Worker<ImportQueuePayload>(
    QUEUE_NAME,
    async (job) => {
      await runImportJob(job.data.importJobId, job.data.organizationId);
    },
    { connection, concurrency: IMPORT_WORKER_CONCURRENCY },
  );

  importWorker.on("failed", (job, error) => {
    console.error(`Import job ${job?.id} failed`, error);
  });

  setInterval(async () => {
    const depth = await getQueueDepth(QUEUE_NAME);
    setQueueDepthMetrics(QUEUE_NAME, depth);
  }, 15_000).unref();
}

export async function closeImportQueue(): Promise<void> {
  await importWorker?.close();
  await importQueue?.close();
  importWorker = null;
  importQueue = null;
}
