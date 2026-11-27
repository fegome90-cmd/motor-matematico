import { readFileSync } from 'node:fs';
import { evaluate } from '../dist/core.js';

const rows = JSON.parse(readFileSync(0, 'utf8'));
console.log(JSON.stringify(rows.map(evaluate)));
