import { type AnchorRouting, type AnchorState, advanceAnchor, routeAnchor } from './anchor.js';
import { type Gate, validate } from './core.js';
import type { PlanOptions, PlanReason, PlanResult } from './planner.js';

export interface HostContext {
  taskId: string;
  revision: string;
  anchor: string;
  gate: Gate;
}

export type FalpRequest =
  | { kind: 'ready'; context: HostContext; explorationRequested: boolean }
  | {
      kind: 'investigation';
      context: HostContext;
      classification: 'focused' | 'exploratory';
      explorationRequested: boolean;
      state: AnchorState;
    };
export type FalpInvestigation = Extract<FalpRequest, { kind: 'investigation' }>;
export type FalpReason =
  | PlanReason
  | 'HOST_GATE_DENIED'
  | 'HOST_GATE_UNKNOWN'
  | 'BRIEF_SUFFICIENT'
  | 'EXPLORATION_REQUESTED';

export interface FalpRouting {
  context: HostContext;
  route: 'direct' | 'focused' | 'exploratory';
  observationRoute: AnchorRouting['route'] | null;
  next: 'readback' | 'explore' | 'observe' | 'reassess' | 'blocked';
  explorationRequired: boolean;
  reason: FalpReason;
  plan: PlanResult | null;
}

export interface FalpDispatch {
  taskId: string;
  questionId: string;
  revision: string;
  anchor: string;
  action: string;
}
export type FalpReceipt = FalpDispatch &
  (
    | { status: 'SUPPORTED'; outcome: string; source: string }
    | { status: 'UNKNOWN' | 'CONFLICT' | 'BLOCKED'; source: string }
  );
export interface FalpReceiptResult {
  status: 'ACCEPTED' | 'DUPLICATE' | 'UNKNOWN' | 'CONFLICT' | 'BLOCKED';
  reason:
    | 'SUPPORTED'
    | 'DUPLICATE_RECEIPT'
    | 'UNKNOWN'
    | 'CONFLICT'
    | 'BLOCKED'
    | 'HOST_GATE_DENIED'
    | 'HOST_GATE_UNKNOWN'
    | 'GATE_DENIED'
    | 'GATE_UNKNOWN'
    | 'ACTION_DENIED'
    | 'ACTION_PERMISSION_UNKNOWN'
    | 'ACTION_UNAVAILABLE';
  request: FalpInvestigation;
  receipt: FalpReceipt;
}

function object(value: unknown, label: string): object {
  if (
    typeof value !== 'object' ||
    value === null ||
    Array.isArray(value) ||
    ![Object.prototype, null].includes(Object.getPrototypeOf(value))
  ) {
    throw new TypeError(label + ': expected plain JSON object');
  }
  return value;
}

function field(value: object, key: string, label: string): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  if (!descriptor?.enumerable || !('value' in descriptor)) {
    throw new TypeError(label + ': missing or non-data field ' + key);
  }
  return descriptor.value;
}

function record(value: unknown, keys: string[], label: string): Record<string, unknown> {
  const input = object(value, label);
  if (Reflect.ownKeys(input).length !== keys.length) {
    throw new TypeError(label + ': unexpected fields');
  }
  return Object.fromEntries(keys.map((key) => [key, field(input, key, label)]));
}

function text(value: unknown, label: string, maximum: number, canonical: boolean): string {
  if (
    typeof value !== 'string' ||
    !value.trim() ||
    value.length > maximum ||
    (canonical && value !== value.trim())
  ) {
    throw new TypeError(label + ': invalid text');
  }
  return value;
}

function identifier(value: unknown, label: string): string {
  const id = text(value, label, 256, true);
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_.:-]*$/.test(id)) {
    throw new TypeError(label + ': expected canonical ID');
  }
  return id;
}

function gate(value: unknown): Gate {
  if (value !== 'allowed' && value !== 'unknown' && value !== 'denied') {
    throw new TypeError('context.gate: invalid');
  }
  return value;
}

function request(raw: unknown): FalpRequest {
  const kind = field(object(raw, 'request'), 'kind', 'request');
  if (kind !== 'ready' && kind !== 'investigation') {
    throw new TypeError('request.kind: invalid');
  }
  const input = record(
    raw,
    kind === 'ready'
      ? ['kind', 'context', 'explorationRequested']
      : ['kind', 'context', 'classification', 'explorationRequested', 'state'],
    'request',
  );
  const supplied = record(input.context, ['taskId', 'revision', 'anchor', 'gate'], 'context');
  const context: HostContext = {
    taskId: identifier(supplied.taskId, 'context.taskId'),
    revision: identifier(supplied.revision, 'context.revision'),
    anchor: text(supplied.anchor, 'context.anchor', 32768, false),
    gate: gate(supplied.gate),
  };
  if (typeof input.explorationRequested !== 'boolean') {
    throw new TypeError('explorationRequested: expected boolean');
  }
  const explorationRequested = input.explorationRequested;
  if (kind === 'ready') return { kind, context, explorationRequested };
  if (input.classification !== 'focused' && input.classification !== 'exploratory') {
    throw new TypeError('classification: expected focused or exploratory');
  }
  const state = record(input.state, ['anchor', 'model'], 'state');
  if (state.anchor !== context.anchor) throw new TypeError('state.anchor: context mismatch');
  return {
    kind,
    context,
    explorationRequested,
    classification: input.classification,
    state: { anchor: context.anchor, model: validate(state.model) },
  };
}

function hostBlock(context: HostContext): 'HOST_GATE_DENIED' | 'HOST_GATE_UNKNOWN' | null {
  return context.gate === 'denied'
    ? 'HOST_GATE_DENIED'
    : context.gate === 'unknown'
      ? 'HOST_GATE_UNKNOWN'
      : null;
}

/** The host owns semantic classification. The next control never approves delivery. */
export function routeFalp(raw: unknown, options?: PlanOptions): FalpRouting {
  const input = request(raw);
  const route = input.kind === 'ready' ? 'direct' : input.classification;
  const base: Pick<FalpRouting, 'context' | 'route' | 'explorationRequired'> = {
    context: input.context,
    route,
    explorationRequired: input.kind === 'investigation' || input.explorationRequested,
  };
  const blocked = hostBlock(input.context);
  if (blocked) {
    return { ...base, observationRoute: null, next: 'blocked', reason: blocked, plan: null };
  }
  if (input.kind === 'ready') {
    return {
      ...base,
      observationRoute: null,
      next: input.explorationRequested ? 'explore' : 'readback',
      reason: input.explorationRequested ? 'EXPLORATION_REQUESTED' : 'BRIEF_SUFFICIENT',
      plan: null,
    };
  }
  const result = routeAnchor(input.state, options);
  return {
    ...base,
    observationRoute: result.route,
    next:
      result.plan.status === 'planned'
        ? 'observe'
        : result.plan.status === 'solved'
          ? 'reassess'
          : 'blocked',
    reason: result.plan.reason,
    plan: result.plan,
  };
}

const identityFields = ['taskId', 'questionId', 'revision', 'anchor', 'action'];

function identity(input: Record<string, unknown>): FalpDispatch {
  return {
    taskId: identifier(input.taskId, 'taskId'),
    questionId: identifier(input.questionId, 'questionId'),
    revision: identifier(input.revision, 'revision'),
    anchor: text(input.anchor, 'anchor', 32768, false),
    action: identifier(input.action, 'action'),
  };
}

function evidence(raw: unknown): FalpReceipt {
  const status = field(object(raw, 'receipt'), 'status', 'receipt');
  if (
    status !== 'SUPPORTED' &&
    status !== 'UNKNOWN' &&
    status !== 'CONFLICT' &&
    status !== 'BLOCKED'
  ) {
    throw new TypeError('receipt.status: invalid');
  }
  const input = record(
    raw,
    [...identityFields, 'status', 'source', ...(status === 'SUPPORTED' ? ['outcome'] : [])],
    'receipt',
  );
  const common = { ...identity(input), source: text(input.source, 'source', 256, true) };
  return status === 'SUPPORTED'
    ? { ...common, status, outcome: identifier(input.outcome, 'outcome') }
    : { ...common, status };
}

/** Matches a report to trusted host context; it does not authenticate the sender or execute tools. */
export function acceptFalpReceipt(
  raw: unknown,
  expectedDispatch: unknown,
  reported: unknown,
  options?: PlanOptions,
): FalpReceiptResult {
  const input = request(raw);
  if (input.kind !== 'investigation') throw new TypeError('Receipts require an investigation');
  const dispatch = identity(record(expectedDispatch, identityFields, 'dispatch'));
  const receipt = evidence(reported);
  for (const key of ['taskId', 'revision', 'anchor'] as const) {
    if (dispatch[key] !== input.context[key])
      throw new TypeError('dispatch context mismatch: ' + key);
  }
  for (const key of ['taskId', 'questionId', 'revision', 'anchor', 'action'] as const) {
    if (receipt[key] !== dispatch[key]) throw new TypeError('receipt identity mismatch: ' + key);
  }
  if (!input.state.model.decisions.some((item) => item.id === dispatch.questionId)) {
    throw new TypeError('dispatch.questionId: not modeled');
  }
  const action = input.state.model.actions.find((item) => item.id === dispatch.action);
  if (!action) throw new TypeError('dispatch.action: not modeled');
  const finish = (
    status: FalpReceiptResult['status'],
    reason: FalpReceiptResult['reason'],
    updated: FalpInvestigation = input,
  ): FalpReceiptResult => ({ status, reason, request: updated, receipt });
  const blocked =
    hostBlock(input.context) ??
    (input.state.model.gate === 'denied'
      ? 'GATE_DENIED'
      : input.state.model.gate === 'unknown'
        ? 'GATE_UNKNOWN'
        : action.permission === 'denied'
          ? 'ACTION_DENIED'
          : action.permission === 'unknown'
            ? 'ACTION_PERMISSION_UNKNOWN'
            : !action.available
              ? 'ACTION_UNAVAILABLE'
              : null);
  if (blocked) return finish('BLOCKED', blocked);
  if (receipt.status !== 'SUPPORTED') {
    const current = routeAnchor(input.state, options).plan;
    if (current.status !== 'planned' || current.recommendedAction !== receipt.action) {
      throw new TypeError('Report must match the current planned action');
    }
    return finish(receipt.status, receipt.status);
  }
  const observation = {
    action: receipt.action,
    outcome: receipt.outcome,
    source: receipt.source,
  };
  const duplicate = input.state.model.observations.some(
    (item) =>
      item.action === observation.action &&
      item.outcome === observation.outcome &&
      item.source === observation.source,
  );
  if (duplicate) return finish('DUPLICATE', 'DUPLICATE_RECEIPT');
  const state = advanceAnchor(input.state, observation, options);
  return finish('ACCEPTED', 'SUPPORTED', { ...input, state });
}
