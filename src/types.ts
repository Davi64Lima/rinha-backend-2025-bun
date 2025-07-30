export type PaymentRequest = {
    correlationId: string;
    amount: number;
  }
  
export type paymentProcessorHealth = {
  failing: boolean,
  minResponseTime: number
}

export type StreamMessage = {
  id: string;
  fields: Record<string, string>;
};

export type StreamData = {
  name: string;
  messages: StreamMessage[];
};