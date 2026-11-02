'use strict';

const healthRepository = require('../data/healthRepository');
const emailJobRepository = require('../data/emailJobRepository');
const pkg = require('../../package.json');

const startedAt = Date.now();

/** Returns a health report; `healthy` is false when the database is unreachable. */
async function getHealth({ workerState } = {}) {
  const app = {
    status: 'up',
    name: pkg.name,
    version: pkg.version,
    uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
  };

  let database;
  let queue = null;
  try {
    const latencyMs = await healthRepository.ping();
    database = { status: 'up', latencyMs };
    queue = await emailJobRepository.countByStatus();
  } catch (err) {
    database = { status: 'down', error: err.message };
  }

  const healthy = database.status === 'up';
  return {
    healthy,
    report: {
      status: healthy ? 'ok' : 'error',
      timestamp: new Date().toISOString(),
      app,
      database,
      ...(workerState ? { worker: workerState } : {}),
      ...(queue ? { queue } : {}),
    },
  };
}

module.exports = { getHealth };
