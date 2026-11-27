import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { acceptFalpReceipt, compileAnchor, routeFalp } from '../dist/index.js';

const fixture = () =>
  JSON.parse(readFileSync(new URL('../examples/anchor-routing.json', import.meta.url), 'utf8'));
const request = (brief = fixture()) => ({
  kind: 'investigation',
  context: { taskId: 'review', revision: 'r1', anchor: brief.anchor, gate: 'allowed' },
  classification: 'focused',
  explorationRequested: false,
  state: compileAnchor(brief),
});
const dispatch = (input, action = 'inspect_host', questionId = 'runtime') => ({
  taskId: input.context.taskId,
  revision: input.context.revision,
  anchor: input.context.anchor,
  action,
  questionId,
});
const supported = (sent, outcome = 'native') => ({
  ...sent,
  status: 'SUPPORTED',
  outcome,
  source: 'independent-review',
});

test('inconclusive reports cannot bypass current planning or erase a detected revocation', () => {
  for (const status of ['UNKNOWN', 'CONFLICT', 'BLOCKED']) {
    const initial = request();
    const sent = dispatch(initial);
    const report = { ...sent, status, source: 'independent-review' };
    const afterFirst = acceptFalpReceipt(initial, sent, supported(sent)).request;
    assert.throws(() => acceptFalpReceipt(afterFirst, sent, report), /current planned action/);
    assert.throws(
      () => acceptFalpReceipt(initial, sent, report, { maxStates: 1 }),
      /current planned action/,
    );
    initial.context.gate = 'denied';
    const blocked = acceptFalpReceipt(initial, sent, report, { maxStates: 1 });
    assert.deepEqual(
      [blocked.status, blocked.reason, blocked.receipt.status],
      ['BLOCKED', 'HOST_GATE_DENIED', status],
    );
    assert.deepEqual(blocked.request, initial);
    assert.equal(blocked.request.state.model.remainingBudget, '5');
    assert.deepEqual(blocked.request.state.model.observations, []);
  }
});

test('FALP retains whole-policy ledger limits, exact-capacity completion and replay at zero budget', () => {
  const brief = fixture();
  brief.observations = Array.from({ length: 511 }, (_, i) => ({
    action: 'noise',
    outcome: 'same',
    source: `prior-${i}`,
  }));
  const limited = request(brief);
  const sent = dispatch(limited);
  const routed = routeFalp(limited);
  assert.deepEqual(
    [
      routed.next,
      routed.reason,
      routed.plan.recommendedAction,
      routed.plan.worstCaseCost,
      routed.plan.policy,
    ],
    ['blocked', 'MAX_OBSERVATIONS', null, null, null],
  );
  assert.throws(() => acceptFalpReceipt(limited, sent, supported(sent)), /current planned action/);
  assert.equal(limited.state.model.remainingBudget, '5');
  brief.observations.pop();
  let current = request(brief);
  assert.equal(routeFalp(current).next, 'observe');
  for (const [action, questionId, outcome] of [
    ['inspect_host', 'runtime', 'native'],
    ['locate_contract', 'contract', 'local'],
  ]) {
    const active = dispatch(current, action, questionId);
    current = acceptFalpReceipt(current, active, supported(active, outcome)).request;
  }
  assert.equal(current.state.model.observations.length, 512);
  assert.equal(current.state.model.remainingBudget, '0');
  assert.equal(routeFalp(current).next, 'reassess');
  const replay = acceptFalpReceipt(current, sent, supported(sent));
  assert.equal(replay.status, 'DUPLICATE');
  assert.deepEqual(replay.request, current);
  current.state.model.actions.find((item) => item.id === sent.action).permission = 'denied';
  const revoked = acceptFalpReceipt(current, sent, supported(sent));
  assert.deepEqual(
    [revoked.status, revoked.reason, revoked.request.state.model.remainingBudget],
    ['BLOCKED', 'ACTION_DENIED', '0'],
  );
  assert.equal(revoked.request.state.model.observations.length, 512);
});

test('128-digit action cost preserves the unit boundary without Number conversion', () => {
  const brief = fixture();
  brief.scenarios = [brief.scenarios[0], brief.scenarios[3]];
  brief.probes[1].permission = 'denied';
  const maximum = '9'.repeat(128);
  brief.probes[0].cost = maximum;
  brief.remainingBudget = maximum;
  const current = request(brief);
  assert.equal(routeFalp(current).plan.worstCaseCost, maximum);
  const sent = dispatch(current);
  const done = acceptFalpReceipt(current, sent, supported(sent)).request;
  assert.equal(done.state.model.remainingBudget, '0');
  assert.equal(routeFalp(done).next, 'reassess');
  assert.equal(done.context.anchor, brief.anchor);
  brief.remainingBudget = (BigInt(maximum) - 1n).toString();
  const short = request(brief);
  assert.deepEqual(
    [routeFalp(short).next, routeFalp(short).reason],
    ['blocked', 'NO_POLICY_WITHIN_BUDGET'],
  );
  assert.throws(
    () => acceptFalpReceipt(short, dispatch(short), supported(dispatch(short))),
    /current planned action/,
  );
  assert.equal(short.state.model.remainingBudget, brief.remainingBudget);
});
