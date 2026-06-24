import { processPublishJob } from "./publish.service.js";

export type PublishQueuePayload = {
  publishJobId: string;
  organizationId: string;
  channelId: string;
  mode: "DRY_RUN" | "LIVE";
};

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
  publishQueue = new Queue<PublishQueuePayload>("publish-jobs", { connection });
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
  const connection = { url: process.env.REDIS_URL! };

  publishWorker = new Worker<PublishQueuePayload>(
    "publish-jobs",
    async (job) => {
      await processPublishJob(job.data.publishJobId, job.data.organizationId);
    },
    { connection },
  );

  publishWorker.on("failed", (job, error) => {
    console.error(`Publish job ${job?.id} failed`, error);
  });
}

export async function closePublishQueue(): Promise<void> {
  await publishWorker?.close();
  await publishQueue?.close();
  publishWorker = null;
  publishQueue = null;
}
