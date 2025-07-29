import { parentPort } from "worker_threads";
import { sendToProcessor } from "./processors";
import { logPayment } from "./summary";

parentPort!.on('message', async (job) => {
  try {
    const result = await sendToProcessor(job);
    logPayment(job.amount, result.processor);
    parentPort!.postMessage({ status: 'ok', correlationId: job.correlationId });
  } catch (err) {
    parentPort!.postMessage({ status: 'fail', correlationId: job.correlationId });
  }
});
