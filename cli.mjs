import {readFileSync} from 'node:fs';
import {evaluate} from './dist/core.js';
try {
  if (process.argv.length !== 3) throw new Error('Usage: node cli.mjs <fixture.json>');
  const data=JSON.parse(readFileSync(process.argv[2],'utf8'));
  console.log(JSON.stringify(evaluate(data),null,2));
} catch(e) { console.error(e instanceof Error ? e.message : String(e)); process.exitCode=1; }
