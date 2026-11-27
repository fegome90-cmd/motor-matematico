import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import * as motor from '../dist/index.js';

const { compileAnchor, routeFalp, acceptFalpReceipt } = motor;
const fixture = () =>
  JSON.parse(readFileSync(new URL('../examples/anchor-routing.json', import.meta.url), 'utf8'));
const context = (anchor = 'Conservar alcance y permisos.\r\n') => ({
  taskId: 'audit-17',
  revision: 'rev-1',
  anchor,
  gate: 'allowed',
});
const ready = () => ({ kind: 'ready', context: context(), explorationRequested: false });
const investigation = (brief = fixture(), classification = 'focused') => ({
  kind: 'investigation',
  context: context(brief.anchor),
  classification,
  explorationRequested: false,
  state: compileAnchor(brief),
});
const dispatch = (request, action = 'inspect_host', questionId = 'runtime') => ({
  taskId: request.context.taskId,
  revision: request.context.revision,
  anchor: request.context.anchor,
  questionId,
  action,
});
const receipt = (sent, outcome = 'native') => ({
  ...sent,
  status: 'SUPPORTED',
  outcome,
  source: 'host-observation',
});
const freeze = (value) => {
  if (value && typeof value === 'object') {
    for (const item of Object.values(value)) freeze(item);
    Object.freeze(value);
  }
  return value;
};

test('FALP ready reaches readback without a fabricated question or plan', () => {
  const input = freeze(ready());
  const output = routeFalp(input);
  assert.deepEqual(output, {
    context: input.context,
    route: 'direct',
    observationRoute: null,
    next: 'readback',
    explorationRequired: false,
    reason: 'BRIEF_SUFFICIENT',
    plan: null,
  });
});

test('explicit exploration activates the module even for a sufficient brief', () => {
  const output = routeFalp({ ...ready(), explorationRequested: true });
  assert.deepEqual(
    [output.route, output.next, output.explorationRequired, output.reason, output.plan],
    ['direct', 'explore', true, 'EXPLORATION_REQUESTED', null],
  );
});

test('one concrete question remains focused when it requires two observations', () => {
  const brief = fixture();
  brief.questions = [{ id: 'relation', domain: ['same', 'different'] }];
  brief.scenarios = brief.scenarios.map((scenario, i) => ({
    ...scenario,
    answers: { relation: i === 0 || i === 3 ? 'same' : 'different' },
  }));
  const output = routeFalp(investigation(brief));
  assert.deepEqual(
    [output.route, output.observationRoute, output.next, output.plan.worstCaseCost],
    ['focused', 'exploratory', 'observe', '5'],
  );
  assert.equal(output.plan.recommendedAction, 'inspect_host');
});

test('an exploratory framing remains exploratory with a one-observation policy', () => {
  const brief = fixture();
  brief.scenarios = [brief.scenarios[0], brief.scenarios[3]];
  const output = routeFalp(investigation(brief, 'exploratory'));
  assert.deepEqual(
    [output.route, output.observationRoute, output.next, output.plan.worstCaseCost],
    ['exploratory', 'focused', 'observe', '2'],
  );
});

test('a mathematically solved investigation requires host reassessment', () => {
  const brief = fixture();
  brief.scenarios = [brief.scenarios[0]];
  for (const classification of ['focused', 'exploratory']) {
    const output = routeFalp(investigation(brief, classification));
    assert.equal(output.route, classification);
    assert.equal(output.next, 'reassess');
    assert.equal(output.plan.status, 'solved');
    assert.equal(output.plan.recommendedAction, null);
  }
});

test('host gates block ready and investigation without publishing a plan', () => {
  for (const make of [ready, investigation]) {
    for (const [gate, reason] of [
      ['unknown', 'HOST_GATE_UNKNOWN'],
      ['denied', 'HOST_GATE_DENIED'],
    ]) {
      const input = make();
      input.context.gate = gate;
      const output = routeFalp(input);
      assert.equal(output.next, 'blocked');
      assert.equal(output.reason, reason);
      assert.equal(output.plan, null);
      assert.equal(output.observationRoute, null);
    }
  }
});

test('model blocking states retain their exact reason without an executable fallback', () => {
  const cases = [
    [
      (x) => {
        x.gate = 'unknown';
      },
      undefined,
      'blocked',
      'GATE_UNKNOWN',
    ],
    [
      (x) => {
        x.gate = 'denied';
      },
      undefined,
      'blocked',
      'GATE_DENIED',
    ],
    [
      (x) => {
        x.coverage = 'incomplete';
      },
      undefined,
      'incomplete',
      'INCOMPLETE_COVERAGE',
    ],
    [
      (x) => {
        x.remainingBudget = '4';
      },
      undefined,
      'infeasible',
      'NO_POLICY_WITHIN_BUDGET',
    ],
    [
      (x) => {
        x.observations = [{ action: 'inspect_host', outcome: 'missing', source: 'test' }];
      },
      undefined,
      'conflict',
      'CONFLICT',
    ],
    [() => {}, { maxStates: 1 }, 'limit_exceeded', 'MAX_STATES'],
  ];
  for (const [mutate, options, status, reason] of cases) {
    const brief = fixture();
    mutate(brief);
    const output = routeFalp(investigation(brief), options);
    assert.equal(output.route, 'focused');
    assert.equal(output.next, 'blocked');
    assert.equal(output.reason, reason);
    assert.equal(output.observationRoute, 'abstain');
    assert.equal(output.plan.status, status);
    assert.deepEqual(
      [output.plan.recommendedAction, output.plan.worstCaseCost, output.plan.policy],
      [null, null, null],
    );
  }
});

test('supported receipts advance only the matching context and preserve inputs', () => {
  const input = freeze(investigation());
  const sent = freeze(dispatch(input));
  const received = freeze(receipt(sent));
  const result = acceptFalpReceipt(input, sent, received);
  assert.equal(result.status, 'ACCEPTED');
  assert.equal(result.reason, 'SUPPORTED');
  assert.equal(result.request.state.model.remainingBudget, '3');
  assert.deepEqual(result.request.state.model.observations, [
    { action: 'inspect_host', outcome: 'native', source: 'host-observation' },
  ]);
  assert.equal(input.state.model.remainingBudget, '5');
  assert.deepEqual(input.state.model.observations, []);
  assert.equal(routeFalp(result.request).plan.recommendedAction, 'locate_contract');
  assert.equal(JSON.parse(JSON.stringify(result)).receipt.status, 'SUPPORTED');
});

test('receipts from another task, revision, anchor, question or action are rejected', () => {
  const input = investigation();
  const sent = dispatch(input);
  for (const [key, value] of [
    ['taskId', 'another-task'],
    ['revision', 'rev-2'],
    ['anchor', `${input.context.anchor} changed`],
    ['questionId', 'contract'],
    ['action', 'locate_contract'],
  ]) {
    assert.throws(
      () => acceptFalpReceipt(input, sent, { ...receipt(sent), [key]: value }),
      TypeError,
    );
    assert.throws(
      () => acceptFalpReceipt(input, { ...sent, [key]: value }, receipt(sent)),
      TypeError,
    );
    if (['taskId', 'revision', 'anchor'].includes(key)) {
      const stale = { ...sent, [key]: value };
      assert.throws(
        () => acceptFalpReceipt(input, stale, receipt(stale)),
        new RegExp('dispatch context mismatch: ' + key),
      );
    }
  }
  assert.equal(input.state.model.remainingBudget, '5');
  assert.deepEqual(input.state.model.observations, []);
  assert.equal(acceptFalpReceipt(input, sent, receipt(sent)).status, 'ACCEPTED');
});

test('dispatches must name a modeled question and the currently recommended action', () => {
  const input = investigation();
  const accepted = acceptFalpReceipt(input, dispatch(input), receipt(dispatch(input)));
  assert.equal(accepted.status, 'ACCEPTED');
  assert.equal(accepted.request.state.model.remainingBudget, '3');
  for (const [sent, error] of [
    [dispatch(input, 'inspect_host', 'absent'), /dispatch.questionId: not modeled/],
    [dispatch(input, 'absent', 'runtime'), /dispatch.action: not modeled/],
    [dispatch(input, 'locate_contract', 'contract'), /current planned action/],
  ]) {
    assert.throws(() => acceptFalpReceipt(input, sent, receipt(sent, 'local')), error);
  }
  assert.equal(input.state.model.remainingBudget, '5');
});

test('UNKNOWN, CONFLICT and BLOCKED remain distinct without inventing an outcome or charge', () => {
  const input = freeze(investigation());
  const sent = dispatch(input);
  for (const status of ['UNKNOWN', 'CONFLICT', 'BLOCKED']) {
    const received = { ...sent, status, source: 'worker-report' };
    const result = acceptFalpReceipt(input, sent, received);
    assert.equal(result.status, status);
    assert.equal(result.reason, status);
    assert.equal(result.request.state.model.remainingBudget, '5');
    assert.deepEqual(result.request.state.model.observations, []);
    assert.deepEqual(result.request, input);
    assert.deepEqual(result.receipt, received);
    assert.throws(
      () => acceptFalpReceipt(input, sent, { ...received, outcome: 'native' }),
      TypeError,
    );
  }
});

test('a matching replay is idempotent but another revision cannot reuse it', () => {
  const input = investigation();
  const sent = dispatch(input);
  const observed = receipt(sent);
  const next = acceptFalpReceipt(input, sent, observed).request;
  const duplicate = acceptFalpReceipt(next, sent, observed);
  assert.equal(duplicate.status, 'DUPLICATE');
  assert.equal(duplicate.reason, 'DUPLICATE_RECEIPT');
  assert.equal(duplicate.request.state.model.remainingBudget, '3');
  assert.deepEqual(duplicate.request, next);
  const revised = structuredClone(next);
  revised.context.revision = 'rev-2';
  assert.throws(() => acceptFalpReceipt(revised, sent, observed), TypeError);
});

test('revoked gates, permission and availability block supported receipts before charging', () => {
  const cases = [
    [
      (x) => {
        x.context.gate = 'denied';
      },
      'HOST_GATE_DENIED',
    ],
    [
      (x) => {
        x.context.gate = 'unknown';
      },
      'HOST_GATE_UNKNOWN',
    ],
    [
      (x) => {
        x.state.model.gate = 'denied';
      },
      'GATE_DENIED',
    ],
    [
      (x) => {
        x.state.model.gate = 'unknown';
      },
      'GATE_UNKNOWN',
    ],
    [
      (x) => {
        x.state.model.actions.find((a) => a.id === 'inspect_host').permission = 'denied';
      },
      'ACTION_DENIED',
    ],
    [
      (x) => {
        x.state.model.actions.find((a) => a.id === 'inspect_host').permission = 'unknown';
      },
      'ACTION_PERMISSION_UNKNOWN',
    ],
    [
      (x) => {
        x.state.model.actions.find((a) => a.id === 'inspect_host').available = false;
      },
      'ACTION_UNAVAILABLE',
    ],
  ];
  for (const [mutate, reason] of cases) {
    const input = investigation();
    const sent = dispatch(input);
    const observed = acceptFalpReceipt(input, sent, receipt(sent)).request;
    mutate(input);
    const result = acceptFalpReceipt(input, sent, receipt(sent));
    assert.equal(result.status, 'BLOCKED');
    assert.equal(result.reason, reason);
    assert.equal(result.request.state.model.remainingBudget, '5');
    assert.deepEqual(result.request.state.model.observations, []);
    assert.deepEqual(result.request, input);
    mutate(observed);
    const replay = acceptFalpReceipt(observed, sent, receipt(sent));
    assert.equal(replay.status, 'BLOCKED');
    assert.equal(replay.reason, reason);
    assert.equal(replay.request.state.model.remainingBudget, '3');
    assert.deepEqual(replay.request, observed);
  }
});

test('new evidence cannot replace an observed action or bypass a lower current budget', () => {
  const input = investigation();
  const sent = dispatch(input);
  const next = acceptFalpReceipt(input, sent, receipt(sent)).request;
  assert.throws(() => acceptFalpReceipt(next, sent, receipt(sent, 'direct')), TypeError);
  input.state.model.remainingBudget = '1';
  assert.throws(() => acceptFalpReceipt(input, sent, receipt(sent)), TypeError);
  assert.equal(input.state.model.remainingBudget, '1');
});

test('an unmodeled supported result is recorded and then exposes conflict', () => {
  const input = investigation();
  const sent = dispatch(input);
  const result = acceptFalpReceipt(input, sent, receipt(sent, 'unexpected'));
  assert.equal(result.status, 'ACCEPTED');
  assert.equal(result.request.state.model.remainingBudget, '3');
  const routed = routeFalp(result.request);
  assert.deepEqual(
    [routed.next, routed.reason, routed.plan.status],
    ['blocked', 'CONFLICT', 'conflict'],
  );
});

test('exact anchors survive CRLF, exterior spaces and both Unicode forms', () => {
  for (const anchor of ['  Ancla\r\nCafé\n  ', '  Ancla\r\nCafe\u0301\n  ']) {
    const brief = fixture();
    brief.anchor = anchor;
    const input = investigation(brief);
    const sent = dispatch(input);
    const next = acceptFalpReceipt(input, sent, receipt(sent)).request;
    assert.equal(routeFalp(input).context.anchor, anchor);
    assert.equal(next.context.anchor, anchor);
    assert.equal(next.state.anchor, anchor);
    assert.throws(
      () => acceptFalpReceipt(input, sent, { ...receipt(sent), anchor: anchor.trim() }),
      TypeError,
    );
  }
  const input = investigation();
  input.state.anchor += '\n';
  assert.throws(() => routeFalp(input), TypeError);
});

test('a full receipt sequence retains costs above Number precision', () => {
  const brief = fixture();
  brief.probes[0].cost = '9007199254740993';
  brief.probes[1].cost = '9007199254740994';
  brief.remainingBudget = '18014398509481987';
  const input = investigation(brief);
  assert.equal(routeFalp(input).plan.worstCaseCost, '18014398509481987');
  const sent = dispatch(input);
  const afterFirst = acceptFalpReceipt(input, sent, receipt(sent)).request;
  assert.equal(afterFirst.state.model.remainingBudget, '9007199254740994');
  const second = dispatch(afterFirst, 'locate_contract', 'contract');
  const final = acceptFalpReceipt(afterFirst, second, receipt(second, 'local')).request;
  assert.equal(final.state.model.remainingBudget, '0');
  assert.equal(routeFalp(final).next, 'reassess');
  assert.deepEqual(routeFalp(final).plan.policy.nodes[0].answers, {
    contract: 'local',
    runtime: 'native',
  });
});

test('strict boundaries reject malformed variants, receipt schemas and non-data properties', () => {
  assert.equal(routeFalp(ready()).next, 'readback');
  const malformed = [
    { ...ready(), kind: 'guess' },
    { ...ready(), explorationRequested: 'yes' },
    { ...ready(), state: {} },
    { ...ready(), context: { ...context(), taskId: 'two words' } },
    { ...ready(), context: { ...context(), revision: '' } },
    { ...ready(), context: { ...context(), anchor: ' ' } },
    { ...ready(), context: { ...context(), gate: 'inferred' } },
    { ...investigation(), classification: 'direct' },
    { ...investigation(), unexpected: true },
  ];
  for (const value of malformed) assert.throws(() => routeFalp(value), TypeError);
  const input = investigation();
  const sent = dispatch(input);
  assert.equal(acceptFalpReceipt(input, sent, receipt(sent)).status, 'ACCEPTED');
  for (const received of [
    { ...sent, status: 'SUPPORTED', source: 'test' },
    { ...receipt(sent), status: 'MAYBE' },
    { ...receipt(sent), extra: true },
    { ...receipt(sent), outcome: 1 },
    { ...receipt(sent), source: ' ' },
  ])
    assert.throws(() => acceptFalpReceipt(input, sent, received), TypeError);
  assert.throws(() => acceptFalpReceipt(ready(), sent, receipt(sent)), TypeError);
  let calls = 0;
  const accessor = ready();
  Object.defineProperty(accessor.context, 'anchor', {
    enumerable: true,
    get() {
      calls++;
      return 'changed';
    },
  });
  assert.throws(() => routeFalp(accessor), TypeError);
  const badReceipt = receipt(sent);
  Object.defineProperty(badReceipt, 'outcome', {
    enumerable: true,
    get() {
      calls++;
      return 'native';
    },
  });
  assert.throws(() => acceptFalpReceipt(input, sent, badReceipt), TypeError);
  assert.equal(calls, 0);
});
