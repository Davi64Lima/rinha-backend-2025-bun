import { Worker } from "worker_threads";
import os from 'os'
import path from "path";

const numWorkers = os.cpus().length - 1 || 1;
const workers : any[] = [];
let current = 0;

const workerPath = path.resolve(__dirname, "worker.js");


for (let i = 0; i < numWorkers; i++) {
  const worker = new Worker(workerPath); 
  worker.on('message', (msg) => {
    console.log(`Worker response:`, msg);
  });
  workers.push(worker);
}

export const send = (job:any) => {
  workers[current].postMessage(job);
  current = (current + 1) % workers.length;
}