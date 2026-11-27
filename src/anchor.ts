import { type Action, INPUT_LIMITS, type Input, validate } from './core.js';
import { type PlanOptions, type PlanResult, plan } from './planner.js';
import { advance } from './session.js';

export type AnchorBrief = Pick<
  Input,
  'coverage' | 'gate' | 'costUnit' | 'remainingBudget' | 'observations'
> & {
  anchor: string;
  questions: Input['decisions'];
  probes: Omit<Action, 'outcomes'>[];
  scenarios: { id: string; answers: Record<string, string>; outcomes: Record<string, string> }[];
};

export interface AnchorState {
  readonly anchor: string;
  readonly model: Input;
}

export interface AnchorRouting {
  anchor: string;
  route: 'direct' | 'focused' | 'exploratory' | 'abstain';
  plan: PlanResult;
}

function record(value: unknown, keys: string[], label: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new TypeError(label + ': expected JSON object');
  }
  if (![Object.prototype, null].includes(Object.getPrototypeOf(value))) {
    throw new TypeError(label + ': expected plain object');
  }
  const entries = Reflect.ownKeys(value);
  if (entries.length !== keys.length) throw new TypeError(label + ': unexpected fields');
  const pairs = keys.map((key) => {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor?.enumerable || !('value' in descriptor)) {
      throw new TypeError(label + ': missing or non-data field ' + key);
    }
    return [key, descriptor.value];
  });
  return Object.fromEntries(pairs);
}

function rows(value: unknown, maximum: number, label: string): unknown[] {
  if (
    !Array.isArray(value) ||
    value.length > maximum ||
    Object.getPrototypeOf(value) !== Array.prototype
  ) {
    throw new TypeError(label + ': expected bounded JSON array');
  }
  if (Reflect.ownKeys(value).length !== value.length + 1) {
    throw new TypeError(label + ': unexpected array fields');
  }
  return Array.from({ length: value.length }, (_, index) => {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (!descriptor?.enumerable || !('value' in descriptor)) {
      throw new TypeError(label + ': expected data element');
    }
    return descriptor.value;
  });
}

function anchorText(value: unknown): string {
  if (typeof value !== 'string' || value.length > 32768 || !value.trim()) {
    throw new TypeError('anchor: expected nonblank text of at most 32768 code units');
  }
  return value;
}

function identifier(value: unknown): string {
  if (
    typeof value !== 'string' ||
    value.length > 256 ||
    !/^[a-zA-Z0-9][a-zA-Z0-9_.:-]*$/.test(value)
  ) {
    throw new TypeError('expected canonical ID');
  }
  return value;
}

/** Transpose declared scenario rows. Never infer completeness or permissions from the anchor. */
export function compileAnchor(raw: unknown): AnchorState {
  const brief = record(
    raw,
    [
      'anchor',
      'coverage',
      'gate',
      'costUnit',
      'remainingBudget',
      'questions',
      'probes',
      'scenarios',
      'observations',
    ],
    'brief',
  );
  const anchor = anchorText(brief.anchor);
  const probes = rows(brief.probes, INPUT_LIMITS.actions, 'probes').map((value) => {
    const probe = record(value, ['id', 'capability', 'permission', 'available', 'cost'], 'probe');
    return { ...probe, id: identifier(probe.id) };
  });
  const probeIds = probes.map((probe) => probe.id);
  const scenarios = rows(brief.scenarios, INPUT_LIMITS.worlds, 'scenarios').map((value) => {
    const scenario = record(value, ['id', 'answers', 'outcomes'], 'scenario');
    return {
      id: identifier(scenario.id),
      answers: scenario.answers,
      outcomes: record(scenario.outcomes, probeIds, 'scenario.outcomes'),
    };
  });
  const model = validate({
    coverage: brief.coverage,
    gate: brief.gate,
    costUnit: brief.costUnit,
    remainingBudget: brief.remainingBudget,
    decisions: brief.questions,
    worlds: scenarios.map(({ id, answers }) => ({ id, answers })),
    actions: probes.map((probe) => ({
      ...probe,
      outcomes: Object.fromEntries(
        scenarios.map((scenario) => [scenario.id, scenario.outcomes[probe.id]]),
      ),
    })),
    observations: brief.observations,
  });
  return { anchor, model };
}

/** Routes classify the selected observation policy, not semantic prompt readiness. */
export function routeAnchor(raw: unknown, options?: PlanOptions): AnchorRouting {
  const state = record(raw, ['anchor', 'model'], 'state');
  const anchor = anchorText(state.anchor);
  const result = plan(state.model, options);
  if (result.status === 'solved') return { anchor, route: 'direct', plan: result };
  if (result.status !== 'planned') return { anchor, route: 'abstain', plan: result };
  if (!result.policy) throw new Error('planned result has no policy');
  const nodes = new Map(result.policy.nodes.map((node) => [node.id, node]));
  const root = nodes.get(result.policy.root);
  if (root?.type !== 'decision') throw new Error('planned result has no decision root');
  const focused = root.branches.every((branch) => nodes.get(branch.child)?.type === 'leaf');
  return { anchor, route: focused ? 'focused' : 'exploratory', plan: result };
}

export function advanceAnchor(
  raw: unknown,
  observation: unknown,
  options?: PlanOptions,
): AnchorState {
  const state = record(raw, ['anchor', 'model'], 'state');
  const anchor = anchorText(state.anchor);
  return { anchor, model: advance(state.model, observation, options) };
}
