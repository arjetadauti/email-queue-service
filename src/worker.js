'use strict';

// Standalone worker process: `npm run worker`.
// Use this with RUN_WORKER_IN_PROCESS=false when you want to scale the API and the worker separately.
const db = require('./data/db');
const { createEmailWorker } = require('./workers/emailWorker');

const worker = createEmailWorker();
worker.start();

async function shutdown(signal) {
  console.log(`[worker] ${signal} received, shutting down`);
  await worker.stop();
  await db.close();
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
