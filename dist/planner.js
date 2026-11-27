import { INPUT_LIMITS, validate } from './core.js';
export const DEFAULT_PLAN_LIMITS = Object.freeze({
    maxWorlds: 128,
    maxActions: 32,
    maxStates: 20000,
    maxTransitions: 500000,
    maxDepth: 32,
    maxMillis: 1000,
});
export const PLAN_LIMIT_CEILINGS = Object.freeze({
    maxWorlds: 512,
    maxActions: 64,
    maxStates: 200000,
    maxTransitions: 2000000,
    maxDepth: 64,
    maxMillis: 10000,
});
function options(raw) {
    const limits = { ...DEFAULT_PLAN_LIMITS };
    if (raw === undefined)
        return limits;
    if (typeof raw !== 'object' ||
        raw === null ||
        Array.isArray(raw) ||
        ![Object.prototype, null].includes(Object.getPrototypeOf(raw))) {
        throw new TypeError('options: expected plain object');
    }
    for (const key of Reflect.ownKeys(raw)) {
        const descriptor = Object.getOwnPropertyDescriptor(raw, key);
        if (typeof key !== 'string' ||
            !Object.hasOwn(limits, key) ||
            !descriptor.enumerable ||
            !('value' in descriptor)) {
            throw new TypeError('options: unexpected field or non-data property');
        }
        const name = key;
        const value = descriptor.value;
        if (typeof value !== 'number' ||
            !Number.isSafeInteger(value) ||
            value < (name === 'maxDepth' ? 0 : 1) ||
            value > PLAN_LIMIT_CEILINGS[name]) {
            throw new TypeError(`options.${name}: integer outside supported range`);
        }
        limits[name] = value;
    }
    return limits;
}
class SearchLimit extends Error {
    reason;
    constructor(reason) {
        super(reason);
        this.reason = reason;
    }
}
const compare = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
/** Exact minimax planning for the supplied finite model. Limits return no partial policy. */
export function plan(raw, configuration) {
    const limits = options(configuration);
    const input = validate(raw);
    const started = performance.now();
    const actionById = new Map(input.actions.map((action) => [action.id, action]));
    const worlds = input.worlds.filter((world) => input.observations.every((observation) => actionById.get(observation.action).outcomes[world.id] === observation.outcome));
    const signatures = worlds.map((world) => JSON.stringify(input.decisions.map((decision) => world.answers[decision.id])));
    const signatureCount = new Set(signatures).size;
    const budget = BigInt(input.remainingBudget);
    const actions = input.actions.filter((action) => action.permission === 'allowed' && action.available && BigInt(action.cost) <= budget);
    const statistics = {
        worlds: input.worlds.length,
        compatibleWorlds: worlds.length,
        signatures: signatureCount,
        actions: input.actions.length,
        admissibleActions: actions.length,
        states: 0,
        cacheHits: 0,
        transitions: 0,
        maxDepth: 0,
        policyNodes: 0,
    };
    const finish = (status, reason, policy = null, cost = null, recommendedAction = null) => ({
        status,
        reason,
        recommendedAction,
        worstCaseCost: cost === null ? null : String(cost),
        policy,
        coverage: input.coverage,
        gate: input.gate,
        costUnit: input.costUnit,
        remainingBudget: input.remainingBudget,
        statistics,
        limits,
    });
    if (input.coverage === 'complete' && signatureCount === 0)
        return finish('conflict', 'CONFLICT');
    if (input.gate === 'denied')
        return finish('blocked', 'GATE_DENIED');
    if (input.gate === 'unknown')
        return finish('blocked', 'GATE_UNKNOWN');
    if (input.coverage === 'incomplete')
        return finish('incomplete', 'INCOMPLETE_COVERAGE');
    if (signatureCount === 1) {
        statistics.policyNodes = 1;
        return finish('solved', 'SUFFICIENT', { root: 'n0', nodes: [{ id: 'n0', type: 'leaf', answers: { ...worlds[0].answers } }] }, 0n);
    }
    if (worlds.length > limits.maxWorlds)
        return finish('limit_exceeded', 'MAX_WORLDS');
    if (actions.length > limits.maxActions)
        return finish('limit_exceeded', 'MAX_ACTIONS');
    const checkTime = () => {
        if (performance.now() - started >= limits.maxMillis)
            throw new SearchLimit('MAX_MILLIS');
    };
    try {
        checkTime();
        const signaturesByBit = new Map();
        const signatureMasks = new Map();
        const answersBySignature = new Map();
        const worldBits = worlds.map((world, index) => {
            const bit = 1n << BigInt(index);
            const signature = signatures[index];
            signaturesByBit.set(bit, signature);
            signatureMasks.set(signature, (signatureMasks.get(signature) ?? 0n) | bit);
            answersBySignature.set(signature, world.answers);
            return { world, bit };
        });
        const prepared = actions.map((action) => {
            checkTime();
            const groups = new Map();
            for (const { world, bit } of worldBits) {
                const outcome = action.outcomes[world.id];
                groups.set(outcome, (groups.get(outcome) ?? 0n) | bit);
            }
            return {
                id: action.id,
                cost: BigInt(action.cost),
                branches: [...groups]
                    .sort(([a], [b]) => compare(a, b))
                    .map(([outcome, mask]) => ({ outcome, mask })),
            };
        });
        const memo = new Map();
        const solve = (mask, depth) => {
            checkTime();
            if (depth > limits.maxDepth)
                throw new SearchLimit('MAX_DEPTH');
            const cached = memo.get(mask);
            if (cached !== undefined) {
                if (depth + cached.searchHeight > limits.maxDepth)
                    throw new SearchLimit('MAX_DEPTH');
                statistics.cacheHits++;
                statistics.maxDepth = Math.max(statistics.maxDepth, depth + cached.searchHeight);
                return cached;
            }
            if (statistics.states >= limits.maxStates)
                throw new SearchLimit('MAX_STATES');
            statistics.states++;
            statistics.maxDepth = Math.max(statistics.maxDepth, depth);
            const signature = signaturesByBit.get(mask & -mask);
            if ((signatureMasks.get(signature) & mask) === mask) {
                const state = {
                    solution: { type: 'leaf', cost: 0n, signature, steps: 0 },
                    searchHeight: 0,
                };
                memo.set(mask, state);
                return state;
            }
            let best = null;
            let searchHeight = 0;
            for (const action of prepared) {
                checkTime();
                const branches = action.branches
                    .map((branch) => ({ outcome: branch.outcome, mask: branch.mask & mask }))
                    .filter((branch) => branch.mask !== 0n);
                // A previous deterministic action is constant here, so the world subset is the complete state key.
                if (branches.length < 2)
                    continue;
                let worst = 0n;
                let worstSteps = 0;
                let feasible = true;
                for (const branch of branches) {
                    if (statistics.transitions >= limits.maxTransitions)
                        throw new SearchLimit('MAX_TRANSITIONS');
                    statistics.transitions++;
                    const child = solve(branch.mask, depth + 1);
                    searchHeight = Math.max(searchHeight, 1 + child.searchHeight);
                    if (child.solution === null) {
                        feasible = false;
                        break;
                    }
                    if (child.solution.cost > worst)
                        worst = child.solution.cost;
                    worstSteps = Math.max(worstSteps, child.solution.steps);
                }
                const cost = action.cost + worst;
                if (feasible && (best === null || cost < best.cost)) {
                    best = { type: 'decision', cost, action: action.id, branches, steps: 1 + worstSteps };
                }
            }
            const state = { solution: best, searchHeight };
            memo.set(mask, state);
            return state;
        };
        const rootMask = (1n << BigInt(worlds.length)) - 1n;
        const optimal = solve(rootMask, 0).solution;
        checkTime();
        if (optimal === null || optimal.cost > budget)
            return finish('infeasible', 'NO_POLICY_WITHIN_BUDGET');
        if (optimal.steps > INPUT_LIMITS.observations - input.observations.length)
            return finish('limit_exceeded', 'MAX_OBSERVATIONS');
        const nodes = [];
        const nodeByMask = new Map();
        const leafBySignature = new Map();
        const materialize = (mask) => {
            checkTime();
            const existing = nodeByMask.get(mask);
            if (existing !== undefined)
                return existing;
            const solution = memo.get(mask).solution;
            if (solution.type === 'leaf') {
                const leaf = leafBySignature.get(solution.signature);
                if (leaf !== undefined)
                    return leaf;
            }
            const id = `n${nodes.length}`;
            nodeByMask.set(mask, id);
            if (solution.type === 'leaf') {
                leafBySignature.set(solution.signature, id);
                nodes.push({
                    id,
                    type: 'leaf',
                    answers: { ...answersBySignature.get(solution.signature) },
                });
            }
            else {
                const node = { id, type: 'decision', action: solution.action, branches: [] };
                nodes.push(node);
                node.branches = solution.branches.map((branch) => ({
                    outcome: branch.outcome,
                    child: materialize(branch.mask),
                }));
            }
            return id;
        };
        const root = materialize(rootMask);
        checkTime();
        statistics.policyNodes = nodes.length;
        return finish('planned', 'OPTIMAL_POLICY', { root, nodes }, optimal.cost, optimal.type === 'decision' ? optimal.action : null);
    }
    catch (error) {
        if (!(error instanceof SearchLimit))
            throw error;
        statistics.policyNodes = 0;
        return finish('limit_exceeded', error.reason);
    }
}
