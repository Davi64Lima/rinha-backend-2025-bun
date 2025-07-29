import { PaymentJob } from "./types";
import { CONFIG } from "./config";

export async function sendToProcessor(job: PaymentJob): Promise<void> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CONFIG.TIMEOUT_MS);

  try {
    const res = await fetch(`${CONFIG.DEFAULT_PROCESSOR_URL}/process-payment`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        correlationId: job.correlationId,
        amount: job.amount,
      }),
      signal: controller.signal,
    });

    if (!res.ok) throw new Error("Default failed");
  } catch (_) {
    console.log(`Falling back for ${job.correlationId}`);
    await fetch(`${CONFIG.FALLBACK_PROCESSOR_URL}/process-payment`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        correlationId: job.correlationId,
        amount: job.amount,
      }),
    });
  } finally {
    clearTimeout(timeout);
  }
}
