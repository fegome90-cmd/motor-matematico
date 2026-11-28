import { validate } from './core.js';
import { plan } from './planner.js';
/** Record one observed result and charge its action once. This function performs no action. */
export function advance(raw, observation, options) {
    const input = validate(raw);
    const checked = validate({ ...input, observations: [observation] }).observations[0];
    const prior = input.observations.filter((item) => item.action === checked.action);
    if (prior.length) {
        if (prior.some((item) => item.outcome === checked.outcome && item.source === checked.source)) {
            return input;
        }
        throw new TypeError('An observed action cannot be replaced or charged again in this session');
    }
    const result = plan(input, options);
    if (result.status !== 'planned' || result.recommendedAction !== checked.action) {
        throw new TypeError('Observation must match the current planned action');
    }
    const action = input.actions.find((item) => item.id === checked.action);
    return validate({
        ...input,
        remainingBudget: (BigInt(input.remainingBudget) - BigInt(action.cost)).toString(),
        observations: [...input.observations, checked],
    });
}
