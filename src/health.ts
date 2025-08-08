import { CONFIG } from "./config";
const redis = Bun.redis;
import { ProcessorType } from "./types";

const TAXA_DEFAULT = 0.05; // 5%
const TAXA_FALLBACK = 0.08; // 8%

export const getHealthProcessor = async (): Promise<ProcessorType> => {
  const cachedProcessor = await redis.get("cachedProcessor");

  if (
    cachedProcessor === ProcessorType.default ||
    cachedProcessor === ProcessorType.fallback
  ) {
    return cachedProcessor as ProcessorType;
  }

  // Tenta obter o lock (com TTL de 3 segundos)
  const acquiredLock = await redis.send("SET", [
    "health_check_lock",
    "1",
    "NX",
    "EX",
    "3",
  ]);

  if (acquiredLock !== "OK") {
    return ProcessorType.default;
  }

  try {
    const [defaultResp, fallbackResp] = await Promise.all([
      fetch(`${CONFIG.DEFAULT_PROCESSOR_URL}/payments/service-health`),
      fetch(`${CONFIG.FALLBACK_PROCESSOR_URL}/payments/service-health`),
    ]);

    const parseJsonSafe = async (resp: Response) => {
      if (!resp.ok) return null;
      try {
        return await resp.json();
      } catch {
        return null;
      }
    };

    const [defaultHealth, fallbackHealth] = await Promise.all([
      parseJsonSafe(defaultResp),
      parseJsonSafe(fallbackResp),
    ]);

    if (!defaultHealth || !fallbackHealth) {
      return ProcessorType.default;
    }

    let processor: ProcessorType;

    if (
      defaultHealth.failing ||
      fallbackHealth.minResponseTime < defaultHealth.minResponseTime
    ) {
      processor = ProcessorType.fallback;
    } else {
      processor = ProcessorType.default;
    }

    await redis.set("cachedProcessor", processor, "EX", 5);

    return processor;
  } catch (err) {
    return ProcessorType.default;
  } finally {
    // Libera o lock
    await redis.del("health_check_lock");
  }
};
