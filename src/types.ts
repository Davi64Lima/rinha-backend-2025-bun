export type PaymentRequest = {
    correlationId: string;
    amount: number;
  }
  
  export interface PaymentJob extends PaymentRequest {
    retries: number;
  }
  