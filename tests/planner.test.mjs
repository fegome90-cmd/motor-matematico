import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { evaluate, plan, validate } from '../dist/index.js';

const fixture = (name) =>
  JSON.parse(readFileSync(new URL(`../examples/${name}.json`, import.meta.url), 'utf8'));
const action = (id, cost, outcomes) => ({
  id,
  capability: 'evidence',
  permission: 'allowed',
  available: true,
  cost,
  outcomes,
});
const model = (answers, actions, budget = '10') => ({
  coverage: 'complete',
  gate: 'allowed',
  costUnit: 'work_units',
  remainingBudget: budget,
  decisions: [{ id: 'q', domain: [...new Set(answers)] }],
  worlds: answers.map((answer, i) => ({ id: `w${i}`, answers: { q: answer } })),
  actions,
  observations: [],
});
function parity(bits, noise = false, costs = []) {
  const size = 2 ** (bits + Number(noise));
  const answers = Array.from(
    { length: size },
    (_, i) => `v${Array.from({ length: bits }, (_, b) => (i >> b) & 1).reduce((a, b) => a ^ b, 0)}`,
  );
  const actions = Array.from({ length: bits }, (_, b) =>
    action(
      `signal_${b}`,
      costs[b] ?? '2',
      Object.fromEntries(answers.map((_, i) => [`w${i}`, `o${(i >> b) & 1}`])),
    ),
  );
  if (noise)
    actions.push(
      action(
        'noise',
        '1',
        Object.fromEntries(answers.map((_, i) => [`w${i}`, `o${(i >> bits) & 1}`])),
      ),
    );
  return model(
    answers,
    actions,
    String(costs.length ? costs.reduce((n, cost) => n + BigInt(cost), 0n) : 2 * bits),
  );
}
function auditPolicy(raw, result) {
  const input = validate(raw);
  const actions = new Map(input.actions.map((item) => [item.id, item]));
  const compatible = input.worlds.filter((world) =>
    input.observations.every(
      (observation) => actions.get(observation.action).outcomes[world.id] === observation.outcome,
    ),
  );
  assert.ok(result.status === 'planned' || result.status === 'solved');
  const nodes = new Map(result.policy.nodes.map((node) => [node.id, node]));
  assert.equal(nodes.size, result.policy.nodes.length);
  const reached = new Set();
  function visit(id, worlds, spent, used, ancestors) {
    assert.ok(worlds.length > 0, 'every policy branch has modeled support');
    assert.ok(!ancestors.has(id), 'policy has no cycle');
    assert.ok(nodes.has(id), 'every child node exists');
    reached.add(id);
    const node = nodes.get(id);
    if (node.type === 'leaf') {
      for (const world of worlds) assert.deepEqual(node.answers, world.answers);
      return spent;
    }
    assert.equal(node.type, 'decision');
    const selected = actions.get(node.action);
    assert.ok(selected);
    assert.equal(selected.permission, 'allowed');
    assert.equal(selected.available, true);
    assert.ok(!used.has(selected.id), 'deterministic actions are never repeated');
    const nextSpent = spent + BigInt(selected.cost);
    assert.ok(nextSpent <= BigInt(input.remainingBudget), 'every execution path respects budget');
    const possible = [...new Set(worlds.map((world) => selected.outcomes[world.id]))].sort();
    assert.ok(possible.length > 1, 'every decision partitions its current state');
    assert.deepEqual(
      node.branches.map((branch) => branch.outcome),
      possible,
    );
    let worst = 0n;
    for (const branch of node.branches) {
      const subset = worlds.filter((world) => selected.outcomes[world.id] === branch.outcome);
      const cost = visit(
        branch.child,
        subset,
        nextSpent,
        new Set([...used, selected.id]),
        new Set([...ancestors, id]),
      );
      if (cost > worst) worst = cost;
    }
    return worst;
  }
  const cost = visit(result.policy.root, compatible, 0n, new Set(), new Set());
  assert.equal(String(cost), result.worstCaseCost);
  assert.equal(reached.size, nodes.size, 'policy contains no unreachable nodes');
  assert.equal(result.statistics.policyNodes, nodes.size);
  assert.ok(
    nodes.size <= 2 * compatible.length - 1,
    'output size remains bounded by the world count',
  );
}
function assertWithheld(result, status, reason) {
  assert.equal(result.status, status);
  assert.equal(result.reason, reason);
  assert.equal(result.recommendedAction, null);
  assert.equal(result.worstCaseCost, null);
  assert.equal(result.policy, null);
  assert.equal(result.statistics.policyNodes, 0);
  assert.equal(Object.hasOwn(result, 'answers'), false);
}

test('three-bit parity ignores cheap noise and resolves every branch for cost six', () => {
  const input = parity(3, true);
  assert.equal(evaluate(input).reason, 'JOINT_PLAN_REQUIRED');
  const result = plan(input);
  assert.equal(result.status, 'planned');
  assert.equal(result.reason, 'OPTIMAL_POLICY');
  assert.equal(result.recommendedAction, 'signal_0');
  assert.equal(result.worstCaseCost, '6');
  assert.ok(result.policy.nodes.every((node) => node.type === 'leaf' || node.action !== 'noise'));
  auditPolicy(input, result);
  input.remainingBudget = '5';
  assertWithheld(plan(input), 'infeasible', 'NO_POLICY_WITHIN_BUDGET');
});

test('an adaptive policy chooses different follow-up actions in its two branches', () => {
  const input = model(
    ['a', 'b', 'c', 'd'],
    [
      action('a_group', '1', { w0: 'left', w1: 'left', w2: 'right', w3: 'right' }),
      action('b_left', '1', { w0: 'one', w1: 'other', w2: 'other', w3: 'other' }),
      action('c_right', '1', { w0: 'other', w1: 'other', w2: 'one', w3: 'other' }),
      action('direct', '3', { w0: 'a', w1: 'b', w2: 'c', w3: 'd' }),
    ],
    '2',
  );
  const result = plan(input);
  assert.equal(result.recommendedAction, 'a_group');
  assert.equal(result.worstCaseCost, '2');
  const nodes = new Map(result.policy.nodes.map((node) => [node.id, node]));
  const root = nodes.get(result.policy.root);
  assert.deepEqual(
    root.branches.map((branch) => nodes.get(branch.child).action),
    ['b_left', 'c_right'],
  );
  auditPolicy(input, result);
});

test('minimax cost includes the expensive branch even when another outcome stops early', () => {
  const input = model(
    ['a', 'b', 'c'],
    [
      action('a_cheap', '1', { w0: 'one', w1: 'other', w2: 'other' }),
      action('b_follow', '4', { w0: 'one', w1: 'one', w2: 'other' }),
      action('c_direct', '4', { w0: 'a', w1: 'b', w2: 'c' }),
    ],
    '4',
  );
  const result = plan(input);
  assert.equal(result.recommendedAction, 'c_direct');
  assert.equal(result.worstCaseCost, '4');
  auditPolicy(input, result);
});

test('sum and comparison of costs remain exact beyond Number precision', () => {
  const input = parity(2, false, ['9007199254740993', '9007199254740995']);
  input.actions.push(
    action('z_direct', '18014398509481989', { w0: 'v0', w1: 'v1', w2: 'v1', w3: 'v0' }),
  );
  input.remainingBudget = '18014398509481989';
  const result = plan(input);
  assert.equal(result.worstCaseCost, '18014398509481988');
  assert.equal(result.recommendedAction, 'signal_0');
  assert.deepEqual(JSON.parse(JSON.stringify(result)), result);
  auditPolicy(input, result);
  input.remainingBudget = '18014398509481987';
  assertWithheld(plan(input), 'infeasible', 'NO_POLICY_WITHIN_BUDGET');
});

test('equal optimum costs choose the action with the smallest canonical ID', () => {
  const input = model(
    ['a', 'b'],
    [action('z', '2', { w0: 'a', w1: 'b' }), action('a', '2', { w0: 'x', w1: 'y' })],
    '2',
  );
  const result = plan(input);
  assert.equal(result.recommendedAction, 'a');
  assert.equal(result.worstCaseCost, '2');
  input.actions.reverse();
  assert.deepEqual(plan(input), result);
});

test('input and option ordering, duplicates of evidence, and frozen objects preserve the result', () => {
  const input = fixture('joint_plan');
  const before = structuredClone(input);
  const expected = plan(input);
  const freeze = (value) => {
    if (value && typeof value === 'object') {
      Object.values(value).forEach(freeze);
      Object.freeze(value);
    }
    return value;
  };
  assert.deepEqual(plan(freeze(input), Object.freeze({ maxDepth: 32 })), expected);
  assert.deepEqual(input, before);
  for (const key of ['decisions', 'worlds', 'actions', 'observations']) before[key].reverse();
  for (const decision of before.decisions) decision.domain.reverse();
  assert.deepEqual(plan(before), expected);
  before.observations.push({ action: 'observe_a', outcome: 'v0', source: 'fixture' });
  const once = plan(before);
  before.observations.push({ ...before.observations[0] });
  assert.deepEqual(plan(before), once);
  auditPolicy(before, once);
});

test('solved requires complete coverage and an allowed global gate', () => {
  const input = fixture('direct');
  const solved = plan(input, { maxDepth: 0 });
  assert.equal(solved.status, 'solved');
  assert.equal(solved.worstCaseCost, '0');
  assert.equal(solved.recommendedAction, null);
  auditPolicy(input, solved);
  input.gate = 'denied';
  assertWithheld(plan(input), 'blocked', 'GATE_DENIED');
  input.gate = 'unknown';
  assertWithheld(plan(input), 'blocked', 'GATE_UNKNOWN');
  input.gate = 'allowed';
  input.coverage = 'incomplete';
  assertWithheld(plan(input), 'incomplete', 'INCOMPLETE_COVERAGE');
});

test('empty complete models and out-of-support evidence are conflicts, including behind a gate', () => {
  const empty = model([], []);
  empty.decisions = [{ id: 'q', domain: ['a'] }];
  empty.gate = 'denied';
  assertWithheld(plan(empty), 'conflict', 'CONFLICT');
  empty.coverage = 'incomplete';
  assertWithheld(plan(empty), 'blocked', 'GATE_DENIED');
  empty.gate = 'allowed';
  assertWithheld(plan(empty), 'incomplete', 'INCOMPLETE_COVERAGE');
  const input = parity(2);
  input.observations.push({ action: 'signal_0', outcome: 'unmodeled', source: 'fixture' });
  assertWithheld(plan(input), 'conflict', 'CONFLICT');
  input.coverage = 'incomplete';
  assertWithheld(plan(input), 'incomplete', 'INCOMPLETE_COVERAGE');
});

test('joint answers stop without distinguishing worlds that have the same signature', () => {
  const input = model(
    ['a', 'a', 'b', 'b'],
    [action('group', '1', { w0: 'x', w1: 'x', w2: 'y', w3: 'y' })],
    '1',
  );
  const result = plan(input);
  assert.equal(result.status, 'planned');
  assert.equal(result.worstCaseCost, '1');
  auditPolicy(input, result);
  input.observations.push({ action: 'group', outcome: 'x', source: 'fixture' });
  assert.equal(plan(input).status, 'solved');
});

test('a differing answer pair that no action distinguishes has no robust policy', () => {
  const input = model(['a', 'b', 'c'], [action('partial', '1', { w0: 'x', w1: 'x', w2: 'y' })]);
  assertWithheld(plan(input), 'infeasible', 'NO_POLICY_WITHIN_BUDGET');
  input.actions = [];
  assertWithheld(plan(input, { maxDepth: 0 }), 'infeasible', 'NO_POLICY_WITHIN_BUDGET');
});

test('permissions, availability, and affordability exclude actions from every policy', () => {
  const input = model(['a', 'b'], [action('solve', '1', { w0: 'a', w1: 'b' })], '1');
  assert.equal(plan(input).status, 'planned');
  for (const permission of ['unknown', 'denied']) {
    input.actions[0].permission = permission;
    assertWithheld(plan(input), 'infeasible', 'NO_POLICY_WITHIN_BUDGET');
  }
  input.actions[0].permission = 'allowed';
  input.actions[0].available = false;
  assertWithheld(plan(input), 'infeasible', 'NO_POLICY_WITHIN_BUDGET');
  input.actions[0].available = true;
  input.remainingBudget = '0';
  assertWithheld(plan(input), 'infeasible', 'NO_POLICY_WITHIN_BUDGET');
});

test('all deterministic search limits withhold action, cost, and policy', () => {
  for (const [option, value, reason] of [
    ['maxWorlds', 1, 'MAX_WORLDS'],
    ['maxActions', 1, 'MAX_ACTIONS'],
    ['maxStates', 1, 'MAX_STATES'],
    ['maxTransitions', 1, 'MAX_TRANSITIONS'],
    ['maxDepth', 0, 'MAX_DEPTH'],
  ])
    assertWithheld(plan(parity(2), { [option]: value }), 'limit_exceeded', reason);
  const overBudget = parity(2, false, ['1', '1']);
  overBudget.remainingBudget = '1';
  assertWithheld(plan(overBudget, { maxStates: 1 }), 'limit_exceeded', 'MAX_STATES');
});

test('elapsed-time interruption withholds the entire result', () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'performance');
  let ticks = 0;
  Object.defineProperty(globalThis, 'performance', {
    configurable: true,
    value: { now: () => ticks++ * 10 },
  });
  try {
    assertWithheld(plan(parity(2), { maxMillis: 1 }), 'limit_exceeded', 'MAX_MILLIS');
  } finally {
    Object.defineProperty(globalThis, 'performance', descriptor);
  }
});

test('world capacity applies to compatible worlds and terminal results need no search', () => {
  const input = model(
    Array.from({ length: 130 }, (_, i) => `v${i % 2}`),
    [],
    '1',
  );
  input.actions = [
    action(
      'retain_pair',
      '1',
      Object.fromEntries(input.worlds.map((world, i) => [world.id, i < 2 ? 'keep' : 'discard'])),
    ),
    action(
      'solve',
      '1',
      Object.fromEntries(input.worlds.map((world) => [world.id, world.answers.q])),
    ),
  ];
  assertWithheld(plan(input), 'limit_exceeded', 'MAX_WORLDS');
  input.observations.push({ action: 'retain_pair', outcome: 'keep', source: 'fixture' });
  const reduced = plan(input, { maxWorlds: 2 });
  assert.equal(reduced.status, 'planned');
  assert.equal(reduced.statistics.worlds, 130);
  assert.equal(reduced.statistics.compatibleWorlds, 2);
  auditPolicy(input, reduced);
  input.observations = [];
  input.worlds.forEach((world) => {
    world.answers.q = 'v0';
  });
  assert.equal(plan(input, { maxWorlds: 1, maxActions: 1, maxDepth: 0 }).status, 'solved');
});

test('action capacity counts affordable allowed available actions, including constants', () => {
  const input = model(['a', 'b'], [action('solve', '1', { w0: 'a', w1: 'b' })], '1');
  for (let i = 0; i < 40; i++) {
    const extra = action(`excluded_${i}`, i % 4 === 0 ? '2' : '1', { w0: 'x', w1: 'x' });
    if (i % 4 === 1) extra.permission = 'denied';
    if (i % 4 === 2) extra.permission = 'unknown';
    if (i % 4 === 3) extra.available = false;
    input.actions.push(extra);
  }
  const result = plan(input, { maxActions: 1 });
  assert.equal(result.status, 'planned');
  assert.equal(result.statistics.actions, 41);
  assert.equal(result.statistics.admissibleActions, 1);
  input.actions.push(action('constant', '1', { w0: 'x', w1: 'x' }));
  assertWithheld(plan(input, { maxActions: 1 }), 'limit_exceeded', 'MAX_ACTIONS');
});

test('options reject unknown keys, malformed integers, and unsupported capacities', () => {
  for (const configuration of [
    null,
    [],
    true,
    2,
    { surprise: 1 },
    { maxStates: undefined },
    { maxStates: 0 },
    { maxStates: -1 },
    { maxStates: 1.2 },
    { maxStates: NaN },
    { maxStates: Infinity },
    { maxStates: '2' },
    { maxWorlds: 513 },
    { maxActions: 65 },
    { maxStates: 200001 },
    { maxTransitions: 2000001 },
    { maxDepth: 65 },
    { maxDepth: -1 },
    { maxMillis: 10001 },
    Object.assign(Object.create({}), { maxStates: 1 }),
    { [Symbol('x')]: 1 },
  ]) {
    assert.throws(() => plan(parity(2), configuration), TypeError);
  }
  assert.equal(
    plan(parity(2), Object.assign(Object.create(null), { maxDepth: 4 })).status,
    'planned',
  );
});

test('JSON data validation rejects getters and custom arrays without running user code', () => {
  let calls = 0;
  const input = parity(2);
  Object.defineProperty(input, 'gate', {
    enumerable: true,
    get() {
      calls++;
      return 'allowed';
    },
  });
  assert.throws(() => plan(input), TypeError);
  assert.throws(() => evaluate(input), TypeError);
  const configuration = {};
  Object.defineProperty(configuration, 'maxStates', {
    enumerable: true,
    get() {
      calls++;
      return 100;
    },
  });
  assert.throws(() => plan(parity(2), configuration), TypeError);
  const arrayInput = parity(2);
  Object.defineProperty(arrayInput.worlds, '0', {
    enumerable: true,
    get() {
      calls++;
      return {};
    },
  });
  assert.throws(() => validate(arrayInput), TypeError);
  const customArray = parity(2);
  customArray.worlds[Symbol.iterator] = function* () {
    calls++;
    yield undefined;
  };
  assert.throws(() => validate(customArray), TypeError);
  assert.equal(calls, 0);
  assert.equal(plan(parity(2)).worstCaseCost, '4');
});

test('prototype-like canonical IDs remain ordinary own data keys', () => {
  const input = {
    coverage: 'complete',
    gate: 'allowed',
    costUnit: 'units',
    remainingBudget: '1',
    decisions: [{ id: 'constructor', domain: ['a', 'b'] }],
    worlds: [
      { id: 'constructor', answers: { constructor: 'a' } },
      { id: 'prototype', answers: { constructor: 'b' } },
    ],
    actions: [action('toString', '1', { constructor: 'left', prototype: 'right' })],
    observations: [],
  };
  const result = plan(input);
  assert.equal(result.recommendedAction, 'toString');
  assert.equal(result.worstCaseCost, '1');
  auditPolicy(input, result);
});
