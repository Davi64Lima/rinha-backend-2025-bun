export const CONFIG = {
  DEFAULT_PROCESSOR_URL: process.env.DEFAULT_PROCESSOR_URL || "http://localhost:8001",
  FALLBACK_PROCESSOR_URL: process.env.FALLBACK_PROCESSOR_URL || "http://localhost:8002",
  REDIS_HOST: process.env.REDIS_HOST ||"http://localhost:6379",
};
