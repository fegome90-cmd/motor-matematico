import { type AnchorRouting, type AnchorState } from './anchor.js';
import { type Gate } from './core.js';
import type { PlanOptions, PlanReason, PlanResult } from './planner.js';
export interface HostContext {
    taskId: string;
    revision: string;
    anchor: string;
    gate: Gate;
}
export type FalpRequest = {
    kind: 'ready';
    context: HostContext;
    explorationRequested: boolean;
} | {
    kind: 'investigation';
    context: HostContext;
    classification: 'focused' | 'exploratory';
    explorationRequested: boolean;
    state: AnchorState;
};
export type FalpInvestigation = Extract<FalpRequest, {
    kind: 'investigation';
}>;
export type FalpReason = PlanReason | 'HOST_GATE_DENIED' | 'HOST_GATE_UNKNOWN' | 'BRIEF_SUFFICIENT' | 'EXPLORATION_REQUESTED';
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
export type FalpReceipt = FalpDispatch & ({
    status: 'SUPPORTED';
    outcome: string;
    source: string;
} | {
    status: 'UNKNOWN' | 'CONFLICT' | 'BLOCKED';
    source: string;
});
export interface FalpReceiptResult {
    status: 'ACCEPTED' | 'DUPLICATE' | 'UNKNOWN' | 'CONFLICT' | 'BLOCKED';
    reason: 'SUPPORTED' | 'DUPLICATE_RECEIPT' | 'UNKNOWN' | 'CONFLICT' | 'BLOCKED' | 'HOST_GATE_DENIED' | 'HOST_GATE_UNKNOWN' | 'GATE_DENIED' | 'GATE_UNKNOWN' | 'ACTION_DENIED' | 'ACTION_PERMISSION_UNKNOWN' | 'ACTION_UNAVAILABLE';
    request: FalpInvestigation;
    receipt: FalpReceipt;
}
/** The host owns semantic classification. The next control never approves delivery. */
export declare function routeFalp(raw: unknown, options?: PlanOptions): FalpRouting;
/** Matches a report to trusted host context; it does not authenticate the sender or execute tools. */
export declare function acceptFalpReceipt(raw: unknown, expectedDispatch: unknown, reported: unknown, options?: PlanOptions): FalpReceiptResult;
