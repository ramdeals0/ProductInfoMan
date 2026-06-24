import {
  executeIndexProductJob,
  executeReindexJob,
  executeRemoveProductJob,
} from "./search.service.js";
import { loadApiEnv } from "@productinfoman/config";
import { getQueueDepth } from "../../lib/queue-backpressure.js";
import { observeWorkerJob, setQueueDepthMetrics } from "../../plugins/metrics.js";

export type SearchQueuePayload = {
  jobId: string;
  organizationId: string;
  jobType: string;
  productId?: string;
  reindexRunId?: string;
  productIds?: string[];
  sourceEvent?: string;
};

const QUEUE_NAME = "search-projection-jobs";

let searchQueue: import("bullmq").Queue<SearchQueuePayload> | null = null;
let searchWorker: import("bullmq").Worker<SearchQueuePayload> | null = null;

function useSyncProcessing(): boolean {
  return process.env.SEARCH_SYNC === "true" || !process.env.REDIS_URL;
}

async function getQueue() {
  if (useSyncProcessing()) return null;
  if (searchQueue) return searchQueue;

  const { Queue } = await import("bullmq");
  const connection = { url: process.env.REDIS_URL! };
  searchQueue = new Queue<SearchQueuePayload>(QUEUE_NAME, { connection });
  return searchQueue;
}

export async function processSearchJob(payload: SearchQueuePayload): Promise<void> {
  if (payload.jobType === "REINDEX_ALL" && payload.reindexRunId && payload.productIds) {
    await executeReindexJob(
      payload.jobId,
      payload.organizationId,
      payload.reindexRunId,
      payload.productIds,
      payload.sourceEvent,
    );
    return;
  }

  if (!payload.productId) {
    throw new Error("productId is required for search projection job");
  }

  if (payload.jobType === "REMOVE_PRODUCT") {
    await executeRemoveProductJob(
      payload.jobId,
      payload.organizationId,
      payload.productId,
      payload.sourceEvent,
    );
    return;
  }

  await executeIndexProductJob(
    payload.jobId,
    payload.organizationId,
    payload.productId,
    payload.sourceEvent,
  );
}

export async function enqueueSearchJob(payload: SearchQueuePayload): Promise<void> {
  if (useSyncProcessing()) {
    await processSearchJob(payload);
    return;
  }

  const queue = await getQueue();
  await queue!.add("search-projection", payload, {
    jobId: payload.jobId,
    attempts: 3,
    backoff: { type: "exponential", delay: 2000 },
    removeOnComplete: 100,
    removeOnFail: 100,
  });
}

export async function startSearchWorker(): Promise<void> {
  if (useSyncProcessing() || searchWorker) return;

  const { Worker } = await import("bullmq");
  const { SEARCH_WORKER_CONCURRENCY } = loadApiEnv();
  const connection = { url: process.env.REDIS_URL! };

  searchWorker = new Worker<SearchQueuePayload>(
    QUEUE_NAME,
    async (job) => {
      const startedAt = Date.now();
      try {
        await processSearchJob(job.data);
        observeWorkerJob("search", "success", startedAt);
      } catch (error) {
        observeWorkerJob("search", "failure", startedAt);
        throw error;
      }
    },
    { connection, concurrency: SEARCH_WORKER_CONCURRENCY },
  );

  searchWorker.on("failed", (job, error) => {
    console.error(`Search projection job ${job?.id} failed`, error);
  });

  setInterval(async () => {
    const depth = await getQueueDepth(QUEUE_NAME);
    setQueueDepthMetrics(QUEUE_NAME, depth);
  }, 15_000).unref();
}

export async function closeSearchQueue(): Promise<void> {
  await searchWorker?.close();
  await searchQueue?.close();
  searchWorker = null;
  searchQueue = null;
}
