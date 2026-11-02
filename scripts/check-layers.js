'use strict';

/**
 * Enforces the layering rules from the README:
 *   api -> services -> data -> models   (each layer may only call the layer below)
 *   - no SQL outside src/data
 *   - no HTTP (express / req / res) outside src/api
 *
 *   npm run check:layers
 */
const fs = require('node:fs');
const path = require('node:path');

const SRC = path.join(__dirname, '..', 'src');
const LAYERS = ['api', 'services', 'data', 'models'];

// Which layers each layer may import from (itself included).
const ALLOWED = {
  api: ['api', 'services', 'models'],
  services: ['services', 'data', 'models'],
  data: ['data', 'models'],
  models: ['models'],
};

const SQL_PATTERN = /\b(SELECT\s+[\w*(]|INSERT\s+INTO|UPDATE\s+\w+\s+SET|DELETE\s+FROM|CREATE\s+TABLE)\b/i;
const HTTP_PATTERN = /require\(['"]express['"]\)|\bres\.status\(|\breq\.(body|params|query)\b/;

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : full.endsWith('.js') ? [full] : [];
  });
}

function layerOf(file) {
  const [first] = path.relative(SRC, file).split(path.sep);
  return LAYERS.includes(first) ? first : null; // entrypoints/config/workers sit outside the 4 layers
}

const problems = [];
for (const file of walk(SRC)) {
  const rel = path.relative(path.join(__dirname, '..'), file);
  const source = fs.readFileSync(file, 'utf8');
  const layer = layerOf(file);

  if (layer !== 'data' && SQL_PATTERN.test(source)) problems.push(`${rel}: SQL found outside the data layer`);
  if (layer !== 'api' && layer !== null && HTTP_PATTERN.test(source)) problems.push(`${rel}: HTTP code found outside the api layer`);

  if (!layer) continue;
  for (const [, spec] of source.matchAll(/require\(['"](\.[^'"]+)['"]\)/g)) {
    const target = layerOf(path.resolve(path.dirname(file), spec));
    if (target && !ALLOWED[layer].includes(target)) {
      problems.push(`${rel}: ${layer} layer must not import from ${target} (${spec})`);
    }
  }
}

if (problems.length) {
  console.error('Layer violations:\n  ' + problems.join('\n  '));
  process.exit(1);
}
console.log('Layer rules OK: api -> services -> data -> models, SQL only in data, HTTP only in api.');
