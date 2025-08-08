import { serve } from "bun";
import { PaymentRequest, ProcessorType } from "./types";
import { getSummary, logPayment } from "./summary";
import { CONFIG } from "./config";
const redis = Bun.redis;
import { getHealthProcessor } from "./health";

// ----------------------
// Fila de pagamentos
// ----------------------

const paymentQueue: (() => Promise<void>)[] = [];
let queueNotifier: (() => void) | null = null;

const enqueuePayment = (task: () => Promise<void>) => {
  paymentQueue.push(task);
  if (queueNotifier) {
    queueNotifier();
    queueNotifier = null;
  }
};

const MAX_CONCURRENCY = 10;
const runningTasks = new Set<Promise<void>>();

const processQueue = async () => {
  while (true) {
    while (runningTasks.size < MAX_CONCURRENCY && paymentQueue.length > 0) {
      const task = paymentQueue.shift();
      if (task) {
        const p = task()
          .catch(console.error)
          .finally(() => runningTasks.delete(p));
        runningTasks.add(p);
      }
    }
    if (paymentQueue.length === 0 && runningTasks.size === 0) {
      await new Promise<void>((resolve) => (queueNotifier = resolve));
    } else {
      await new Promise((res) => setTimeout(res, 1));
    }
  }
};

processQueue();

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
        enqueuePayment(async () => {
          const payment = {
            correlationId: data.correlationId,
            amount: data.amount,
            requestedAt: new Date().toISOString(),
          };

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
        });

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
