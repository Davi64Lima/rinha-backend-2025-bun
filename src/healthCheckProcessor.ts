import { CONFIG } from "./config"

export const getHealthProcessor = async () => {
    const [defaultResp, fallbackResp] = await Promise.all([
        fetch(`${CONFIG.DEFAULT_PROCESSOR_URL}/payments/service-health`),
        fetch(`${CONFIG.FALLBACK_PROCESSOR_URL}/payments/service-health`)
      ]);
      
      const [defaultHealth, fallbackHealth] = await Promise.all([
        defaultResp.json(),
        fallbackResp.json()
      ]);
      
      if (defaultHealth.failing || fallbackHealth.minResponseTime < defaultHealth.minResponseTime) {
        return "fallback";
      } else {
        return "default";
      }      
}