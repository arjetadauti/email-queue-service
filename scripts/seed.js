'use strict';

// CLI: npm run seed            -> replace previous demo rows
//      npm run seed -- --reset -> delete ALL jobs first
const db = require('../src/data/db');
const { seed } = require('../src/data/seeder');

const reset = process.argv.includes('--reset');

seed({ reset })
  .then(async (count) => {
    console.log(`[seed] ${reset ? 'cleared table, ' : ''}inserted ${count} demo email jobs`);
    await db.close();
  })
  .catch(async (err) => {
    console.error('[seed] failed:', err.message);
    await db.close();
    process.exit(1);
  });
