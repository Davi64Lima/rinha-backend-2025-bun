import os from 'os'
import cluster from 'cluster'

const runPrimaryProcess = () => {
    const processesCount = os.cpus().length
    console.log(`Primary ${process.pid} is running`);
    console.log(`Forking server with ${processesCount} processes`);

    for (let index = 0; index < processesCount; index++)
        cluster.fork()
}

const runWorkerProcess = async () => {
    await import('./server')
}


cluster.isPrimary ? runPrimaryProcess() : runWorkerProcess()