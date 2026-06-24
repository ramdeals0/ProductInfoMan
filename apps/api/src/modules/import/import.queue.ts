import { processImportJob } from "./import.service.js";

type ImportQueuePayload = {
  importJobId: string;
  organizationId: string;
};

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
  importQueue = new Queue<ImportQueuePayload>("import-jobs", { connection });
  return importQueue;
}

export async function enqueueImportJob(importJobId: string, organizationId: string): Promise<void> {
  if (useSyncProcessing()) {
    setImmediate(() => {
      processImportJob(importJobId, organizationId).catch(console.error);
    });
    return;
  }

  const queue = await getQueue();
  await queue!.add(
    "process-import",
    { importJobId, organizationId },
    {
      jobId: importJobId,
      removeOnComplete: 100,
      removeOnFail: 100,
    },
  );
}

export async function startImportWorker(): Promise<void> {
  if (useSyncProcessing() || importWorker) return;

  const { Worker } = await import("bullmq");
  const connection = { url: process.env.REDIS_URL! };

  importWorker = new Worker<ImportQueuePayload>(
    "import-jobs",
    async (job) => {
      await processImportJob(job.data.importJobId, job.data.organizationId);
    },
    { connection },
  );

  importWorker.on("failed", (job, error) => {
    console.error(`Import job ${job?.id} failed`, error);
  });
}

export async function closeImportQueue(): Promise<void> {
  await importWorker?.close();
  await importQueue?.close();
  importWorker = null;
  importQueue = null;
}
