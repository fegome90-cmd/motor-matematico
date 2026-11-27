import { type Action, type Input } from './core.js';
import { type PlanOptions, type PlanResult } from './planner.js';
export type AnchorBrief = Pick<Input, 'coverage' | 'gate' | 'costUnit' | 'remainingBudget' | 'observations'> & {
    anchor: string;
    questions: Input['decisions'];
    probes: Omit<Action, 'outcomes'>[];
    scenarios: {
        id: string;
        answers: Record<string, string>;
        outcomes: Record<string, string>;
    }[];
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
/** Transpose declared scenario rows. Never infer completeness or permissions from the anchor. */
export declare function compileAnchor(raw: unknown): AnchorState;
/** Routes classify the selected observation policy, not semantic prompt readiness. */
export declare function routeAnchor(raw: unknown, options?: PlanOptions): AnchorRouting;
export declare function advanceAnchor(raw: unknown, observation: unknown, options?: PlanOptions): AnchorState;
