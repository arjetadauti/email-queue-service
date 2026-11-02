'use strict';

const db = require('./db');

/** Round-trips to PostgreSQL and returns the latency in ms. Throws if unreachable. */
async function ping() {
  const started = Date.now();
  await db.query('SELECT 1');
  return Date.now() - started;
}

module.exports = { ping };
