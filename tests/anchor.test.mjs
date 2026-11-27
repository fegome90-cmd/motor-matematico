import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { advanceAnchor, compileAnchor, routeAnchor } from '../dist/index.js';

const fixture = () =>
  JSON.parse(readFileSync(new URL('../examples/anchor-routing.json', import.meta.url), 'utf8'));

test('compile preserves the exact anchor and transposes correlated scenarios', () => {
  const brief = fixture();
  brief.scenarios = [brief.scenarios[0], brief.scenarios[3]];
  const before = JSON.stringify(brief);
  const state = compileAnchor(brief);
  assert.equal(state.anchor, brief.anchor);
  assert.equal(JSON.stringify(brief), before);
  assert.equal(state.model.worlds.length, 2);
  assert.deepEqual(state.model.actions[0].outcomes, {
    'direct-remote': 'direct',
    'native-local': 'native',
  });
  assert.deepEqual(
    [routeAnchor(state).route, routeAnchor(state).plan.worstCaseCost],
    ['focused', '2'],
  );
});

test('all four audit scenarios resolve within budget with unchanged anchor', () => {
  const brief = fixture();
  for (const scenario of brief.scenarios) {
    const initial = compileAnchor(brief);
    const first = routeAnchor(initial);
    assert.equal(first.route, 'exploratory');
    assert.equal(first.plan.recommendedAction, 'inspect_host');
    assert.equal(first.plan.worstCaseCost, '5');
    const receipt = {
      action: 'inspect_host',
      outcome: scenario.outcomes.inspect_host,
      source: 'test',
    };
    const next = advanceAnchor(initial, receipt);
    assert.equal(next.model.remainingBudget, '3');
    assert.deepEqual(advanceAnchor(next, receipt), next);
    const second = routeAnchor(next);
    assert.equal(second.route, 'focused');
    assert.equal(second.plan.recommendedAction, 'locate_contract');
    assert.equal(second.plan.worstCaseCost, '3');
    const final = advanceAnchor(next, {
      action: 'locate_contract',
      outcome: scenario.outcomes.locate_contract,
      source: 'test',
    });
    const solved = routeAnchor(final);
    assert.equal(solved.route, 'direct');
    assert.equal(solved.plan.worstCaseCost, '0');
    assert.equal(final.model.remainingBudget, '0');
    assert.deepEqual(solved.plan.policy.nodes[0].answers, scenario.answers);
    for (const step of [initial, first, next, second, final, solved]) {
      assert.equal(step.anchor, brief.anchor);
    }
    assert.equal(initial.model.remainingBudget, '5');
    assert.equal(initial.model.observations.length, 0);
  }
});

test('read-only text cannot override gate, coverage, permissions or budget', () => {
  const cases = [
    ['gate', 'unknown', 'blocked', 'GATE_UNKNOWN'],
    ['gate', 'denied', 'blocked', 'GATE_DENIED'],
    ['coverage', 'incomplete', 'incomplete', 'INCOMPLETE_COVERAGE'],
    ['remainingBudget', '4', 'infeasible', 'NO_POLICY_WITHIN_BUDGET'],
  ];
  for (const [key, value, status, reason] of cases) {
    const brief = fixture();
    brief[key] = value;
    const result = routeAnchor(compileAnchor(brief));
    assert.deepEqual(
      [result.route, result.plan.status, result.plan.reason, result.plan.recommendedAction],
      ['abstain', status, reason, null],
    );
  }
  for (const permission of ['unknown', 'denied']) {
    const brief = fixture();
    brief.probes[0].permission = permission;
    const result = routeAnchor(compileAnchor(brief));
    assert.equal(result.plan.status, 'infeasible');
    assert.equal(result.route, 'abstain');
  }
});

test('contradictory evidence stops; limits withhold recommendation', () => {
  const state = compileAnchor(fixture());
  const limited = routeAnchor(state, { maxStates: 1 });
  assert.equal(limited.route, 'abstain');
  assert.equal(limited.plan.reason, 'MAX_STATES');
  assert.equal(limited.plan.policy, null);
  const next = advanceAnchor(state, {
    action: 'inspect_host',
    outcome: 'unmodeled',
    source: 'test',
  });
  const result = routeAnchor(next);
  assert.equal(result.route, 'abstain');
  assert.equal(result.plan.status, 'conflict');
  assert.equal(result.plan.recommendedAction, null);
  assert.equal(next.model.remainingBudget, '3');
  assert.equal(next.anchor, state.anchor);
});

test('rejects incomplete tables and malformed briefs without guessing', () => {
  const mutations = [
    (brief) => {
      delete brief.scenarios[0].outcomes.inspect_host;
    },
    (brief) => {
      brief.scenarios[0].outcomes.unexpected = 'x';
    },
    (brief) => {
      brief.scenarios.push(brief.scenarios[0]);
    },
    (brief) => {
      brief.probes.push(brief.probes[0]);
    },
    (brief) => {
      brief.probes[0].cost = 2;
    },
    (brief) => {
      brief.coverage = 'assumed';
    },
    (brief) => {
      brief.anchor = ' ';
    },
    (brief) => {
      brief.anchor = 'a'.repeat(32769);
    },
    (brief) => {
      brief.scenarios[0].answers.runtime = 'unmodeled';
    },
    (brief) => {
      brief.scenarios.length += 1;
    },
  ];
  for (const mutate of mutations) {
    const brief = fixture();
    mutate(brief);
    assert.throws(() => compileAnchor(brief), TypeError);
  }
});

test('rejects accessors at the adapter boundary without invoking them', () => {
  const brief = fixture();
  let calls = 0;
  Object.defineProperty(brief.scenarios[0].outcomes, 'inspect_host', {
    enumerable: true,
    get() {
      calls += 1;
      return 'native';
    },
  });
  assert.throws(() => compileAnchor(brief), TypeError);
  assert.equal(calls, 0);
});

test('cannot record an action that was not recommended', () => {
  const state = compileAnchor(fixture());
  assert.throws(
    () =>
      advanceAnchor(state, {
        action: 'locate_contract',
        outcome: 'local',
        source: 'test',
      }),
    TypeError,
  );
  assert.equal(state.model.remainingBudget, '5');
});

test('preserves exact cost above Number precision', () => {
  const brief = fixture();
  brief.scenarios = [brief.scenarios[0], brief.scenarios[3]];
  brief.probes[0].cost = '9007199254740993';
  brief.probes[1].cost = '9007199254740994';
  brief.remainingBudget = '9007199254740993';
  const state = compileAnchor(brief);
  const result = routeAnchor(state);
  assert.equal(result.route, 'focused');
  assert.equal(result.plan.worstCaseCost, '9007199254740993');
  assert.equal(result.plan.recommendedAction, 'inspect_host');
});
