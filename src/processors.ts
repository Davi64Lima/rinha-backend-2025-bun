import { PaymentJob } from "./types";
import { CONFIG } from "./config";

export  const sendToProcessor = async (job: PaymentJob): Promise<{ ok: boolean; processor: "default" | "fallback" }> => {
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
    
    return { ok: true, processor: "default" };
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

    return { ok: true, processor: "fallback" };
  } finally {
    clearTimeout(timeout);
  }
}
