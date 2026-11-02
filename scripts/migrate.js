'use strict';

// CLI: npm run migrate
const db = require('../src/data/db');
const { runMigrations } = require('../src/data/migrator');

runMigrations()
  .then(() => db.close())
  .catch(async (err) => {
    console.error('[migrate] failed:', err.message);
    await db.close();
    process.exit(1);
  });
