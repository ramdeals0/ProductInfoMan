import {
  executeIndexProductJob,
  executeReindexJob,
  executeRemoveProductJob,
} from "./search.service.js";

export type SearchQueuePayload = {
  jobId: string;
  organizationId: string;
  jobType: string;
  productId?: string;
  reindexRunId?: string;
  productIds?: string[];
  sourceEvent?: string;
};

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
  searchQueue = new Queue<SearchQueuePayload>("search-projection-jobs", { connection });
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
  const connection = { url: process.env.REDIS_URL! };

  searchWorker = new Worker<SearchQueuePayload>(
    "search-projection-jobs",
    async (job) => {
      await processSearchJob(job.data);
    },
    { connection },
  );

  searchWorker.on("failed", (job, error) => {
    console.error(`Search projection job ${job?.id} failed`, error);
  });
}

export async function closeSearchQueue(): Promise<void> {
  await searchWorker?.close();
  await searchQueue?.close();
  searchWorker = null;
  searchQueue = null;
}
