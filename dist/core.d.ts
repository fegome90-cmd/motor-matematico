/** FALP discrete routing prototype. No I/O, tool execution or LLM calls. */
export type Gate = 'allowed' | 'unknown' | 'denied';
export interface Decision {
    id: string;
    domain: string[];
}
export interface World {
    id: string;
    answers: Record<string, string>;
}
export interface Action {
    id: string;
    capability: string;
    permission: Gate;
    available: boolean;
    cost: string;
    outcomes: Record<string, string>;
}
export interface Observation {
    action: string;
    outcome: string;
    source: string;
}
export interface Input {
    coverage: 'complete' | 'incomplete';
    gate: Gate;
    costUnit: string;
    remainingBudget: string;
    decisions: Decision[];
    worlds: World[];
    actions: Action[];
    observations: Observation[];
}
export declare const INPUT_LIMITS: Readonly<{
    readonly decisions: 64;
    readonly worlds: 4096;
    readonly actions: 128;
    readonly observations: 512;
    readonly domain: 128;
    readonly digits: 128;
}>;
/** Validate and canonicalize the entire JSON contract. Completeness/authority are external assertions, not proven here. */
export declare function validate(input: unknown): Input;
/** Exact comparison for non-negative rational metrics with strictly positive denominator. */
export declare function compareRatios(a: bigint, b: bigint, c: bigint, d: bigint): -1 | 0 | 1;
export type Route = 'direct' | 'focused' | 'exploratory' | 'abstain';
export type Reason = 'CONFLICT' | 'INCOMPLETE_COVERAGE' | 'GATE_DENIED' | 'GATE_UNKNOWN' | 'SUFFICIENT' | 'ONE_ACTION_RESOLVES' | 'PARTIAL_PROGRESS' | 'JOINT_PLAN_REQUIRED' | 'NO_ADMISSIBLE_ACTION';
export interface ActionAssessment {
    id: string;
    capability: string;
    cost: string;
    eligible: boolean;
    exclusion: 'denied' | 'permission_unknown' | 'unavailable' | 'over_budget' | 'no_partition' | null;
    outcomes: {
        outcome: string;
        worlds: number;
        signatures: number;
    }[];
    worstResidual: number;
    guaranteedReduction: number;
    efficiency: {
        numerator: string;
        denominator: string;
    };
    resolvesAll: boolean;
}
export interface Result {
    route: Route;
    reason: Reason;
    recommendedAction: string | null;
    coverage: Input['coverage'];
    gate: Gate;
    costUnit: string;
    remainingBudget: string;
    worldIds: string[];
    signatures: string[][];
    signatureCount: number;
    decisions: {
        id: string;
        possible: string[];
        status: 'determined' | 'undetermined' | 'unverified' | 'conflict';
    }[];
    unresolvedCount: number;
    sufficient: boolean;
    actions: ActionAssessment[];
    observations: Observation[];
}
/** Pure function: decision depends only on the validated, supplied finite model. */
export declare function evaluate(raw: unknown): Result;
