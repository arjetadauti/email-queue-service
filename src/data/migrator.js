'use strict';

/**
 * Minimal forward-only migration runner.
 * Applies every migrations/*.sql file not yet recorded in schema_migrations,
 * in filename order, each inside its own transaction.
 */
const fs = require('node:fs');
const path = require('node:path');
const db = require('./db');

const MIGRATIONS_DIR = path.join(__dirname, '..', '..', 'migrations');

async function runMigrations() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name       VARCHAR(255) PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`);

  const { rows } = await db.query('SELECT name FROM schema_migrations');
  const applied = new Set(rows.map((r) => r.name));

  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  let count = 0;
  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
    await db.withTransaction(async (client) => {
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
    });
    console.log(`[migrate] applied ${file}`);
    count += 1;
  }
  console.log(count ? `[migrate] ${count} migration(s) applied` : '[migrate] database is up to date');
}

module.exports = { runMigrations };
