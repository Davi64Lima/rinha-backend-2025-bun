import { PaymentJob } from "./types";

const queue: PaymentJob[] = [];

export const enqueue = (job: PaymentJob) => {
  queue.push(job);
}

export const dequeue = (): PaymentJob | undefined => {
  return queue.shift();
}

export const queueLength = (): number => {
  return queue.length;
}
