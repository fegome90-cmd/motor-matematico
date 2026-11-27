import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { advanceAnchor, compileAnchor, routeAnchor } from '../dist/index.js';

// Rows and canonical column models are hand-authored separately; neither is derived by the subject.
const cases = JSON.parse(
  readFileSync(
    new URL('./fixtures/router-integration/translation-cases.json', import.meta.url),
    'utf8',
  ),
);
const copy = (value) => JSON.parse(JSON.stringify(value));

function freeze(value) {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}

function permutations(values) {
  if (values.length === 0) return [[]];
  return values.flatMap((value, index) =>
    permutations(values.filter((_, other) => other !== index)).map((tail) => [value, ...tail]),
  );
}

function rotationsAndReversals(values) {
  return values.flatMap((_, index) => {
    const rotated = [...values.slice(index), ...values.slice(0, index)];
    return [rotated, [...rotated].reverse()];
  });
}

function* reorderedBriefs(fixture, worldOrders) {
  for (const questionOrder of permutations([0, 1])) {
    for (const probeOrder of permutations([0, 1, 2])) {
      for (const worldOrder of worldOrders) {
        const brief = copy(fixture.brief);
        brief.questions = questionOrder.map((index) => brief.questions[index]);
        brief.probes = probeOrder.map((index) => brief.probes[index]);
        brief.scenarios = worldOrder.map((index) => brief.scenarios[index]);
        for (const row of brief.scenarios) {
          row.answers = Object.fromEntries(
            brief.questions.map(({ id }) => [id, row.answers[id]]).reverse(),
          );
          row.outcomes = Object.fromEntries(
            brief.probes.map(({ id }) => [id, row.outcomes[id]]).reverse(),
          );
        }
        yield freeze(brief);
      }
    }
  }
}

test('72 permutations retain three correlated rows and unavailable or denied columns', (t) => {
  const fixture = cases[0];
  let variants = 0;
  for (const brief of reorderedBriefs(fixture, permutations([0, 1, 2]))) {
    const before = JSON.stringify(brief);
    const state = compileAnchor(brief);
    assert.deepEqual(state, { anchor: fixture.brief.anchor, model: fixture.expectedModel });
    assert.equal(JSON.stringify(brief), before);
    const routed = routeAnchor(state);
    assert.deepEqual(
      [routed.route, routed.plan.recommendedAction, routed.plan.worstCaseCost],
      ['focused', 'constructor', '2'],
    );
    assert.equal(routed.plan.statistics.worlds, 3);
    assert.equal(routed.plan.statistics.signatures, 3);
    variants += 1;
  }
  assert.equal(variants, 72);
  t.diagnostic(
    '72 row/column permutations; independent literal column model; three of six possible answer pairs retained.',
  );
});

test('96 permutations retain distinct outcome alphabets and the joint answer relationship', (t) => {
  const fixture = cases[1];
  let variants = 0;
  for (const brief of reorderedBriefs(fixture, rotationsAndReversals([0, 1, 2, 3]))) {
    const before = JSON.stringify(brief);
    const state = compileAnchor(brief);
    assert.deepEqual(state, { anchor: fixture.brief.anchor, model: fixture.expectedModel });
    assert.equal(JSON.stringify(brief), before);
    const routed = routeAnchor(state);
    assert.deepEqual(
      [routed.route, routed.plan.recommendedAction, routed.plan.worstCaseCost],
      ['exploratory', 'read_left', '5'],
    );
    variants += 1;
  }
  assert.equal(variants, 96);
  t.diagnostic(
    '96 row/column permutations; four worlds; two informative columns plus constant noise.',
  );
});

test('24 JSON-roundtrip sessions preserve exact anchors and all four joint answers', (t) => {
  const anchors = [
    ' \r\n  ANCLA: solo lectura.\r\n\t ',
    'ANCLA: Caf\u00e9.',
    'ANCLA: Cafe\u0301.',
    'ANCLA: 👩🏽‍💻\nNO GO: cambiar permisos.',
    'ANCLA:\u0000 conservar el texto opaco.',
    `${'a'.repeat(32766)}😀`,
  ];
  const paths = [
    ['left:0', 'right:0', { alignment: 'same', owner: 'local' }],
    ['left:0', 'right:1', { alignment: 'different', owner: 'local' }],
    ['left:1', 'right:0', { alignment: 'different', owner: 'remote' }],
    ['left:1', 'right:1', { alignment: 'same', owner: 'remote' }],
  ];
  let sessions = 0;
  for (const anchor of anchors) {
    for (const [left, right, answers] of paths) {
      const brief = copy(cases[1].brief);
      brief.anchor = anchor;
      const initial = compileAnchor(freeze(brief));
      const first = advanceAnchor(freeze(copy(initial)), {
        action: 'read_left',
        outcome: left,
        source: 'fixture:left',
      });
      assert.equal(first.anchor, anchor);
      assert.equal(first.model.remainingBudget, '3');
      const next = routeAnchor(copy(first));
      assert.deepEqual(
        [next.route, next.plan.recommendedAction, next.plan.worstCaseCost],
        ['focused', 'read_right', '3'],
      );
      const final = advanceAnchor(freeze(copy(first)), {
        action: 'read_right',
        outcome: right,
        source: 'fixture:right',
      });
      const solved = routeAnchor(copy(final));
      assert.deepEqual(
        [solved.route, solved.plan.status, solved.plan.worstCaseCost, final.model.remainingBudget],
        ['direct', 'solved', '0', '0'],
      );
      assert.deepEqual(solved.plan.policy.nodes, [{ id: 'n0', type: 'leaf', answers }]);
      assert.equal(initial.anchor, anchor);
      assert.equal(final.anchor, anchor);
      assert.equal(solved.anchor, anchor);
      assert.equal(initial.model.remainingBudget, '5');
      assert.deepEqual(initial.model.observations, []);
      sessions += 1;
    }
  }
  assert.equal(sessions, 24);
  t.diagnostic(
    'Six anchors, including CRLF, NFC/NFD, emoji, NUL and the exact UTF-16 size boundary; four complete paths each.',
  );
});

test('compiled models do not alias input rows, question domains or observations', () => {
  const brief = copy(cases[1].brief);
  brief.observations = [{ action: 'read_left', outcome: 'left:0', source: 'fixture:prior' }];
  const state = compileAnchor(brief);
  const before = copy(brief);
  assert.deepEqual(
    [routeAnchor(state).plan.recommendedAction, routeAnchor(state).plan.worstCaseCost],
    ['read_right', '3'],
  );
  state.model.worlds[0].answers.owner = 'remote';
  state.model.actions[1].outcomes.w00 = 'left:1';
  state.model.decisions[0].domain[0] = 'other';
  state.model.observations[0].source = 'changed';
  assert.deepEqual(brief, before);
  assert.deepEqual(brief.scenarios[1].answers, { owner: 'local', alignment: 'same' });
  assert.deepEqual(brief.questions[1].domain, ['same', 'different']);
  assert.equal(brief.observations[0].source, 'fixture:prior');
});

test('an outcome from another column remains unsupported rather than being reinterpreted', () => {
  const initial = compileAnchor(copy(cases[1].brief));
  const valid = advanceAnchor(initial, {
    action: 'read_left',
    outcome: 'left:0',
    source: 'fixture:valid',
  });
  assert.deepEqual(
    [routeAnchor(valid).route, routeAnchor(valid).plan.recommendedAction],
    ['focused', 'read_right'],
  );
  const foreign = advanceAnchor(initial, {
    action: 'read_left',
    outcome: 'right:0',
    source: 'fixture:foreign-column',
  });
  const result = routeAnchor(foreign);
  assert.deepEqual(
    [result.route, result.plan.status, result.plan.reason, result.plan.recommendedAction],
    ['abstain', 'conflict', 'CONFLICT', null],
  );
  assert.equal(foreign.model.remainingBudget, '3');
  assert.deepEqual(foreign.model.observations, [
    { action: 'read_left', outcome: 'right:0', source: 'fixture:foreign-column' },
  ]);
  assert.equal(initial.model.remainingBudget, '5');
});
