import { serve } from "bun";
import { PaymentRequest, ProcessorType } from "./types";
import { getSummary, logPayment } from "./summary";
import { CONFIG } from "./config";
const redis = Bun.redis;
import { getHealthProcessor } from "./health";

// ----------------------
// Fila de pagamentos
// ----------------------

const MAX_CONCURRENCY = 50;

async function enqueuePayment(payment: any) {
  await redis.rpush("payments:queue", JSON.stringify(payment));
}

async function acquireSemaphore() {
  const permits = await redis.incr("payments:semaphore");
  if (permits > MAX_CONCURRENCY) {
    await redis.decr("payments:semaphore");
    return false;
  }
  return true;
}

async function releaseSemaphore() {
  await redis.decr("payments:semaphore");
}

async function getDynamicTimeout() {
  const times = await redis.send("LRANGE", ["payments:metrics", "0", "99"]);
  if (times.length === 0) return 80;
  const avg = times.reduce((a, b) => a + Number(b), 0) / times.length;
  return Math.min(Math.max(avg * 1.2, 50), 200);
}

async function processPayment(payment: any) {
  const start = performance.now();

  // Aqui sua lógica de integração com Payment Processor
  const processor = await getHealthProcessor();
  const url =
    processor === ProcessorType.default
      ? `${CONFIG.DEFAULT_PROCESSOR_URL}/payments`
      : `${CONFIG.FALLBACK_PROCESSOR_URL}/payments`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payment),
  });

  if (response.ok) {
    await logPayment(
      new Date(payment.requestedAt).getTime(),
      payment.amount,
      processor
    );
  }

  const elapsed = performance.now() - start;

  await redis.lpush("payments:metrics", elapsed.toString());
  await redis.send("LTRIM", ["payments:metrics", "0", "99"]);

  return response.ok;
}

async function worker(queueKey: string) {
  while (true) {
    const gotLock = await acquireSemaphore();
    if (!gotLock) {
      await new Promise((r) => setTimeout(r, 1));
      continue;
    }

    const job = await redis.lpop(queueKey);
    if (!job) {
      await releaseSemaphore();
      await new Promise((r) => setTimeout(r, 1));
      continue;
    }

    const payment = JSON.parse(job);
    const timeout = await getDynamicTimeout();

    let finished = false;
    const timer = setTimeout(async () => {
      if (!finished) {
        await redis.rpush("payments:retry", JSON.stringify(payment));
        await releaseSemaphore();
      }
    }, timeout);

    const ok = await processPayment(payment);
    finished = true;
    clearTimeout(timer);
    await releaseSemaphore();

    if (!ok) {
      await redis.rpush("payments:retry", JSON.stringify(payment));
    }
  }
}

// Start workers for main and retry queues
worker("payments:queue");
worker("payments:retry");

// ----------------------
// API HTTP
// ----------------------

serve({
  port: 3000,
  fetch: async (req: Request) => {
    const url = new URL(req.url);

    // POST /payments
    if (req.method === "POST" && url.pathname === "/payments") {
      try {
        const data = (await req.json()) as PaymentRequest;

        const payment = {
          correlationId: data.correlationId,
          amount: data.amount,
          requestedAt: new Date().toISOString(),
        };

        await enqueuePayment(payment);
        // enqueuePayment(async () => {
        //   const payment = {
        //     correlationId: data.correlationId,
        //     amount: data.amount,
        //     requestedAt: new Date().toISOString(),
        //   };

        //   const processor = await getHealthProcessor();
        //   const url =
        //     processor === ProcessorType.default
        //       ? `${CONFIG.DEFAULT_PROCESSOR_URL}/payments`
        //       : `${CONFIG.FALLBACK_PROCESSOR_URL}/payments`;

        //   const response = await fetch(url, {
        //     method: "POST",
        //     headers: { "Content-Type": "application/json" },
        //     body: JSON.stringify(payment),
        //   });

        //   if (response.ok) {
        //     await logPayment(
        //       new Date(payment.requestedAt).getTime(),
        //       payment.amount,
        //       processor
        //     );
        //   }
        // });

        return new Response(null, { status: 202 });
      } catch {
        return new Response("Malformed JSON", { status: 400 });
      }
    }

    // GET /payments-summary
    if (req.method === "GET" && url.pathname === "/payments-summary") {
      const from = url.searchParams.get("from");
      const to = url.searchParams.get("to");

      const result = await getSummary(from, to);

      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // POST /purge-payments
    if (req.method === "POST" && url.pathname === "/purge-payments") {
      try {
        await fetch(`${CONFIG.DEFAULT_PROCESSOR_URL}/admin/purge-payments`, {
          method: "POST",
          headers: { "X-Rinha-Token": "123" },
        });

        await fetch(`${CONFIG.FALLBACK_PROCESSOR_URL}/admin/purge-payments`, {
          method: "POST",
          headers: { "X-Rinha-Token": "123" },
        });

        await redis.send("FLUSHALL", []);

        return new Response("payments flush", { status: 202 });
      } catch (err) {
        console.error(err);
        return new Response("internal server error", { status: 500 });
      }
    }

    return new Response("Not found", { status: 404 });
  },
});
