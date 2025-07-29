type ProcessorType = "default" | "fallback";

type PaymentEntry = {
  timestamp: number; // em ms
  amount: number;
  processor: ProcessorType;
};

const payments: PaymentEntry[] = [];

export const logPayment = (amount: number, processor: ProcessorType) => {
  payments.push({
    timestamp: Date.now(),
    amount,
    processor,
  });
}

export const getSummary = (from: string, to: string) => {
  const fromTime = new Date(from).getTime();
  const toTime = new Date(to).getTime();

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

  for (const p of payments) {
    if (p.timestamp >= fromTime && p.timestamp <= toTime) {
      const entry = summary[p.processor];
      entry.totalRequests++;
      entry.totalAmount += p.amount;
    }
  }

  return summary;
}
