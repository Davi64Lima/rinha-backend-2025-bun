import { serve } from "bun";
import { PaymentRequest } from "./types";
import { getSummary, logPayment } from "./summary";
import { CONFIG } from "./config";
import {ProcessorType} from './types'
import { redis } from "./cache";
import { getHealthProcessor } from "./health";



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

        const processor = await getHealthProcessor()

        let response
        
        if (processor === ProcessorType.default) {
          response = await fetch(`${CONFIG.DEFAULT_PROCESSOR_URL}/payments`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body : JSON.stringify(payment)
         })
        } else {
          response = await fetch(`${CONFIG.FALLBACK_PROCESSOR_URL}/payments`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body : JSON.stringify(payment)
         })
        }

        if (response.ok) {
          logPayment(new Date(payment.requestedAt).getTime(),payment.amount,processor)
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
    
      const result = await getSummary(from, to);
    
      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (req.method === "POST" && url.pathname === "/purge-payments") {
      try {
        Promise.all([fetch(`${CONFIG.DEFAULT_PROCESSOR_URL}/admin/purge-payments`, {
          method: 'POST',
          headers: {
            'X-Rinha-Token':'123'
          }
        }
        ),
        fetch(`${CONFIG.FALLBACK_PROCESSOR_URL}/admin/purge-payments`, {
          method: 'POST',
          headers: {
            'X-Rinha-Token':'123'
          }
        }
        ),
        redis.send("FLUSHALL",[])
      ])


        return new Response('payments flush', { status: 202 });
      } catch (err) {
        return new Response('error flush payments', {status:500})
      }
    }
    
    

    return new Response("Not found", { status: 404 });
  },
});
