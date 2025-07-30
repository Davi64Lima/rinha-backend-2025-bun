// payments-summary.ts
import redis from "./cache";


export const getSummary =  async (from:any,to:any) => {
  const result = {
    default: { totalRequests: 0, totalAmount: 0 },
    fallback: { totalRequests: 0, totalAmount: 0 },
  };

  for (const processor of ["default", "fallback"] as const) {
    const fromTs = from ? new Date(from).getTime() : "-inf";
    const toTs = to ? new Date(to).getTime() : "+inf";
    
    const ids = await redis.zrangebyscore(`payments:${processor}`, fromTs, toTs);
    
    
    if (ids.length === 0) continue;

    const pipeline = redis.pipeline();

    for (const id of ids) {
      pipeline.hgetall(`request:${id}`);
    }

    const responses = await pipeline.exec();
    

if (!responses) return result;

for (const entry of responses) {
  const [err, rawData] = entry;

  if (err || typeof rawData !== "object" || rawData === null) continue;

  const data = rawData as { amount?: string };

  const amount = parseFloat(data.amount ?? "0");
  result[processor].totalAmount += amount;
  result[processor].totalRequests++;
}

  }

  return ({
    default: {
      totalRequests: result.default.totalRequests,
      totalAmount: Number(result.default.totalAmount.toFixed(2)),
    },
    fallback: {
      totalRequests: result.fallback.totalRequests,
      totalAmount: Number(result.fallback.totalAmount.toFixed(2)),
    },
  });
};

