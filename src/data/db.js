'use strict';

const { Pool } = require('pg');
const config = require('../config');

function buildPoolConfig() {
  const { db } = config;
  const ssl = db.ssl ? { rejectUnauthorized: false } : false;
  const base = { ssl, connectionTimeoutMillis: db.connectionTimeoutMillis, max: 10 };

  if (db.connectionString) return { ...base, connectionString: db.connectionString };
  return { ...base, host: db.host, port: db.port, user: db.user, password: db.password, database: db.database };
}

const pool = new Pool(buildPoolConfig());

// An idle client erroring (e.g. DB restarted) must not crash the process;
// the next query will fail and /health will report it.
pool.on('error', (err) => {
  console.error('[db] idle client error:', err.message);
});

function query(text, params) {
  return pool.query(text, params);
}

async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

function close() {
  return pool.end();
}

module.exports = { pool, query, withTransaction, close };
