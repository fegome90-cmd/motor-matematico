import { readFileSync } from 'node:fs';
import { advance, plan } from '../dist/index.js';

let input = JSON.parse(readFileSync(new URL('./parity3.json', import.meta.url), 'utf8'));
const worldId = process.argv[2] ?? 'w7';
if (!input.worlds.some((world) => world.id === worldId)) throw new TypeError('Unknown demo world');
const trace = [];
let result = plan(input);
while (result.status === 'planned') {
  const action = input.actions.find((candidate) => candidate.id === result.recommendedAction);
  const observation = {
    action: action.id,
    outcome: action.outcomes[worldId],
    source: `simulation:${worldId}`,
  };
  input = advance(input, observation);
  trace.push({ ...observation, cost: action.cost, remainingBudget: input.remainingBudget });
  result = plan(input);
}
console.log(
  JSON.stringify({ worldId, trace, status: result.status, policy: result.policy }, null, 2),
);
if (result.status !== 'solved') process.exitCode = 1;
