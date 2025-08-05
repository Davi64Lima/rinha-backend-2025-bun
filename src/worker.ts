import redis from './cache';
import { CONFIG } from './config';
import { PaymentRequest, StreamData } from './types';
import { getHealthProcessor } from './healthCheckProcessor';

export const processorPayments = async (result) => {
  try {
    
    console.log(result);
    const processor = await getHealthProcessor();
    const url = processor === 'default' ? CONFIG.DEFAULT_PROCESSOR_URL : CONFIG.FALLBACK_PROCESSOR_URL;
    const date = new Date().toISOString();

    const paymentResponsePairs = await Promise.all(result.map(async (payment) => {
      const body = payment[1][1];
      let parsed;
      try {
        parsed = JSON.parse(body);
      } catch (e) {
        console.error('Erro ao parsear pagamento:', body, e);
        await redis.xdel('requests', payment[0]);
        return null;
      }
      const response = await fetch(`${url}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body
      });
      return { payment, response, parsed };
    }));

    for (const item of paymentResponsePairs) {
      if (!item) continue;
      const { payment, response, parsed } = item;
      try {
        if (response.ok) {
          await redis.xdel('requests', payment[0]);
          const procPayment = { ...parsed, processor, requestedAt: date };
          const correlationId = procPayment.correlationId;
          const timestamp = new Date(procPayment.requestedAt).getTime() / 1000;
          const day = procPayment.requestedAt.slice(0, 10).replace(/-/g, '');

          await redis.hset(`payment:${correlationId}`, procPayment);
          await redis.zadd(`payments:${processor}`, timestamp, correlationId);
          await redis.incr(`payments:${processor}:${day}:count`);
          await redis.incrbyfloat(`payments:${processor}:${day}:amount`, procPayment.amount);
        } else if (response.status === 422 || response.status === 500) {
          await redis.xdel('requests', payment[0]);
          console.error('Erro de processamento:', response.status, await response.text());
        } else {
          await redis.xdel('requests', payment[0]);
          console.warn('Reenfileirando pagamento:', payment[0]);
          await redis.xadd("requests", "*", "data", payment[1][1]);
        }
      } catch (err) {
        console.error('Erro ao processar pagamento:', err);
      }
    }
  } catch (err) {
    console.error('Erro no processamento de pagamentos:', err);
  }
};
// /payments-summary?from=2025-08-05T02:51:13.528Z&to=2025-08-05T02:52:23.528Z
//  to 2025-08-05T02:52:23.528Z