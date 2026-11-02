'use strict';

require('dotenv').config({ quiet: true });

function int(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const value = Number.parseInt(raw, 10);
  if (Number.isNaN(value)) throw new Error(`Environment variable ${name} must be an integer`);
  return value;
}

function bool(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(raw.toLowerCase());
}

const config = {
  env: process.env.NODE_ENV || 'development',
  port: int('PORT', 3000),

  db: {
    // DATABASE_URL wins when set (Render, Railway, Neon...); otherwise PG* vars are used.
    connectionString: process.env.DATABASE_URL || undefined,
    host: process.env.PGHOST || 'localhost',
    port: int('PGPORT', 5432),
    user: process.env.PGUSER || 'postgres',
    password: process.env.PGPASSWORD || 'postgres',
    database: process.env.PGDATABASE || 'email_queue',
    ssl: bool('PGSSL', false),
    connectionTimeoutMillis: int('PG_CONNECT_TIMEOUT_MS', 3000),
  },

  resend: {
    apiKey: process.env.RESEND_API_KEY || '',
    from: process.env.EMAIL_FROM || 'Email Queue <onboarding@resend.dev>',
  },

  worker: {
    // Run the worker inside the web process (handy on free hosting with one service).
    runInProcess: bool('RUN_WORKER_IN_PROCESS', true),
    pollIntervalMs: int('WORKER_POLL_INTERVAL_MS', 2000),
    batchSize: int('WORKER_BATCH_SIZE', 10),
    // 1 initial attempt + MAX_RETRIES retries.
    maxRetries: int('EMAIL_MAX_RETRIES', 3),
    retryBaseDelayMs: int('EMAIL_RETRY_BASE_DELAY_MS', 5000),
    lockTimeoutMs: int('WORKER_LOCK_TIMEOUT_MS', 60000),
    // Optional Asniher heartbeat URL, pinged after healthy polls (at most once a minute).
    heartbeatUrl: process.env.WORKER_HEARTBEAT_URL || '',
  },
};

module.exports = config;
