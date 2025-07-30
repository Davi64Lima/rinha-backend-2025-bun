import redis from './cache';
import { CONFIG } from './config';
import { PaymentRequest, StreamData } from './types';
import { getHealthProcessor } from './healthCheckProcessor';

const GROUP = "workers";
const CONSUMER = "worker-1";
const STREAM = "requests";

// Cria o grupo se ainda não existir
try {
  await redis.xgroup("CREATE", STREAM, GROUP, "$", "MKSTREAM");
} catch (_) {
  // Grupo já existe
}

const processPayments = async () => {
  while (true) {
    const result = await redis.xreadgroup(
      "GROUP", GROUP, CONSUMER,
      "STREAMS", STREAM, ">",
      "COUNT", 10,
      "BLOCK", 5000
    );

    if (!Array.isArray(result) || result.length === 0) continue;

    const [streamData] = result as StreamData[]
    const messages = streamData.messages;

    for (const msg of messages) {
      const id = msg.id;
      const fields = msg.fields;

      const data: PaymentRequest = JSON.parse(fields.data);
      let processor = await getHealthProcessor();
      let responseOk = false;

      const trySend = async (url: string) => {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), CONFIG.TIMEOUT_MS);
        try {
          const res = await fetch(`${url}/payments`, {
            method: "POST",
            body: JSON.stringify(data),
            headers: { "Content-Type": "application/json" },
            signal: controller.signal,
          });
          clearTimeout(timeout);
          return res.ok;
        } catch {
          clearTimeout(timeout);
          return false;
        }
      };

      // Tenta enviar ao processor preferido
      if (processor === 'default') {
        responseOk = await trySend(CONFIG.DEFAULT_PROCESSOR_URL);
        if (!responseOk) {
          processor = 'fallback';
          responseOk = await trySend(CONFIG.FALLBACK_PROCESSOR_URL);
        }
      } else {
        responseOk = await trySend(CONFIG.FALLBACK_PROCESSOR_URL);
        if (!responseOk) {
          processor = 'default';
          responseOk = await trySend(CONFIG.DEFAULT_PROCESSOR_URL);
        }
      }

      const requestedAt = Date.now(); // timestamp em milissegundos
      const saved = {
        amount: data.amount,
        processor,
        requestedAt: requestedAt.toString(),
      };

      await redis.hset(`request:${data.correlationId}`, saved);
      await redis.zadd(`payments:${processor}`, requestedAt, data.correlationId);
      await redis.xack(STREAM, GROUP, id);

      console.log(`Processed ${data.correlationId} with ${processor}`);
    }
  }
};

processPayments();
