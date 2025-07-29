import { serve } from "bun";
import { enqueue } from "./queue";
import { startWorker } from "./worker";
import { PaymentRequest } from "./types";
import { getSummary } from "./summary";


startWorker();

serve({
  port: 3000,
  fetch: async (req: Request) => {
    const url = new URL(req.url);

    if (req.method === "POST" && url.pathname === "/payments") {
      try {
        const data = await req.json() as PaymentRequest;

        if (!data.correlationId || !data.amount || typeof data.amount !== "number") {
          return new Response("Invalid payload", { status: 400 });
        }

        enqueue({ ...data, retries: 3 });

        return new Response(null, { status: 202 });
      } catch {
        return new Response("Malformed JSON", { status: 400 });
      }
    }

    if (req.method === "GET" && url.pathname === "/payments-summary") {
      const json = JSON.stringify(getSummary());
      return new Response(json, {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    

    return new Response("Not found", { status: 404 });
  },
});
