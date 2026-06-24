import { processPublishJob } from "./publish.service.js";
import { loadApiEnv } from "@productinfoman/config";
import { getQueueDepth } from "../../lib/queue-backpressure.js";
import { observeWorkerJob, setQueueDepthMetrics } from "../../plugins/metrics.js";

export type PublishQueuePayload = {
  publishJobId: string;
  organizationId: string;
  channelId: string;
  mode: "DRY_RUN" | "LIVE";
};

const QUEUE_NAME = "publish-jobs";

let publishQueue: import("bullmq").Queue<PublishQueuePayload> | null = null;
let publishWorker: import("bullmq").Worker<PublishQueuePayload> | null = null;

function useSyncProcessing(): boolean {
  return process.env.PUBLISH_SYNC === "true" || !process.env.REDIS_URL;
}

async function getQueue() {
  if (useSyncProcessing()) return null;
  if (publishQueue) return publishQueue;

  const { Queue } = await import("bullmq");
  const connection = { url: process.env.REDIS_URL! };
  publishQueue = new Queue<PublishQueuePayload>(QUEUE_NAME, { connection });
  return publishQueue;
}

export async function enqueuePublishJob(payload: PublishQueuePayload): Promise<void> {
  if (useSyncProcessing()) {
    await processPublishJob(payload.publishJobId, payload.organizationId);
    return;
  }

  const queue = await getQueue();
  await queue!.add("process-publish", payload, {
    jobId: payload.publishJobId,
    attempts: 3,
    backoff: { type: "exponential", delay: 2000 },
    removeOnComplete: 100,
    removeOnFail: 100,
  });
}

export async function startPublishWorker(): Promise<void> {
  if (useSyncProcessing() || publishWorker) return;

  const { Worker } = await import("bullmq");
  const { PUBLISH_WORKER_CONCURRENCY } = loadApiEnv();
  const connection = { url: process.env.REDIS_URL! };

  publishWorker = new Worker<PublishQueuePayload>(
    QUEUE_NAME,
    async (job) => {
      const startedAt = Date.now();
      try {
        await processPublishJob(job.data.publishJobId, job.data.organizationId);
        observeWorkerJob("publish", "success", startedAt);
      } catch (error) {
        observeWorkerJob("publish", "failure", startedAt);
        throw error;
      }
    },
    { connection, concurrency: PUBLISH_WORKER_CONCURRENCY },
  );

  publishWorker.on("failed", (job, error) => {
    console.error(`Publish job ${job?.id} failed`, error);
  });

  setInterval(async () => {
    const depth = await getQueueDepth(QUEUE_NAME);
    setQueueDepthMetrics(QUEUE_NAME, depth);
  }, 15_000).unref();
}

export async function closePublishQueue(): Promise<void> {
  await publishWorker?.close();
  await publishQueue?.close();
  publishWorker = null;
  publishQueue = null;
}
