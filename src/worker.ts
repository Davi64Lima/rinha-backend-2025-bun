import { dequeue, enqueue } from "./queue";
import { addToSummary, incrementFailed } from "./summary";
import { PaymentJob } from "./types";
import { sendToProcessor } from "./processor";

export const startWorker = () => {
  setInterval(async () => {
    const job = dequeue();
    if (!job) return;

    try {
      await sendToProcessor(job);
      addToSummary(job.amount);
    } catch (err) {
      if (job.retries > 0) {
        job.retries--;
        // opcional: re-enfileirar com backoff
        setTimeout(() => {
          console.log(`Retrying ${job.correlationId}, retries left: ${job.retries}`);
          enqueue(job);
        }, 10); // pequeno delay
      } else {
        incrementFailed();
        console.warn(`Job failed permanently: ${job.correlationId}`);
      }
    }
  }, 1); // o mais rápido possível, sem travar o loop
}
