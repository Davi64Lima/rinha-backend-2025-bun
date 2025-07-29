import { MessageChannel } from "worker_threads";

const channel = new MessageChannel();
const queuePort = channel.port1;

export const workerPort = channel.port2;

export const enqueue = (job: any) => {
  queuePort.postMessage(job);
}
