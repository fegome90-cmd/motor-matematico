import type { Gate, Input } from './core.js';
export interface PlanLimits {
    maxWorlds: number;
    maxActions: number;
    maxStates: number;
    maxTransitions: number;
    maxDepth: number;
    maxMillis: number;
}
export type PlanOptions = Partial<PlanLimits>;
export declare const DEFAULT_PLAN_LIMITS: Readonly<PlanLimits>;
export declare const PLAN_LIMIT_CEILINGS: Readonly<PlanLimits>;
export type PlanStatus = 'solved' | 'planned' | 'infeasible' | 'blocked' | 'conflict' | 'incomplete' | 'limit_exceeded';
export type PlanLimitReason = 'MAX_WORLDS' | 'MAX_ACTIONS' | 'MAX_STATES' | 'MAX_TRANSITIONS' | 'MAX_DEPTH' | 'MAX_MILLIS';
export type PlanReason = PlanLimitReason | 'CONFLICT' | 'GATE_DENIED' | 'GATE_UNKNOWN' | 'INCOMPLETE_COVERAGE' | 'SUFFICIENT' | 'OPTIMAL_POLICY' | 'NO_POLICY_WITHIN_BUDGET';
export type PolicyNode = {
    id: string;
    type: 'leaf';
    answers: Record<string, string>;
} | {
    id: string;
    type: 'decision';
    action: string;
    branches: {
        outcome: string;
        child: string;
    }[];
};
export interface Policy {
    root: string;
    nodes: PolicyNode[];
}
export interface PlanStatistics {
    worlds: number;
    compatibleWorlds: number;
    signatures: number;
    actions: number;
    admissibleActions: number;
    states: number;
    cacheHits: number;
    transitions: number;
    maxDepth: number;
    policyNodes: number;
}
export interface PlanResult {
    status: PlanStatus;
    reason: PlanReason;
    recommendedAction: string | null;
    worstCaseCost: string | null;
    policy: Policy | null;
    coverage: Input['coverage'];
    gate: Gate;
    costUnit: string;
    remainingBudget: string;
    statistics: PlanStatistics;
    limits: PlanLimits;
}
/** Exact minimax planning for the supplied finite model. Limits return no partial policy. */
export declare function plan(raw: unknown, configuration?: PlanOptions): PlanResult;
