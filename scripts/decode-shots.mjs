// Convierte un JSON { nombre: "data:image/png;base64,..." } en PNGs junto al archivo.
// Uso: node scripts/decode-shots.mjs .playwright-mcp/shots.json  →  .playwright-mcp/shots-<nombre>.png
import { readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, extname, join } from 'node:path';

const file = process.argv[2];
if (!file) {
  console.error('Uso: node scripts/decode-shots.mjs <archivo.json>');
  process.exit(1);
}

let data = JSON.parse(readFileSync(file, 'utf8'));
if (typeof data === 'string') data = JSON.parse(data);

const prefix = basename(file, extname(file));
const prefixPng = 'data:image/png;base64,';
for (const [name, value] of Object.entries(data)) {
  if (typeof value !== 'string' || !value.startsWith(prefixPng)) {
    console.log(`${name}: ${JSON.stringify(value)}`);
    continue;
  }
  const out = join(dirname(file), `${prefix}-${name}.png`);
  writeFileSync(out, Buffer.from(value.slice(prefixPng.length), 'base64'));
  console.log(`${name}: ${out}`);
}
