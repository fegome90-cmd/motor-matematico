import { type Input } from './core.js';
import { type PlanOptions } from './planner.js';
/** Record one observed result and charge its action once. This function performs no action. */
export declare function advance(raw: unknown, observation: unknown, options?: PlanOptions): Input;
