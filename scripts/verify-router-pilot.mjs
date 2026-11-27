import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compileAnchor, routeFalp } from '../dist/index.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const directory = resolve(process.argv[2] ?? join(root, 'docs/evidence/router-integration/pilot'));
const hashes = {};
function load(path, label) {
  const bytes = readFileSync(path);
  hashes[label] = createHash('sha256').update(bytes).digest('hex');
  return JSON.parse(bytes);
}
const inputs = load(join(root, 'tests/fixtures/router-integration/pilot-inputs.json'), 'inputs');
const gold = load(
  join(root, 'tests/fixtures/router-integration/pilot-expectations.json'),
  'expectations',
);
const ids = inputs.cases.map((item) => item.id);
assert.equal(ids.length, 8, 'pilot cardinality');
assert.equal(new Set(ids).size, 8, 'unique input IDs');
assert.deepEqual(Object.keys(gold.cases).sort(), [...ids].sort(), 'complete expectations');
assert.equal(gold.frozen_before_outputs, true);

function indexCases(document, label) {
  assert.ok(Array.isArray(document.cases), label + ': case array');
  assert.deepEqual(
    document.cases.map((item) => item.id).sort(),
    [...ids].sort(),
    label + ': exact IDs',
  );
  return new Map(document.cases.map((item) => [item.id, item]));
}
function matchesGold(result, expected, label) {
  assert.ok(expected.routes.includes(result.route), label + ': semantic route');
  assert.ok(expected.next.includes(result.next), label + ': operational next');
  assert.equal(result.explorationRequired, expected.explorationRequired, label + ': exploration');
}
const variants = {};
const outputs = {};
for (const [name, variant] of [
  ['baseline', 'instructional-baseline'],
  ['assisted', 'motor-assisted'],
]) {
  const output = load(join(directory, name, 'output.json'), name + '.output');
  assert.equal(output.variant, variant);
  const indexed = indexCases(output, name);
  const results = [];
  for (const input of inputs.cases) {
    const item = indexed.get(input.id);
    const expected = gold.cases[input.id];
    matchesGold(item, expected, name + ':' + input.id);
    assert.equal(item.anchor, input.anchor, input.id + ': literal anchor');
    assert.equal(typeof item.prompt, 'string');
    assert.ok(item.prompt.trim(), input.id + ': nonempty prompt');
    assert.deepEqual(item.clarifyingQuestions, [], input.id + ': no unnecessary questions');
    for (const fragment of expected.protected) {
      assert.ok(item.prompt.includes(fragment), input.id + ': protected fragment ' + fragment);
    }
    results.push({ id: input.id, route: item.route, next: item.next, mechanicalChecks: 'PASS' });
  }
  variants[name] = { cases: results.length, passed: results.length, results };
  outputs[name] = indexed;
}

const requests = load(join(directory, 'assisted/requests.json'), 'assisted.requests');
const recorded = load(join(directory, 'assisted/engine-results.json'), 'assisted.engine-results');
assert.equal(requests.metadata.inputSha256, hashes.inputs);
assert.equal(recorded.metadata.inputSha256, hashes.inputs);
assert.equal(recorded.routeFalpInvocationCount, ids.length);
const requestCases = indexCases(requests, 'requests');
const resultCases = indexCases(recorded, 'recorded engine');
assert.deepEqual(
  recorded.cases.map((item) => item.invocation).sort((a, b) => a - b),
  [1, 2, 3, 4, 5, 6, 7, 8],
);
const replays = [];
for (const input of inputs.cases) {
  const supplied = requestCases.get(input.id).request;
  assert.deepEqual(supplied.context, input.context, input.id + ': declared context');
  assert.equal(supplied.context.anchor, input.anchor);
  if (input.brief === null) {
    assert.equal(supplied.kind, 'ready', input.id + ': no invented investigation');
    assert.equal(Object.hasOwn(supplied, 'state'), false);
  } else {
    assert.equal(supplied.kind, 'investigation');
    assert.deepEqual(
      supplied.state,
      compileAnchor(input.brief),
      input.id + ': supplied finite model',
    );
  }
  const before = JSON.stringify(supplied);
  const actual = routeFalp(supplied);
  assert.equal(JSON.stringify(supplied), before, input.id + ': immutable request');
  assert.deepEqual(actual, resultCases.get(input.id).result, input.id + ': actual engine replay');
  const expected = gold.cases[input.id];
  matchesGold(actual, expected, input.id);
  const generated = outputs.assisted.get(input.id);
  assert.deepEqual(
    [generated.route, generated.next, generated.explorationRequired],
    [actual.route, actual.next, actual.explorationRequired],
    input.id + ': generated prompt obeys recorded control',
  );
  assert.equal(actual.observationRoute, expected.observationRoute ?? null);
  assert.equal(actual.plan?.worstCaseCost ?? null, expected.cost ?? null);
  if (input.brief === null) assert.equal(actual.plan, null);
  else assert.equal(actual.plan.status, 'planned');
  replays.push({
    id: input.id,
    route: actual.route,
    observationRoute: actual.observationRoute,
    next: actual.next,
    cost: actual.plan?.worstCaseCost ?? null,
    status: 'PASS',
  });
}
for (const path of [
  'src/falp.ts',
  'dist/falp.js',
  'dist/anchor.js',
  'dist/planner.js',
  'dist/session.js',
  'dist/core.js',
]) {
  hashes[path] = createHash('sha256')
    .update(readFileSync(join(root, path)))
    .digest('hex');
}
console.log(
  JSON.stringify(
    {
      status: 'PASS',
      kind: 'recorded_synthetic_contract_pilot_and_current_engine_replay',
      node: process.version,
      variants,
      replayedEngineCalls: replays.length,
      numericPlans: replays.filter((item) => item.cost !== null).length,
      replays,
      hashes,
      limitations: [
        'Eight author-labelled synthetic cases; no claim of production representativeness or statistical improvement.',
        'Fresh agent contexts shared a filesystem; blindness and model-family diversity are not established.',
        'Prompt semantics require the separate recorded review; these checks cover declared controls and literal constraints.',
        'Replaying saved requests runs the current library, not a new LLM evaluation.',
        'No external probes, recipient tasks or installed-plugin changes; no token, provider-cost or end-to-end latency telemetry.',
      ],
    },
    null,
    2,
  ),
);
