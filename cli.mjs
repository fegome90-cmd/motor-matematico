#!/usr/bin/env node
import { open } from 'node:fs/promises';
import { advance, evaluate, plan, validate } from './dist/index.js';

const MAX_BYTES = 16 * 1024 * 1024;
const usage = `motor-matematico 0.2.0
Usage:
  motor-matematico plan <model.json|-> [--limits <limits.json>]
  motor-matematico evaluate <model.json|->
  motor-matematico validate <model.json|->
  motor-matematico advance <model.json|-> <observation.json> [--limits <limits.json>]

Costs and budget are decimal integer strings. Output is JSON on stdout.
Exit: 0 completed command (inspect plan.status), 2 invalid input or usage,
3 I/O error. Each input file or stdin is limited to 16 MiB.
advance records a result; it does not execute the recommended action.
`;

function writeOutput(stream, text) {
  return new Promise((resolve, reject) => {
    stream.once('error', reject);
    stream.write(text, (error) => {
      if (error) reject(error);
      else {
        stream.removeListener('error', reject);
        resolve();
      }
    });
  });
}

async function readJson(path) {
  const handle = path === '-' ? null : await open(path, 'r');
  const stream = handle ? handle.createReadStream() : process.stdin;
  let bytes = 0;
  const chunks = [];
  try {
    for await (const chunk of stream) {
      bytes += chunk.length;
      if (bytes > MAX_BYTES) throw new TypeError(`Input exceeds ${MAX_BYTES} bytes`);
      chunks.push(chunk);
    }
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } finally {
    if (handle) await handle.close();
  }
}

try {
  const args = process.argv.slice(2);
  if (args.length === 1 && ['--help', '-h'].includes(args[0])) {
    await writeOutput(process.stdout, usage);
  } else {
    const [command, inputPath, ...rest] = args;
    if (!['plan', 'evaluate', 'validate', 'advance'].includes(command) || !inputPath) {
      throw new TypeError(usage);
    }
    if (
      (command === 'plan' && rest.length !== 0 && !(rest.length === 2 && rest[0] === '--limits')) ||
      (command === 'advance' &&
        (!(rest.length === 1 || (rest.length === 3 && rest[1] === '--limits')) ||
          rest[0] === '-' ||
          rest[2] === '-')) ||
      (['evaluate', 'validate'].includes(command) && rest.length !== 0)
    ) {
      throw new TypeError(usage);
    }
    if (command === 'plan' && rest[1] === '-') throw new TypeError('Limits must be a file');
    const input = await readJson(inputPath);
    const result =
      command === 'plan'
        ? plan(input, rest.length ? await readJson(rest[1]) : undefined)
        : command === 'evaluate'
          ? evaluate(input)
          : command === 'validate'
            ? validate(input)
            : advance(
                input,
                await readJson(rest[0]),
                rest.length === 3 ? await readJson(rest[2]) : undefined,
              );
    await writeOutput(process.stdout, `${JSON.stringify(result, null, 2)}\n`);
  }
} catch (error) {
  const invalid = error instanceof TypeError || error instanceof SyntaxError;
  process.exitCode = invalid ? 2 : 3;
  try {
    await writeOutput(
      process.stderr,
      `${JSON.stringify({ error: invalid ? 'INVALID_INPUT' : 'IO_ERROR', message: error.message })}\n`,
    );
  } catch {
    process.exitCode = 3;
  }
}
