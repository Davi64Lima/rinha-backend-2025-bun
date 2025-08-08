import { ProcessorType } from "./types";
const redis = Bun.redis;

type PaymentEntry = {
  timestamp: number;
  amount: number;
  processor: ProcessorType;
};

export const logPayment = async (
  timestamp: number,
  amount: number,
  processor: ProcessorType
) => {
  const entry: PaymentEntry = { timestamp, amount, processor };
  Promise.all([
    redis.send("LPUSH", ["payments_list", JSON.stringify(entry)]),
    redis.send("HINCRBYFLOAT", [
      `summary:${processor}`,
      "totalAmount",
      amount.toString(),
    ]),
    redis.send("HINCRBY", [`summary:${processor}`, "totalRequests", "1"]),
  ]);
  // await redis.lpush("payments_list", JSON.stringify(entry));
  // await redis.hincrbyfloat(`summary:${processor}`, "totalAmount", amount);
  // await redis.hincrby(`summary:${processor}`, "totalRequests", 1);
};

export const getSummary = async (from: string | null, to: string | null) => {
  if (!from && !to) {
    const [defaultData, fallbackData] = await Promise.all([
      redis.hgetall("summary:default"),
      redis.hgetall("summary:fallback"),
    ]);
    return {
      default: {
        totalRequests: parseInt(defaultData.totalRequests || "0"),
        totalAmount: parseFloat(defaultData.totalAmount || "0"),
      },
      fallback: {
        totalRequests: parseInt(fallbackData.totalRequests || "0"),
        totalAmount: parseFloat(fallbackData.totalAmount || "0"),
      },
    };
  }

  const summary = {
    default: {
      totalRequests: 0,
      totalAmount: 0,
    },
    fallback: {
      totalRequests: 0,
      totalAmount: 0,
    },
  };

  const fromTime = new Date(from).getTime();
  const toTime = new Date(to).getTime();

  const rawEntries = await redis.send("LRANGE", ["payments_list", "0", "-1"]);

  for (const raw of rawEntries) {
    try {
      const payment: PaymentEntry = JSON.parse(raw);
      const { timestamp, amount, processor } = payment;

      if (timestamp >= fromTime && timestamp <= toTime) {
        summary[processor].totalRequests++;
        summary[processor].totalAmount += amount;
      }
    } catch (error) {
      console.error("Erro ao parsear item da lista:", error);
    }
  }

  return summary;
};
