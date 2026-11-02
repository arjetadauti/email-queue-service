'use strict';

const config = require('./config');
const db = require('./data/db');
const { createApp } = require('./api/app');
const { createEmailWorker } = require('./workers/emailWorker');

const worker = config.worker.runInProcess ? createEmailWorker() : null;
const app = createApp({ getWorkerState: worker ? worker.getState : undefined });

const server = app.listen(config.port, () => {
  console.log(`[api] listening on port ${config.port} (${config.env})`);
  if (worker) worker.start();
});

async function shutdown(signal) {
  console.log(`[api] ${signal} received, shutting down`);
  server.close();
  if (worker) await worker.stop();
  await db.close();
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
