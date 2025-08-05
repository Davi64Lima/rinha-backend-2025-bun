import { serve } from "bun";
import { PaymentRequest } from "./types";
import  redis  from './cache'
import { getSummary } from "./payment-summary";
import {processorPayments} from "./worker"
import { CONFIG } from "./config";



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

        await redis.xadd(
          "requests",
          "*",
          "data", JSON.stringify(data)
        )

        const result = await redis.xrange("requests", "-", "+", "COUNT", 10);
        console.log(result);
        if (result.length===10) {
          console.log('chamei');
        processorPayments(result)
        }

        return new Response('payment registred', { status: 202 });
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
        )])
        redis.flushall()

        return new Response('payments flush', { status: 202 });
      } catch (err) {
        return new Response('error flush payments', {status:500})
      }
    }
    
    

    return new Response("Not found", { status: 404 });
  },
});
