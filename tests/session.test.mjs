import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { advance, plan, validate } from '../dist/index.js';

const fixture = () =>
  JSON.parse(readFileSync(new URL('../examples/parity3.json', import.meta.url), 'utf8'));
const receipt = (outcome = 'o0', source = 'test') => ({ action: 'signal_0', outcome, source });

test('complete session resolves all sixteen worlds without spending on noise', () => {
  const original = fixture();
  for (const world of original.worlds) {
    let input = structuredClone(original);
    const selected = [];
    let result = plan(input);
    while (result.status === 'planned') {
      const action = input.actions.find((item) => item.id === result.recommendedAction);
      selected.push(action.id);
      input = advance(input, {
        action: action.id,
        outcome: action.outcomes[world.id],
        source: 'test',
      });
      result = plan(input);
    }
    assert.equal(result.status, 'solved');
    assert.deepEqual(result.policy.nodes[0].answers, world.answers);
    assert.deepEqual(selected, ['signal_0', 'signal_1', 'signal_2']);
    assert.equal(input.remainingBudget, '0');
  }
});

test('receipt replay is idempotent and leaves the caller input unchanged', () => {
  const input = fixture();
  const before = JSON.stringify(input);
  const next = advance(input, receipt());
  assert.equal(next.remainingBudget, '4');
  assert.equal(next.observations.length, 1);
  assert.equal(JSON.stringify(input), before);
  assert.deepEqual(advance(next, receipt()), next);
  const later = advance(next, { action: 'signal_1', outcome: 'o1', source: 'test' });
  assert.deepEqual(advance(later, receipt()), later);
});

test('an existing exact receipt remains idempotent when multiple sources are present', () => {
  const next = advance(fixture(), receipt());
  next.observations.push(receipt('o0', 'second-source'));
  assert.deepEqual(advance(next, receipt()), validate(next));
  next.observations.push(receipt('o1', 'contradiction'));
  const retried = advance(next, receipt());
  assert.deepEqual(retried, validate(next));
  assert.equal(retried.remainingBudget, '4');
  assert.equal(plan(retried).status, 'conflict');
});

test('advance refuses unrelated actions, replaced receipts and invalid evidence', () => {
  const input = fixture();
  assert.throws(
    () => advance(input, { action: 'noise', outcome: 'o0', source: 'test' }),
    /current planned action/,
  );
  assert.throws(
    () => advance(input, { action: 'signal_1', outcome: 'o0', source: 'test' }),
    /current planned action/,
  );
  const next = advance(input, receipt());
  assert.throws(() => advance(next, receipt('o1')), /cannot be replaced/);
  assert.throws(() => advance(next, receipt('o0', 'another-source')), /cannot be replaced/);
  assert.throws(() => advance(input, { ...receipt(), extra: true }), /unexpected fields/);
  assert.throws(() => advance(input, { ...receipt(), source: '' }), /non-empty/);
});

test('unknown outcome is recorded and charged, then planning reports conflict', () => {
  const next = advance(fixture(), receipt('outside_model'));
  assert.equal(next.remainingBudget, '4');
  assert.deepEqual(next.observations, [receipt('outside_model')]);
  const result = plan(next);
  assert.equal(result.status, 'conflict');
  assert.equal(result.policy, null);
  assert.deepEqual(advance(next, receipt('outside_model')), next);
});

test('blocked, incomplete, unaffordable and interrupted states cannot advance', () => {
  for (const patch of [
    { gate: 'denied' },
    { gate: 'unknown' },
    { coverage: 'incomplete' },
    { remainingBudget: '5' },
  ]) {
    assert.throws(() => advance({ ...fixture(), ...patch }, receipt()), /current planned action/);
  }
  assert.throws(() => advance(fixture(), receipt(), { maxStates: 1 }), /current planned action/);
  const input = fixture();
  input.actions.find((item) => item.id === 'signal_0').permission = 'denied';
  assert.throws(() => advance(input, receipt()), /current planned action/);
});

test('session debits integers beyond binary floating-point precision exactly', () => {
  let input = fixture();
  for (const action of input.actions) if (action.id !== 'noise') action.cost = '9007199254740993';
  input.remainingBudget = '27021597764222979';
  input = advance(input, receipt());
  assert.equal(input.remainingBudget, '18014398509481986');
  assert.equal(plan(input).worstCaseCost, '18014398509481986');
  assert.deepEqual(validate(JSON.parse(JSON.stringify(input))), input);
});

function priorEvidence(input, count) {
  input.actions.push({
    id: 'prior',
    capability: 'evidence',
    permission: 'allowed',
    available: true,
    cost: '1',
    outcomes: Object.fromEntries(input.worlds.map((world) => [world.id, 'same'])),
  });
  input.observations = Array.from({ length: count }, (_, i) => ({
    action: 'prior',
    outcome: 'same',
    source: `source-${i}`,
  }));
  return input;
}

test('a full observation ledger withholds a recommendation before an external action', () => {
  const input = priorEvidence(fixture(), 512);
  const result = plan(input);
  assert.equal(result.status, 'limit_exceeded');
  assert.equal(result.reason, 'MAX_OBSERVATIONS');
  assert.equal(result.recommendedAction, null);
  assert.equal(result.policy, null);
  assert.equal(result.worstCaseCost, null);
  assert.throws(() => advance(input, receipt()), /current planned action/);
  assert.deepEqual(advance(input, input.observations[0]), validate(input));
});

test('a complete policy fits the ledger exactly and all its observations can be recorded', () => {
  let input = priorEvidence(fixture(), 509);
  assert.equal(plan(input).status, 'planned');
  for (let bit = 0; bit < 3; bit++) {
    input = advance(input, { action: `signal_${bit}`, outcome: 'o0', source: 'fresh' });
  }
  assert.equal(input.observations.length, 512);
  assert.equal(input.remainingBudget, '0');
  assert.equal(plan(input).status, 'solved');
});

test('ledger capacity checks the whole selected policy, withholds even if a costlier short plan exists', () => {
  const input = priorEvidence(fixture(), 510);
  input.remainingBudget = '7';
  input.actions.push({
    id: 'direct',
    capability: 'evidence',
    permission: 'allowed',
    available: true,
    cost: '7',
    outcomes: Object.fromEntries(input.worlds.map((world) => [world.id, world.answers.q])),
  });
  const result = plan(input);
  assert.equal(result.status, 'limit_exceeded');
  assert.equal(result.reason, 'MAX_OBSERVATIONS');
  assert.equal(result.recommendedAction, null);
  input.actions = input.actions.filter((action) => action.id === 'prior' || action.id === 'direct');
  const shorter = plan(input);
  assert.equal(shorter.status, 'planned');
  assert.equal(shorter.worstCaseCost, '7');
});
