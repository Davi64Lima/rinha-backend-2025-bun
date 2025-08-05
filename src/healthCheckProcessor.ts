import { CONFIG } from "./config"
import redis from "./cache";

export const getHealthProcessor = async () => {
  const cachedProcessor = await redis.get('cachedProcessor');

  if (cachedProcessor !== null) {
    return cachedProcessor;
  }

  const [defaultResp, fallbackResp] = await Promise.all([
    fetch(`${CONFIG.DEFAULT_PROCESSOR_URL}/payments/service-health`),
    fetch(`${CONFIG.FALLBACK_PROCESSOR_URL}/payments/service-health`)
  ]);

  const parseJsonSafe = async (resp: Response) => {
    if (!resp.ok) {
      console.error(resp);
      return null;
    }
    try {
      return await resp.json();
    } catch (e) {
      const text = await resp.text();
      console.error('Failed to parse JSON. Response text:', text);
      return null;
    }
  };

  const [defaultHealth, fallbackHealth] = await Promise.all([
    parseJsonSafe(defaultResp),
    parseJsonSafe(fallbackResp)
  ]);

  // Se algum dos healths for null, retorna erro ou valor default
  if (!defaultHealth || !fallbackHealth) {
    // Opcional: retorna o último valor do cache, se existir
    // return cachedProcessor || "default";
    return "default";
  }

  let processor;
  if (defaultHealth.failing || fallbackHealth.minResponseTime < defaultHealth.minResponseTime) {
    processor = "fallback";
  } else {
    processor = "default";
  }
  await redis.set('cachedProcessor', processor, 'EX', 5);
  return processor;
}