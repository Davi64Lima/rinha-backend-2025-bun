import { serve } from "bun";
import { PaymentRequest } from "./types";
import { getSummary } from "./summary";
import { wasAlreadyProcessed } from "./idempotency";
import { send } from "./workerPool";


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

        if (wasAlreadyProcessed(data.correlationId)) {
          return new Response("Already processed", { status: 409 });
        }

        send({
          amount: data.amount,
          correlationId: data.correlationId,
        })

        return new Response(null, { status: 202 });
      } catch (error){
        console.error(error);
        return new Response("Malformed JSON", { status: 400 });
      }
    }

    if (req.method === "GET" && url.pathname === "/payments-summary") {
      const from = url.searchParams.get("from");
      const to = url.searchParams.get("to");
    
      if (!from || !to) {
        return new Response("Missing 'from' or 'to'", { status: 400 });
      }
    
      const result = getSummary(from, to);
    
      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    
    

    return new Response("Not found", { status: 404 });
  },
});
