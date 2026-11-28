import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { availableParallelism, cpus, loadavg, release } from 'node:os';
import { dirname, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { evaluate, plan } from '../dist/index.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const args = process.argv.slice(2);
let output;
let baselinePath;
let profile = false;
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--output' && args[i + 1]) output = resolve(args[++i]);
  else if (args[i] === '--baseline' && args[i + 1]) baselinePath = resolve(args[++i]);
  else if (args[i] === '--profile') profile = true;
  else throw new TypeError('Usage: benchmark.mjs [--output file] [--baseline module] [--profile]');
}
const baseline = baselinePath ? (await import(pathToFileURL(baselinePath).href)).evaluate : null;
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
function parity(bits, noise = false, decisions = 1, countActions = bits + Number(noise)) {
  const worlds = Array.from({ length: 2 ** (bits + Number(noise)) }, (_, i) => {
    let value = 0;
    for (let bit = 0; bit < bits; bit++) value ^= (i >> bit) & 1;
    return {
      id: `w${i}`,
      answers: Object.fromEntries(
        Array.from({ length: decisions }, (_, q) => [`q${q}`, `v${value}`]),
      ),
    };
  });
  return {
    coverage: 'complete',
    gate: 'allowed',
    costUnit: 'work_units',
    remainingBudget: String(2 * bits),
    decisions: Array.from({ length: decisions }, (_, q) => ({ id: `q${q}`, domain: ['v0', 'v1'] })),
    worlds,
    actions: Array.from({ length: countActions }, (_, bit) => ({
      id: noise && bit === bits ? 'noise' : `signal_${bit}`,
      capability: 'evidence',
      permission: 'allowed',
      available: true,
      cost: noise && bit === bits ? '1' : '2',
      outcomes: Object.fromEntries(
        worlds.map((world, i) => [world.id, `o${(i >> (bit % (bits + Number(noise)))) & 1}`]),
      ),
    })),
    observations: [],
  };
}
const scenarios = [
  { name: 'parity1', input: parity(1), status: 'planned', cost: '2', repeats: 30 },
  { name: 'parity3_noise', input: parity(3, true), status: 'planned', cost: '6', repeats: 20 },
  { name: 'parity6', input: parity(6), status: 'planned', cost: '12', repeats: 5 },
  { name: 'parity7', input: parity(7), status: 'planned', cost: '14', repeats: 3 },
  {
    name: 'state_limit',
    input: parity(7),
    options: { maxStates: 50 },
    status: 'limit_exceeded',
    reason: 'MAX_STATES',
    repeats: 10,
  },
  {
    name: 'capacity256',
    input: parity(8),
    status: 'limit_exceeded',
    reason: 'MAX_WORLDS',
    repeats: 10,
  },
  {
    name: 'capacity4096',
    input: parity(12, false, 64, 128),
    status: 'limit_exceeded',
    reason: 'MAX_WORLDS',
    repeats: 1,
  },
];
for (const scenario of scenarios) scenario.json = JSON.stringify(scenario.input);
function verify(scenario, result) {
  assert.equal(result.status, scenario.status, `${scenario.name}: unexpected status`);
  if (scenario.status === 'planned') {
    assert.ok(result.policy, `${scenario.name}: planned result has no policy`);
    assert.equal(result.worstCaseCost, scenario.cost);
  } else {
    assert.equal(result.policy, null);
    assert.equal(result.worstCaseCost, null);
    assert.equal(result.reason, scenario.reason);
  }
  if (result.policy) {
    const nodes = new Map(result.policy.nodes.map((node) => [node.id, node]));
    let maxCost = 0n;
    for (const world of scenario.input.worlds) {
      let node = nodes.get(result.policy.root);
      let spent = 0n;
      const used = new Set();
      while (node.type === 'decision') {
        assert.ok(!used.has(node.action));
        used.add(node.action);
        const action = scenario.input.actions.find((item) => item.id === node.action);
        assert.equal(action.permission, 'allowed');
        assert.equal(action.available, true);
        spent += BigInt(action.cost);
        node = nodes.get(
          node.branches.find((branch) => branch.outcome === action.outcomes[world.id]).child,
        );
      }
      assert.deepEqual(node.answers, world.answers);
      assert.ok(spent <= BigInt(scenario.input.remainingBudget));
      if (spent > maxCost) maxCost = spent;
    }
    assert.equal(String(maxCost), scenario.cost);
  }
}
const quantile = (values, fraction) =>
  [...values].sort((a, b) => a - b)[Math.ceil(fraction * values.length) - 1];
const measures = [];
let consumedBytes = 0;
let completed = 0;
let failures = 0;
const policies = [{ name: 'plan', run: (input, scenario) => plan(input, scenario.options) }];
if (baseline)
  policies.push(
    { name: 'evaluate_v010', run: baseline },
    { name: 'evaluate_cached', run: evaluate },
  );
for (const scenario of scenarios) {
  verify(scenario, plan(JSON.parse(scenario.json), scenario.options));
  if (baseline) {
    scenario.expectedDiagnostic = evaluate(scenario.input);
    assert.deepEqual(scenario.expectedDiagnostic, baseline(scenario.input));
  }
  for (const policy of policies) policy.run(JSON.parse(scenario.json), scenario);
}
const blocks = profile ? 1 : 5;
for (let block = 0; block < blocks; block++) {
  for (const scenario of block % 2 ? [...scenarios].reverse() : scenarios) {
    for (const policy of block % 2 ? [...policies].reverse() : policies) {
      const timings = [];
      const statuses = {};
      for (let i = 0; i < (profile ? 3 : scenario.repeats); i++) {
        try {
          const start = performance.now();
          const input = JSON.parse(scenario.json);
          const result = policy.run(input, scenario);
          const serialized = JSON.stringify(result);
          const duration = performance.now() - start;
          consumedBytes += Buffer.byteLength(serialized);
          completed++;
          if (policy.name === 'plan') verify(scenario, result);
          else assert.deepEqual(result, scenario.expectedDiagnostic);
          const status = result.status ?? result.route;
          statuses[status] = (statuses[status] ?? 0) + 1;
          timings.push(duration);
        } catch (error) {
          failures++;
          throw error;
        }
      }
      measures.push({
        scenario: scenario.name,
        policy: policy.name,
        block,
        timingsMs: timings,
        medianMs: quantile(timings, 0.5),
        statuses,
      });
    }
  }
}
const summary = [];
for (const scenario of scenarios) {
  for (const policy of policies) {
    const group = measures.filter(
      (row) => row.scenario === scenario.name && row.policy === policy.name,
    );
    const samples = group.flatMap((row) => row.timingsMs);
    const medians = group.map((row) => row.medianMs);
    summary.push({
      scenario: scenario.name,
      policy: policy.name,
      worlds: scenario.input.worlds.length,
      actions: scenario.input.actions.length,
      inputBytes: Buffer.byteLength(scenario.json),
      samples: samples.length,
      p50Ms: quantile(samples, 0.5),
      p95Ms: quantile(samples, 0.95),
      medianOfBlocksMs: quantile(medians, 0.5),
      blockMedianRangeMs: [Math.min(...medians), Math.max(...medians)],
      statuses: group.reduce((all, row) => {
        for (const [key, count] of Object.entries(row.statuses)) all[key] = (all[key] ?? 0) + count;
        return all;
      }, {}),
    });
  }
}
const cliMs = [];
if (!profile) {
  for (let i = 0; i < 5; i++) {
    const start = performance.now();
    const raw = execFileSync(process.execPath, ['cli.mjs', 'plan', '-'], {
      cwd: root,
      input: scenarios[1].json,
      timeout: 10000,
      encoding: 'utf8',
    });
    cliMs.push(performance.now() - start);
    verify(scenarios[1], JSON.parse(raw));
  }
}
const report = {
  claim:
    'Conditional latency and complete-policy correctness for the listed finite synthetic models; no production SLA or semantic-router comparison.',
  timestamp: new Date().toISOString(),
  profileRun: profile,
  environment: {
    node: process.version,
    platform: process.platform,
    release: release(),
    cpuModel: cpus()[0]?.model,
    availableParallelism: availableParallelism(),
    loadAverage: loadavg(),
    processMaxRssKiB: process.resourceUsage().maxRSS,
  },
  buildSha256: Object.fromEntries(
    ['core', 'planner', 'session', 'index'].map((name) => [
      name,
      sha(readFileSync(new URL(`../dist/${name}.js`, import.meta.url))),
    ]),
  ),
  baselineSha256: baselinePath ? sha(readFileSync(baselinePath)) : null,
  design: {
    blocks,
    warmupPerScenarioPolicy: 1,
    timing: 'JSON.parse + real API + JSON.stringify',
    validationOutsideTimer:
      'every policy executed in every modeled world; diagnostics match current evaluate',
    interleaved: true,
    limitsAreSeparateStatuses: true,
    rssIsWholeProcess: true,
  },
  completed,
  failures,
  consumedBytes,
  summary,
  measures,
  cli: {
    scenario: 'parity3_noise',
    includesProcessStartup: true,
    samplesMs: cliMs,
    medianMs: cliMs.length ? quantile(cliMs, 0.5) : null,
  },
};
if (output) {
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
}
console.log(
  JSON.stringify(
    { completed, failures, output: output ?? null, summary, cli: report.cli },
    null,
    2,
  ),
);
