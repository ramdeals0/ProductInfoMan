import { dispatchOutboxEvent } from "./integration.dispatcher.js";
import { loadApiEnv } from "@productinfoman/config";
import { getQueueDepth } from "../../lib/queue-backpressure.js";
import { observeWorkerJob, setQueueDepthMetrics } from "../../plugins/metrics.js";

export type EventDispatchPayload = {
  outboxEventId: string;
  organizationId: string;
};

const QUEUE_NAME = "domain-events";

let eventQueue: import("bullmq").Queue<EventDispatchPayload> | null = null;
let eventWorker: import("bullmq").Worker<EventDispatchPayload> | null = null;

function useSyncProcessing(): boolean {
  return process.env.EVENT_SYNC === "true" || !process.env.REDIS_URL;
}

async function getQueue() {
  if (useSyncProcessing()) return null;
  if (eventQueue) return eventQueue;

  const { Queue } = await import("bullmq");
  const connection = { url: process.env.REDIS_URL! };
  eventQueue = new Queue<EventDispatchPayload>(QUEUE_NAME, { connection });
  return eventQueue;
}

async function runEventDispatch(payload: EventDispatchPayload): Promise<void> {
  const startedAt = Date.now();
  try {
    await dispatchOutboxEvent(payload.outboxEventId, payload.organizationId);
    observeWorkerJob("event", "success", startedAt);
  } catch (error) {
    observeWorkerJob("event", "failure", startedAt);
    throw error;
  }
}

export async function enqueueEventDispatch(payload: EventDispatchPayload): Promise<void> {
  if (useSyncProcessing()) {
    await runEventDispatch(payload);
    return;
  }

  const queue = await getQueue();
  await queue!.add("dispatch-outbox", payload, {
    jobId: payload.outboxEventId,
    attempts: 3,
    backoff: { type: "exponential", delay: 2000 },
    removeOnComplete: 200,
    removeOnFail: 200,
  });
}

export async function startEventWorker(): Promise<void> {
  if (useSyncProcessing() || eventWorker) return;

  const { Worker } = await import("bullmq");
  const { EVENT_WORKER_CONCURRENCY } = loadApiEnv();
  const connection = { url: process.env.REDIS_URL! };

  eventWorker = new Worker<EventDispatchPayload>(
    QUEUE_NAME,
    async (job) => {
      await runEventDispatch(job.data);
    },
    { connection, concurrency: EVENT_WORKER_CONCURRENCY },
  );

  eventWorker.on("failed", (job, error) => {
    console.error(`Domain event dispatch ${job?.id} failed`, error);
  });

  setInterval(async () => {
    const depth = await getQueueDepth(QUEUE_NAME);
    setQueueDepthMetrics(QUEUE_NAME, depth);
  }, 15_000).unref();
}

export async function closeEventQueue(): Promise<void> {
  await eventWorker?.close();
  await eventQueue?.close();
  eventWorker = null;
  eventQueue = null;
}
