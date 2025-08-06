import {ProcessorType} from './types'
const redis = Bun.redis;


type PaymentEntry = {
  timestamp: number;
  amount: number;
  processor: ProcessorType;
};

export const logPayment = async (timestamp: number, amount: number, processor: ProcessorType) => {
  const entry: PaymentEntry = { timestamp, amount, processor };
  await redis.lpush('payments_list', JSON.stringify(entry));
};


export const getSummary = async (from: string | null, to: string | null) => {
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
  
  if (from === null || to === null) {
    const rawEntries = await redis.send("LRANGE",['payments_list', "0", "-1"])
    if (rawEntries.length === 0) {
      return summary
    }

    for (const raw of rawEntries) {
    try {
      const payment:PaymentEntry = JSON.parse(raw);
      const { timestamp, amount, processor }  = payment;
      
        summary[processor].totalRequests++;
        summary[processor].totalAmount += amount;
      
    } catch (error) {
      console.error('Erro ao parsear item da lista:', error);
    }
  }
  }

  const fromTime = new Date(from).getTime();
  const toTime = new Date(to).getTime();



  const rawEntries = await redis.send("LRANGE",['payments_list', "0", "-1"])

  for (const raw of rawEntries) {
    try {
      const payment:PaymentEntry = JSON.parse(raw);
      const { timestamp, amount, processor }  = payment;
      
      if (timestamp >= fromTime && timestamp <= toTime) {
        summary[processor].totalRequests++;
        summary[processor].totalAmount += amount;
      }
    } catch (error) {
      console.error('Erro ao parsear item da lista:', error);
    }
  }

  return summary;
};
