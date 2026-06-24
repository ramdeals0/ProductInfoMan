import { dispatchOutboxEvent } from "./integration.dispatcher.js";

export type EventDispatchPayload = {
  outboxEventId: string;
  organizationId: string;
};

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
  eventQueue = new Queue<EventDispatchPayload>("domain-events", { connection });
  return eventQueue;
}

export async function enqueueEventDispatch(payload: EventDispatchPayload): Promise<void> {
  if (useSyncProcessing()) {
    await dispatchOutboxEvent(payload.outboxEventId, payload.organizationId);
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
  const connection = { url: process.env.REDIS_URL! };

  eventWorker = new Worker<EventDispatchPayload>(
    "domain-events",
    async (job) => {
      await dispatchOutboxEvent(job.data.outboxEventId, job.data.organizationId);
    },
    { connection },
  );

  eventWorker.on("failed", (job, error) => {
    console.error(`Domain event dispatch ${job?.id} failed`, error);
  });
}

export async function closeEventQueue(): Promise<void> {
  await eventWorker?.close();
  await eventQueue?.close();
  eventWorker = null;
  eventQueue = null;
}
