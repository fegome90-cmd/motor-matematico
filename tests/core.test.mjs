import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { compareRatios, evaluate, validate } from '../dist/core.js';

const fixture = (name) =>
  JSON.parse(readFileSync(new URL(`../examples/${name}.json`, import.meta.url), 'utf8'));
const expected = {
  focused: ['focused', 'ONE_ACTION_RESOLVES', 'inspect_host'],
  direct: ['direct', 'SUFFICIENT', null],
  incomplete: ['abstain', 'INCOMPLETE_COVERAGE', null],
  conflict: ['abstain', 'CONFLICT', null],
  blocked: ['abstain', 'GATE_UNKNOWN', null],
  exploratory: ['exploratory', 'PARTIAL_PROGRESS', 'confirm_goal'],
  no_action: ['abstain', 'NO_ADMISSIBLE_ACTION', null],
  joint_plan: ['exploratory', 'JOINT_PLAN_REQUIRED', null],
};
for (const [name, answer] of Object.entries(expected))
  test(`fixture ${name}`, () => {
    const r = evaluate(fixture(name));
    assert.deepEqual([r.route, r.reason, r.recommendedAction], answer);
  });
test('exact rational equality and comparison beyond Number precision', () => {
  assert.equal(compareRatios(2n, 6n, 3n, 9n), 0);
  assert.equal(compareRatios(9007199254740993n, 9007199254740992n, 1n, 1n), 1);
  assert.throws(() => compareRatios(1n, 0n, 1n, 2n));
  assert.throws(() => compareRatios(-1n, 2n, 1n, 2n));
});
test('exact cost selection beyond Number precision', () => {
  const x = fixture('focused');
  x.remainingBudget = '9007199254740993';
  x.actions[0].cost = '9007199254740992';
  x.actions[1].cost = '9007199254740993';
  assert.equal(evaluate(x).recommendedAction, 'inspect_host');
  x.remainingBudget = '9007199254740991';
  assert.equal(evaluate(x).reason, 'NO_ADMISSIBLE_ACTION');
});
test('joint signatures preserve correlations; marginal product is not manufactured', () => {
  const r = evaluate(fixture('focused'));
  assert.equal(r.signatureCount, 2);
  assert.equal(
    r.decisions.reduce((n, d) => n * d.possible.length, 1),
    4,
  );
  assert.deepEqual(r.signatures, [
    ['external', 'direct_calls'],
    ['native', 'code_mode'],
  ]);
});
test('same signature in distinct worlds is sufficient if coverage asserted', () => {
  const x = fixture('focused');
  x.worlds[1].answers = structuredClone(x.worlds[0].answers);
  const r = evaluate(x);
  assert.equal(r.worldIds.length, 2);
  assert.equal(r.signatureCount, 1);
  assert.equal(r.route, 'direct');
});
test('idempotent observation and immutable input', () => {
  const x = fixture('direct');
  const before = structuredClone(x);
  const r = evaluate(x);
  assert.deepEqual(x, before);
  x.observations.push(structuredClone(x.observations[0]));
  assert.deepEqual(evaluate(x), r);
});
test('invariant under order and domain order', () => {
  const x = fixture('exploratory');
  const r = evaluate(x);
  for (const k of ['decisions', 'worlds', 'actions', 'observations']) x[k].reverse();
  for (const d of x.decisions) d.domain.reverse();
  assert.deepEqual(evaluate(x), r);
});
test('evidence intersection is monotone and order invariant, conflict retained', () => {
  const x = fixture('exploratory');
  const start = evaluate(x);
  x.observations.push({ action: 'confirm_goal', outcome: 'audit', source: 'fixture' });
  const first = evaluate(x);
  assert.ok(first.worldIds.every((w) => start.worldIds.includes(w)));
  x.observations.push({ action: 'inspect_host', outcome: 'native', source: 'fixture' });
  const second = evaluate(x);
  assert.ok(second.worldIds.every((w) => first.worldIds.includes(w)));
  assert.equal(second.route, 'direct');
  x.observations.reverse();
  assert.deepEqual(evaluate(x), second);
  x.observations.push({ action: 'confirm_goal', outcome: 'repair', source: 'other_fixture' });
  assert.equal(evaluate(x).reason, 'CONFLICT');
});
test('permission, availability, budget and global gate are fail closed', () => {
  const x = fixture('focused');
  x.actions[0].permission = 'unknown';
  x.actions[1].permission = 'denied';
  assert.equal(evaluate(x).reason, 'NO_ADMISSIBLE_ACTION');
  x.actions[0].permission = 'allowed';
  x.actions[0].available = false;
  assert.equal(evaluate(x).reason, 'NO_ADMISSIBLE_ACTION');
  x.actions[0].available = true;
  x.remainingBudget = '1';
  assert.equal(evaluate(x).reason, 'NO_ADMISSIBLE_ACTION');
  const y = fixture('direct');
  y.gate = 'denied';
  assert.equal(evaluate(y).reason, 'GATE_DENIED');
});
test('empty complete universe is contradiction; empty incomplete universe not certainty', () => {
  const x = fixture('focused');
  x.worlds = [];
  x.actions = [];
  assert.equal(evaluate(x).reason, 'CONFLICT');
  x.coverage = 'incomplete';
  assert.equal(evaluate(x).reason, 'INCOMPLETE_COVERAGE');
  assert.equal(evaluate(x).sufficient, false);
});
test('joint plan: partial observation makes second action sufficient', () => {
  const x = fixture('joint_plan');
  x.observations.push({ action: 'observe_a', outcome: 'v0', source: 'fixture' });
  assert.equal(evaluate(x).recommendedAction, 'observe_b');
  assert.equal(evaluate(x).route, 'focused');
  x.observations.push({ action: 'observe_b', outcome: 'v1', source: 'fixture' });
  assert.equal(evaluate(x).route, 'direct');
});
test('JSON round-trip exact and output contains no BigInt', () => {
  const x = fixture('focused');
  x.actions[0].cost = '100000000000000000000000000000000000000';
  x.remainingBudget = x.actions[0].cost;
  const r = evaluate(x);
  assert.deepEqual(JSON.parse(JSON.stringify(r)), r);
  assert.equal(r.actions[0].cost, x.actions[0].cost);
});
test('stable tie break by ID', () => {
  const x = fixture('focused');
  x.actions[1].cost = x.actions[0].cost;
  x.actions.reverse();
  assert.equal(evaluate(x).recommendedAction, 'inspect_host');
});
for (const [name, mutate] of Object.entries({
  badCost: (x) => (x.actions[0].cost = '0'),
  numericCost: (x) => (x.actions[0].cost = 2),
  leadingZero: (x) => (x.actions[0].cost = '02'),
  duplicateWorld: (x) => x.worlds.push(x.worlds[0]),
  duplicateDecision: (x) => x.decisions.push(x.decisions[0]),
  duplicateAction: (x) => x.actions.push(x.actions[0]),
  missingOutcome: (x) => delete x.actions[0].outcomes.w1,
  extraOutcome: (x) => (x.actions[0].outcomes.unknown = 'x'),
  invalidAnswer: (x) => (x.worlds[0].answers.strategy = 'other'),
  missingAnswer: (x) => delete x.worlds[0].answers.strategy,
  badEvidence: (x) => x.observations.push({ action: 'unknown', outcome: 'x', source: 'fixture' }),
  badGate: (x) => (x.gate = 'maybe'),
  unknownField: (x) => (x.surprise = true),
  emptyDecisionList: (x) => (x.decisions = []),
  invalidCoverage: (x) => (x.coverage = 'maybe'),
}))
  test(`reject malformed input ${name}`, () => {
    const x = fixture('focused');
    mutate(x);
    assert.throws(() => validate(x), TypeError);
  });
