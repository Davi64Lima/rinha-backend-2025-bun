import { serve } from "bun";
import { PaymentRequest } from "./types";
import { getSummary, logPayment } from "./summary";
import { CONFIG } from "./config";
import {ProcessorType} from './types'



serve({
  port: 9999,
  fetch: async (req: Request) => {
    const url = new URL(req.url);

    if (req.method === "POST" && url.pathname === "/payments") {
      try {
        const data = await req.json() as PaymentRequest;

        if (!data.correlationId || !data.amount || typeof data.amount !== "number") {
          return new Response("Invalid payload", { status: 400 });
        }

        const payment = {
          correlationId: data.correlationId,
          amount: data.amount,
          requestedAt: new Date().toISOString()
        }

        const response = await fetch(`${CONFIG.DEFAULT_PROCESSOR_URL}/payments`, {
          method: 'POST',
          body : JSON.stringify(payment)
        })

        if (response.ok) {
          logPayment(new Date(payment.requestedAt).getTime(),payment.amount,ProcessorType.default)
        }

        return new Response(null, { status: 200 });
      } catch {
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
