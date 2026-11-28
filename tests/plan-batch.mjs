import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const args = process.argv.slice(2);
if (args.length && (args.length !== 2 || args[0] !== '--module')) {
  throw new TypeError('usage: node tests/plan-batch.mjs [--module path/to/dist/index.js]');
}
const moduleURL = args.length
  ? pathToFileURL(resolve(args[1])).href
  : new URL('../dist/index.js', import.meta.url).href;
const { plan } = await import(moduleURL);
if (typeof plan !== 'function') throw new TypeError('module must export plan()');

function freezeTree(value) {
  if (value !== null && typeof value === 'object') {
    for (const child of Object.values(value)) freezeTree(child);
    Object.freeze(value);
  }
  return value;
}

const rows = JSON.parse(readFileSync(0, 'utf8'));
if (!Array.isArray(rows)) throw new TypeError('batch input must be an array');
const output = rows.map((row) => {
  try {
    const input = freezeTree(row.input);
    const options = Object.hasOwn(row, 'options') ? freezeTree(row.options) : undefined;
    const before = JSON.stringify({ input, options });
    const result = plan(input, options);
    if (before !== JSON.stringify({ input, options })) throw new Error('plan() mutated its input');
    // JSON serialization is part of the public contract; BigInt output must fail here.
    return { ok: true, result: JSON.parse(JSON.stringify(result)) };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? { name: error.name, message: error.message }
          : { name: 'Error', message: 'A non-Error value was thrown' },
    };
  }
});
process.stdout.write(JSON.stringify(output) + '\n');
