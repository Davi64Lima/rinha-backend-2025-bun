import { dequeue, enqueue } from "./queue";
import { logPayment } from "./summary";
import { markAsProcessed } from "./idempotency";

import { PaymentJob } from "./types";
import { sendToProcessor } from "./processors";

export const startWorker = () => {
  setInterval(async () => {
    const job = dequeue();
    if (!job) return;

    try {
      const result = await sendToProcessor(job);
      logPayment(job.amount, result.processor);
      markAsProcessed(job.correlationId);
    } catch (err) {
      if (job.retries > 0) {
        job.retries--;
        setTimeout(() => {
          console.log(`Retrying ${job.correlationId}, retries left: ${job.retries}`);
          enqueue(job);
        }, 10); 
      } else {
        console.warn(`Job failed permanently: ${job.correlationId}`);
      }
    }
  }, 1); 
}
