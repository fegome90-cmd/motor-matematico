import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const fixture = readFileSync(join(root, 'examples/parity3.json'), 'utf8');
const cli = (args, input) =>
  spawnSync(process.execPath, ['cli.mjs', ...args], {
    cwd: root,
    input,
    encoding: 'utf8',
    timeout: 5000,
    maxBuffer: 20 * 1024 * 1024,
  });

async function cliWithClosedOutput(args, closed) {
  const child = spawn(process.execPath, ['cli.mjs', ...args], {
    cwd: root,
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 5000,
  });
  let stdout = '',
    stderr = '';
  child.stdout.setEncoding('utf8').on('data', (chunk) => {
    stdout += chunk;
  });
  child.stderr.setEncoding('utf8').on('data', (chunk) => {
    stderr += chunk;
  });
  const completion = new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('close', (status, signal) => resolve({ status, signal }));
  });
  for (const name of closed) child[name].destroy();
  return { ...(await completion), stdout, stderr };
}

test('CLI plans JSON file and stdin through the public library', () => {
  for (const args of [
    ['plan', 'examples/parity3.json'],
    ['plan', '-'],
  ]) {
    const result = cli(args, fixture);
    assert.equal(result.status, 0, result.stderr);
    const out = JSON.parse(result.stdout);
    assert.equal(out.status, 'planned');
    assert.equal(out.worstCaseCost, '6');
    assert.equal(out.recommendedAction, 'signal_0');
    assert.equal(result.stderr, '');
  }
});

test('CLI validates and retains historical evaluation explicitly', () => {
  const validated = cli(['validate', '-'], fixture);
  assert.equal(validated.status, 0, validated.stderr);
  assert.equal(JSON.parse(validated.stdout).remainingBudget, '6');
  const evaluated = cli(['evaluate', '-'], fixture);
  assert.equal(evaluated.status, 0, evaluated.stderr);
  assert.equal(JSON.parse(evaluated.stdout).reason, 'JOINT_PLAN_REQUIRED');
});

test('CLI distinguishes invalid input, file errors, help and computed abstention', () => {
  for (const [args, input] of [
    [[], ''],
    [['examples/parity3.json'], ''],
    [['plan', '-'], '{'],
    [['plan', '-'], '{}'],
    [['plan', '-', '--extra'], fixture],
  ]) {
    const result = cli(args, input);
    assert.equal(result.status, 2);
    assert.equal(result.stdout, '');
    assert.equal(JSON.parse(result.stderr).error, 'INVALID_INPUT');
  }
  const missing = cli(['plan', '/this-fixture-does-not-exist.json']);
  assert.equal(missing.status, 3);
  assert.equal(JSON.parse(missing.stderr).error, 'IO_ERROR');
  const help = cli(['--help']);
  assert.equal(help.status, 0);
  assert.match(help.stdout, /motor-matematico plan/);
  const input = JSON.parse(fixture);
  input.remainingBudget = '5';
  const impossible = cli(['plan', '-'], JSON.stringify(input));
  assert.equal(impossible.status, 0);
  assert.equal(JSON.parse(impossible.stdout).status, 'infeasible');
});

test('CLI applies limits and writes an advanced model without changing source files', () => {
  const work = mkdtempSync(join(tmpdir(), 'motor-cli-'));
  try {
    const limits = join(work, 'limits.json');
    const observation = join(work, 'observation.json');
    writeFileSync(limits, '{"maxStates":1}');
    writeFileSync(observation, '{"action":"signal_0","outcome":"o1","source":"test"}');
    const limited = cli(['plan', '-', '--limits', limits], fixture);
    assert.equal(limited.status, 0, limited.stderr);
    assert.equal(JSON.parse(limited.stdout).status, 'limit_exceeded');
    assert.equal(JSON.parse(limited.stdout).recommendedAction, null);
    const advanced = cli(['advance', '-', observation], fixture);
    assert.equal(advanced.status, 0, advanced.stderr);
    assert.equal(JSON.parse(advanced.stdout).remainingBudget, '4');
    assert.equal(JSON.parse(advanced.stdout).observations[0].outcome, 'o1');
    assert.equal(readFileSync(join(root, 'examples/parity3.json'), 'utf8'), fixture);
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
});

test('CLI refuses input above its byte cap without producing a decision', () => {
  const result = cli(['validate', '-'], ' '.repeat(16 * 1024 * 1024 + 1));
  assert.equal(result.status, 2, result.stderr);
  assert.equal(result.stdout, '');
  assert.match(JSON.parse(result.stderr).message, /exceeds/);
});

test('CLI advances a model requiring the same custom limits used to plan', () => {
  const work = mkdtempSync(join(tmpdir(), 'motor-cli-limits-'));
  try {
    const input = JSON.parse(fixture);
    input.worlds = Array.from({ length: 129 }, (_, i) => ({
      id: `w${i}`,
      answers: { q: `v${i % 2}` },
    }));
    input.actions = [
      {
        id: 'resolve',
        capability: 'evidence',
        permission: 'allowed',
        available: true,
        cost: '1',
        outcomes: Object.fromEntries(input.worlds.map((world, i) => [world.id, `o${i % 2}`])),
      },
    ];
    input.remainingBudget = '1';
    const limits = join(work, 'limits.json');
    const observation = join(work, 'observation.json');
    writeFileSync(limits, '{"maxWorlds":129}');
    writeFileSync(observation, '{"action":"resolve","outcome":"o1","source":"test"}');
    const planned = cli(['plan', '-', '--limits', limits], JSON.stringify(input));
    assert.equal(planned.status, 0, planned.stderr);
    assert.equal(JSON.parse(planned.stdout).status, 'planned');
    const defaultAdvance = cli(['advance', '-', observation], JSON.stringify(input));
    assert.equal(defaultAdvance.status, 2);
    const advanced = cli(['advance', '-', observation, '--limits', limits], JSON.stringify(input));
    assert.equal(advanced.status, 0, advanced.stderr);
    const state = JSON.parse(advanced.stdout);
    assert.equal(state.remainingBudget, '0');
    const result = cli(['plan', '-'], advanced.stdout);
    assert.equal(JSON.parse(result.stdout).status, 'solved');
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
});

test('CLI reports a closed stdout as an I/O error for results and help', async () => {
  for (const args of [['plan', 'examples/parity3.json'], ['--help']]) {
    const result = await cliWithClosedOutput(args, ['stdout']);
    assert.equal(result.status, 3, result.stderr);
    assert.equal(result.signal, null);
    assert.equal(JSON.parse(result.stderr).error, 'IO_ERROR');
    assert.doesNotMatch(result.stderr, /Unhandled|node:events/);
  }
});

test('CLI exits with I/O status when stderr cannot carry an error', async () => {
  for (const [args, closed] of [
    [[], ['stderr']],
    [
      ['plan', 'examples/parity3.json'],
      ['stdout', 'stderr'],
    ],
  ]) {
    const result = await cliWithClosedOutput(args, closed);
    assert.equal(result.status, 3);
    assert.equal(result.signal, null);
    assert.equal(result.stdout, '');
  }
});
