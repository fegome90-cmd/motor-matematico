"""Exact, independently implemented finite minimax oracle for the public plan API.

Python arbitrary-precision integers and tuple/set operations implement the reference.
The TypeScript planner is accessed only through the JSON batch harness. Every emitted
policy is executed for every compatible world, including all paths through a shared DAG.
The corpus and seed are reproducible; the shared development environment is not a blind
evaluation. Historical optimum/status labels are not used as the current oracle.

Run after npm run build:
    python3 -B tests/planner-oracle.py
    python3 -B tests/planner-oracle.py --output /path/to/evidence.json
Use --module to test a built public API in another checkout without reading its source.
"""

from __future__ import annotations

import argparse
import copy
import hashlib
import itertools
import json
import random
import re
import subprocess
import sys
import time
from collections import Counter, defaultdict
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
SEED = 27112026
HISTORICAL_SHA256 = '78d109caec3c1264f01471049807da4cb76cde8ec0ba2a82b91e3ba2b4b5e5ec'
VALID_STATUSES = {'solved', 'planned', 'infeasible', 'blocked', 'conflict', 'incomplete', 'limit_exceeded'}
DECIMAL = re.compile(r'^(0|[1-9][0-9]*)$')
DEFAULT_LIMITS = {
    'maxWorlds': 128, 'maxActions': 32, 'maxStates': 20000,
    'maxTransitions': 500000, 'maxDepth': 32, 'maxMillis': 1000,
}
STATISTIC_FIELDS = {
    'worlds', 'compatibleWorlds', 'signatures', 'actions', 'admissibleActions',
    'states', 'cacheHits', 'transitions', 'maxDepth', 'policyNodes',
}


@dataclass
class Case:
    name: str
    group: str
    input: Any
    options: Any = field(default_factory=dict)
    expected_error: bool = False
    limit_reason: str | None = None
    same_as: str | None = None
    hand_cost: int | None = None
    hand_status: str | None = None

    def request(self) -> dict:
        row = {'input': self.input}
        if self.options != {}:
            row['options'] = self.options
        return row


@dataclass
class Reference:
    status: str
    reason: str
    optimum: int | None
    action: str | None
    worlds: dict[str, tuple[str, ...]]
    decisions: tuple[str, ...]
    states: int = 0


def js_key(value: str) -> bytes:
    """Match JavaScript string comparison, including non-BMP action identifiers."""
    return value.encode('utf-16-be', errors='surrogatepass')


def reference(x: dict) -> Reference:
    decisions = tuple(sorted((d['id'] for d in x['decisions']), key=js_key))
    actions = {a['id']: a for a in x['actions']}
    worlds = {
        w['id']: tuple(w['answers'][q] for q in decisions)
        for w in x['worlds']
        if all(actions[o['action']]['outcomes'][w['id']] == o['outcome'] for o in x['observations'])
    }
    signatures = set(worlds.values())
    if x['coverage'] == 'complete' and not worlds:
        return Reference('conflict', 'CONFLICT', None, None, worlds, decisions)
    if x['gate'] != 'allowed':
        return Reference('blocked', 'GATE_' + x['gate'].upper(), None, None, worlds, decisions)
    if x['coverage'] != 'complete':
        return Reference('incomplete', 'INCOMPLETE_COVERAGE', None, None, worlds, decisions)
    if len(signatures) == 1:
        return Reference('solved', 'SUFFICIENT', 0, None, worlds, decisions)

    observed = {o['action'] for o in x['observations']}
    pending = tuple(sorted((a['id'] for a in x['actions']
                            if a['permission'] == 'allowed' and a['available']
                            and a['id'] not in observed), key=js_key))

    @lru_cache(maxsize=None)
    def solve(compatible: tuple[str, ...], remaining: tuple[str, ...]) -> tuple[int | None, str | None]:
        if len({worlds[w] for w in compatible}) == 1:
            return 0, None
        best_cost, best_action = None, None
        for action_id in remaining:
            action = actions[action_id]
            buckets: dict[str, list[str]] = defaultdict(list)
            for world in compatible:
                buckets[action['outcomes'][world]].append(world)
            if len(buckets) < 2:
                continue
            next_actions = tuple(a for a in remaining if a != action_id)
            continuation = [solve(tuple(group), next_actions)[0] for group in buckets.values()]
            if any(cost is None for cost in continuation):
                continue
            cost = int(action['cost']) + max(continuation)
            # The iteration order implements the documented lexicographic tie break.
            if best_cost is None or cost < best_cost:
                best_cost, best_action = cost, action_id
        return best_cost, best_action

    optimum, action = solve(tuple(sorted(worlds, key=js_key)), pending)
    states = solve.cache_info().currsize
    if optimum is None or optimum > int(x['remainingBudget']):
        return Reference('infeasible', 'NO_POLICY_WITHIN_BUDGET', optimum, None, worlds, decisions, states)
    return Reference('planned', 'OPTIMAL_POLICY', optimum, action, worlds, decisions, states)


def require(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)


def decimal(value: Any, label: str) -> int:
    require(isinstance(value, str) and DECIMAL.fullmatch(value) is not None,
            f'{label} must be an exact canonical decimal string, received {value!r}')
    return int(value)


def verify_policy(x: dict, result: dict, ref: Reference) -> dict:
    policy = result['policy']
    require(isinstance(policy, dict), 'successful result has no policy object')
    require(isinstance(policy.get('nodes'), list) and policy['nodes'], 'policy.nodes must be nonempty')
    nodes = {}
    for node in policy['nodes']:
        require(isinstance(node, dict) and isinstance(node.get('id'), str), 'invalid policy node identifier')
        require(node['id'] not in nodes, 'duplicate policy node identifier')
        require(node.get('type') in {'decision', 'leaf'}, 'unknown policy node type')
        nodes[node['id']] = node
    require(isinstance(policy.get('root'), str) and policy['root'] in nodes, 'policy root is missing')
    root = nodes[policy['root']]
    actions = {a['id']: a for a in x['actions']}
    budget = int(x['remainingBudget'])
    reached: dict[str, set[str]] = defaultdict(set)
    paths, costs, action_steps = [], [], 0
    for world_id, signature in ref.worlds.items():
        node_id = policy['root']
        path, visited, used = [], set(), {o['action'] for o in x['observations']}
        cost = 0
        while True:
            require(node_id in nodes, f'branch points to missing node {node_id!r}')
            require(node_id not in visited, f'cycle on path for world {world_id}')
            visited.add(node_id)
            reached[node_id].add(world_id)
            node = nodes[node_id]
            if node['type'] == 'leaf':
                expected = dict(zip(ref.decisions, signature))
                require(node.get('answers') == expected,
                        f'wrong terminal answers for {world_id}: {node.get("answers")!r} != {expected!r}')
                break
            action_id = node.get('action')
            require(action_id in actions, f'unknown policy action {action_id!r}')
            require(action_id not in used, f'repeated or already observed action {action_id!r}')
            used.add(action_id)
            action = actions[action_id]
            require(action['permission'] == 'allowed' and action['available'],
                    f'unauthorized or unavailable policy action {action_id!r}')
            cost += int(action['cost'])
            require(cost <= budget, f'path exceeds remaining budget in world {world_id}')
            branches = node.get('branches')
            require(isinstance(branches, list) and len(branches) >= 2, 'decision does not partition worlds')
            outcomes = []
            for branch in branches:
                require(isinstance(branch, dict) and isinstance(branch.get('outcome'), str)
                        and isinstance(branch.get('child'), str), 'invalid branch schema')
                outcomes.append(branch['outcome'])
            require(len(set(outcomes)) == len(outcomes), 'duplicate outcomes in policy branches')
            actual_outcome = action['outcomes'][world_id]
            children = [b['child'] for b in branches if b['outcome'] == actual_outcome]
            require(len(children) == 1, f'policy omits outcome {actual_outcome!r} for {world_id}')
            path.append(action_id)
            action_steps += 1
            node_id = children[0]
        paths.append(path)
        costs.append(cost)
    require(set(reached) == set(nodes), 'policy contains unreachable nodes')
    for node_id, node in nodes.items():
        if node['type'] == 'decision':
            possible = {actions[node['action']]['outcomes'][w] for w in reached[node_id]}
            emitted = {branch['outcome'] for branch in node['branches']}
            require(possible == emitted, 'policy branches differ from nonempty supported outcomes')
    worst = decimal(result['worstCaseCost'], 'worstCaseCost')
    require(worst == max(costs), f'reported worst cost {worst} differs from executed paths {max(costs)}')
    require(worst == ref.optimum, f'policy cost {worst} differs from independent optimum {ref.optimum}')
    if ref.status == 'solved':
        require(root['type'] == 'leaf' and len(nodes) == 1, 'solved policy must be one terminal node')
        require(result['recommendedAction'] is None, 'solved policy recommends an action')
    else:
        require(root['type'] == 'decision', 'planned policy has no first action')
        require(result['recommendedAction'] == root['action'] == ref.action,
                f'wrong first action or tie break: {result["recommendedAction"]!r} != {ref.action!r}')
    return {'world_paths': len(paths), 'action_steps': action_steps, 'nodes': len(nodes),
            'max_path_actions': max(map(len, paths))}


def verify_result(case: Case, actual: dict, ref: Reference | None) -> dict:
    require(isinstance(actual, dict) and isinstance(actual.get('ok'), bool), 'invalid batch wrapper')
    if case.expected_error:
        require(actual['ok'] is False, 'malformed input/options accepted')
        require(actual.get('error', {}).get('name') == 'TypeError', 'malformed contract must throw TypeError')
        return {'status': 'TypeError', 'world_paths': 0, 'action_steps': 0, 'nodes': 0}
    require(actual['ok'], f'valid contract threw {actual.get("error")!r}')
    result = actual.get('result')
    require(isinstance(result, dict), 'plan result must be an object')
    require(result.get('status') in VALID_STATUSES, 'unknown status')
    expected_status = 'limit_exceeded' if case.limit_reason else ref.status
    expected_reason = case.limit_reason or ref.reason
    require(result['status'] == expected_status, f'status {result["status"]!r} != {expected_status!r}')
    require(result.get('reason') == expected_reason, f'reason {result.get("reason")!r} != {expected_reason!r}')
    for key in ('coverage', 'gate', 'costUnit', 'remainingBudget'):
        require(result.get(key) == case.input[key], f'{key} was not preserved')
    require('policy' in result and 'worstCaseCost' in result and 'recommendedAction' in result,
            'missing nullable contract fields')
    limits = dict(DEFAULT_LIMITS)
    limits.update(case.options)
    require(result.get('limits') == limits, 'resolved limits differ from options/defaults')
    stats = result.get('statistics')
    require(isinstance(stats, dict) and STATISTIC_FIELDS <= stats.keys(), 'missing search statistics')
    require(all(type(stats[k]) is int and stats[k] >= 0 for k in STATISTIC_FIELDS),
            'search statistics must be nonnegative integers')
    if result['status'] in {'solved', 'planned'}:
        cert = verify_policy(case.input, result, ref)
        require(stats['policyNodes'] == cert['nodes'], 'policyNodes statistic disagrees with certificate')
    else:
        require(result['policy'] is None and result['worstCaseCost'] is None
                and result['recommendedAction'] is None, 'non-success exposed a partial policy, action or cost')
        require(stats['policyNodes'] == 0, 'non-success reports policy nodes')
        cert = {'world_paths': 0, 'action_steps': 0, 'nodes': 0, 'max_path_actions': 0}
    cert['status'] = result['status']
    return cert


def model(signatures: list[tuple[str, ...]], action_specs: list[tuple], budget: int,
          ids: list[str] | None = None) -> dict:
    ids = ids or [f'w{i}' for i in range(len(signatures))]
    nq = len(signatures[0]) if signatures else 1
    decisions = [{'id': f'q{q}', 'domain': sorted({s[q] for s in signatures} | {'v0', 'v1'}, key=js_key)}
                 for q in range(nq)]
    worlds = [{'id': wid, 'answers': {f'q{q}': value for q, value in enumerate(signature)}}
              for wid, signature in zip(ids, signatures)]
    actions = []
    for spec in action_specs:
        aid, cost, outcomes, *gates = spec
        permission, available = gates if gates else ('allowed', True)
        actions.append({'id': aid, 'capability': 'synthetic_evidence', 'permission': permission,
                        'available': available, 'cost': str(cost), 'outcomes': dict(zip(ids, outcomes))})
    return {'coverage': 'complete', 'gate': 'allowed', 'costUnit': 'work_units',
            'remainingBudget': str(budget), 'decisions': decisions, 'worlds': worlds,
            'actions': actions, 'observations': []}


def parity_model() -> dict:
    signatures = [(f'v{(i & 1) ^ ((i >> 1) & 1) ^ ((i >> 2) & 1)}',) for i in range(16)]
    actions = [(f'signal_{k}', 2, [f'o{(i >> k) & 1}' for i in range(16)]) for k in range(3)]
    actions.append(('noise', 1, [f'o{(i >> 3) & 1}' for i in range(16)]))
    return model(signatures, actions, 6)


def six_step_model() -> dict:
    signatures = [(f'v{i}',) for i in range(7)]
    actions = [(f'probe_{j}', 1, ['selected' if i == j else 'other' for i in range(7)]) for j in range(6)]
    return model(signatures, actions, 6)


def regression_cases() -> list[Case]:
    cases = []

    def add(name: str, x: dict, cost: int | None = None, status: str | None = None, **kw: Any) -> Case:
        case = Case(name, 'regression', x, hand_cost=cost, hand_status=status, **kw)
        cases.append(case)
        return case

    parity = parity_model()
    add('parity3_plus_noise_budget6', parity, 6, 'planned')
    below = copy.deepcopy(parity)
    below['remainingBudget'] = '5'
    add('parity3_budget5_infeasible', below, 6, 'infeasible')
    observed = copy.deepcopy(parity)
    observed['observations'] = [{'action': 'signal_0', 'outcome': 'o1', 'source': 'fixture'}]
    observed['remainingBudget'] = '4'
    add('parity3_after_observation', observed, 4, 'planned')
    full = copy.deepcopy(parity)
    full['observations'] = [{'action': f'signal_{k}', 'outcome': 'o1', 'source': 'fixture'} for k in range(3)]
    full['remainingBudget'] = '0'
    add('parity3_already_solved', full, 0, 'solved')

    huge = 9007199254740993
    signatures = [('v0',), ('v1',)]
    near = model(signatures, [('a_expensive', huge, ['o0', 'o1']),
                              ('z_cheaper', huge - 1, ['o0', 'o1'])], huge)
    add('costs_adjacent_above_2pow53', near, huge - 1, 'planned')
    near_tight = copy.deepcopy(near)
    near_tight['remainingBudget'] = str(huge - 2)
    add('budget_one_below_huge_optimum', near_tight, huge - 1, 'infeasible')
    bits = list(itertools.product(range(2), repeat=2))
    joint = model([(f'v{a ^ b}',) for a, b in bits],
                  [('signal_a', huge, [f'o{a}' for a, b in bits]),
                   ('signal_b', huge + 2, [f'o{b}' for a, b in bits])], 2 * huge + 2)
    add('exact_huge_path_sum', joint, 2 * huge + 2, 'planned')
    joint_short = copy.deepcopy(joint)
    joint_short['remainingBudget'] = str(2 * huge + 1)
    add('exact_huge_total_budget_short', joint_short, 2 * huge + 2, 'infeasible')
    very_huge = 10 ** 120 + 37
    add('decimal_121_digits', model(signatures, [('resolve', very_huge, ['o0', 'o1'])], very_huge),
        very_huge, 'planned')
    tied = model(signatures, [('z', 3, ['o0', 'o1']), ('a', 3, ['o0', 'o1'])], 3)
    add('lexicographic_tie', tied, 3, 'planned')
    add('ascii_case_tie', model(signatures, [('a', 2, ['o0', 'o1']), ('A', 2, ['o0', 'o1'])], 2),
        2, 'planned')

    adaptive = model([(f'v{i}',) for i in range(4)],
                     [('route', 1, ['left', 'left', 'right', 'right']),
                      ('left', 2, ['o0', 'o1', 'other', 'other']),
                      ('right', 4, ['other', 'other', 'o0', 'o1'])], 5)
    add('adaptive_minimax_sum_of_branch_max', adaptive, 5, 'planned')
    duplicate_signatures = model([('v0',), ('v0',), ('v1',), ('v1',)],
                                 [('resolve_signature', 2, ['x', 'x', 'y', 'y']),
                                  ('identify_world', 9, ['o0', 'o1', 'o2', 'o3'])], 2)
    add('resolve_signature_not_world', duplicate_signatures, 2, 'planned')
    add('no_actions_needed', model([('v1',), ('v1',)], [], 0), 0, 'solved')
    add('unsplittable_different_answers', model(signatures, [('constant', 1, ['same', 'same'])], 5),
        status='infeasible')
    add('no_actions_unsolved', model(signatures, [], 10), status='infeasible')
    add('all_actions_denied', model(signatures, [('denied', 1, ['a', 'b'], 'denied', True)], 10),
        status='infeasible')
    add('permission_unknown', model(signatures, [('unknown', 1, ['a', 'b'], 'unknown', True)], 10),
        status='infeasible')
    add('available_false', model(signatures, [('offline', 1, ['a', 'b'], 'allowed', False)], 10),
        status='infeasible')
    add('six_step_worst_case_path', six_step_model(), 6, 'planned')
    six_short = six_step_model()
    six_short['remainingBudget'] = '5'
    add('six_step_total_budget_short', six_short, 6, 'infeasible')

    for gate in ('allowed', 'unknown', 'denied'):
        for coverage in ('complete', 'incomplete'):
            for variant in ('ordinary', 'outside', 'empty', 'solved'):
                x = copy.deepcopy(tied if variant != 'solved' else full)
                x['gate'], x['coverage'] = gate, coverage
                if variant == 'outside':
                    x['observations'] = [{'action': 'a', 'outcome': 'outside-support', 'source': 'fixture'}]
                if variant == 'empty':
                    x['worlds'], x['actions'], x['observations'] = [], [], []
                add(f'precedence_{gate}_{coverage}_{variant}', x)

    contradicted = copy.deepcopy(tied)
    contradicted['observations'] = [
        {'action': 'a', 'outcome': 'o0', 'source': 'one'},
        {'action': 'a', 'outcome': 'o1', 'source': 'two'},
    ]
    add('contradictory_supported_observations', contradicted, status='conflict')
    duplicate_obs = copy.deepcopy(observed)
    duplicate_obs['observations'] *= 3
    add('duplicate_observations', duplicate_obs, 4, 'planned', same_as='parity3_after_observation')
    for original in list(cases[:14]):
        x = copy.deepcopy(original.input)
        for key in ('worlds', 'actions', 'decisions', 'observations'):
            x[key].reverse()
        for decision in x['decisions']:
            decision['domain'].reverse()
        for world in x['worlds']:
            world['answers'] = dict(reversed(list(world['answers'].items())))
        for action in x['actions']:
            action['outcomes'] = dict(reversed(list(action['outcomes'].items())))
        add(original.name + '_reordered', x, original.hand_cost, original.hand_status,
            same_as=original.name)
    return cases


def exhaustive_cases() -> list[Case]:
    """All binary answers and two binary action maps on four worlds, budgets 0..3.

    The complete grid is 16 answer maps × 16 A maps × 16 B maps × 4 budgets.
    Action costs are 1 and 2, so this spans every affordable policy boundary.
    """
    binary = list(itertools.product(range(2), repeat=4))
    cases = []
    for answer_index, answers in enumerate(binary):
        for a_index, a_map in enumerate(binary):
            for b_index, b_map in enumerate(binary):
                for budget in range(4):
                    x = model([(f'v{v}',) for v in answers],
                              [('a', 1, [f'o{v}' for v in a_map]), ('b', 2, [f'o{v}' for v in b_map])], budget)
                    cases.append(Case(f'exhaustive_{answer_index}_{a_index}_{b_index}_{budget}', 'exhaustive', x))
    return cases


def seeded_cases(count: int) -> list[Case]:
    rng = random.Random(SEED)
    cases = []
    for index in range(count):
        n_worlds = rng.choice([0, 1, 2, 3, 4, 5, 6, 8])
        n_decisions = rng.randint(1, 3)
        signatures = [tuple(f'v{rng.randrange(3)}' for _ in range(n_decisions)) for _ in range(n_worlds)]
        specs = []
        for aid in range(rng.randint(0, 6)):
            cost = rng.choice([1, 1, 2, 3, 5, 8, 13, 9007199254740992, 9007199254740993, 10 ** 60 + 17])
            outcomes = [f'o{rng.randrange(rng.choice([2, 3, 4]))}' for _ in range(n_worlds)]
            specs.append((f'a{aid}', cost, outcomes,
                          rng.choice(['allowed'] * 7 + ['unknown', 'denied']), rng.random() < 0.88))
        if index % 4 == 0 and n_worlds and len(specs) < 6:
            specs.append(('resolve', rng.choice([1, 3, 7]), ['-'.join(s) for s in signatures]))
        total = sum(spec[1] for spec in specs)
        budget = rng.choice([0, 1, 2, 3, 5, 8, 13, total, max(0, total - 1), 9007199254740993, 10 ** 61])
        x = model(signatures, specs, budget)
        x['gate'] = rng.choice(['allowed'] * 10 + ['unknown', 'denied'])
        x['coverage'] = rng.choice(['complete'] * 8 + ['incomplete'])
        if specs and n_worlds and rng.random() < 0.4:
            witness = rng.randrange(n_worlds)
            for _ in range(rng.randint(1, 3)):
                action = rng.choice(x['actions'])
                outcome = action['outcomes'][f'w{witness}'] if rng.random() > 0.15 else 'outside-support'
                x['observations'].append({'action': action['id'], 'outcome': outcome, 'source': 'seeded'})
        cases.append(Case(f'seeded_{index:04d}', 'seeded', x))
    return cases


def historical_cases() -> list[Case]:
    path = ROOT / 'tests/fixtures/planner-historical-corpus.json'
    payload = path.read_bytes()
    require(hashlib.sha256(payload).hexdigest() == HISTORICAL_SHA256, 'frozen historical corpus hash changed')
    rows = json.loads(payload)
    require(len(rows) == 1000, 'frozen historical corpus count changed')
    return [Case('historical_' + r['id'], 'historical_' + r['stratum'], r['input']) for r in rows]


def limit_cases() -> list[Case]:
    parity = parity_model()
    cases = []
    for option, value, reason in (
        ('maxWorlds', 8, 'MAX_WORLDS'), ('maxActions', 3, 'MAX_ACTIONS'),
        ('maxStates', 1, 'MAX_STATES'), ('maxTransitions', 1, 'MAX_TRANSITIONS'),
        ('maxDepth', 0, 'MAX_DEPTH'),
    ):
        cases.append(Case('limit_' + option, 'limits', copy.deepcopy(parity),
                          {option: value}, limit_reason=reason))
    cases.append(Case('limit_depth_below_six_step_policy', 'limits', six_step_model(),
                      {'maxDepth': 5}, limit_reason='MAX_DEPTH'))
    cases.append(Case('depth_exactly_six_step_policy', 'limits', six_step_model(),
                      {'maxDepth': 6}, hand_cost=6, hand_status='planned'))
    solved = model([('v0',)] * 16, [], 0)
    cases.append(Case('solved_bypasses_search_capacity', 'limits', solved,
                      {'maxWorlds': 1, 'maxDepth': 0}, hand_cost=0, hand_status='solved'))
    narrowed = copy.deepcopy(parity)
    narrowed['observations'] = [{'action': 'signal_0', 'outcome': 'o1', 'source': 'fixture'}]
    narrowed['remainingBudget'] = '4'
    cases.append(Case('world_limit_after_evidence', 'limits', narrowed, {'maxWorlds': 8}, hand_cost=4))
    filtered = model([('v0',), ('v1',)],
                     [('resolve', 2, ['a', 'b']), ('denied', 1, ['a', 'b'], 'denied', True),
                      ('unknown', 1, ['a', 'b'], 'unknown', True),
                      ('unavailable', 1, ['a', 'b'], 'allowed', False),
                      ('too_expensive', 3, ['a', 'b'])], 2)
    cases.append(Case('action_limit_after_admissibility', 'limits', filtered, {'maxActions': 1}, hand_cost=2))
    for gate in ('unknown', 'denied'):
        x = copy.deepcopy(parity)
        x['gate'] = gate
        cases.append(Case('gate_before_capacity_' + gate, 'limits', x, {'maxWorlds': 1}))
    x = copy.deepcopy(parity)
    x['coverage'] = 'incomplete'
    cases.append(Case('incomplete_before_capacity', 'limits', x, {'maxWorlds': 1}))
    x = copy.deepcopy(parity)
    x['observations'] = [{'action': 'noise', 'outcome': 'outside', 'source': 'fixture'}]
    cases.append(Case('conflict_before_capacity', 'limits', x, {'maxWorlds': 1}))
    return cases


def malformed_cases() -> list[Case]:
    base = model([('v0',), ('v1',)], [('resolve', 1, ['o0', 'o1'])], 1)
    cases = []

    def bad(name: str, mutate: Any) -> None:
        x = copy.deepcopy(base)
        mutate(x)
        cases.append(Case('invalid_' + name, 'malformed', x, expected_error=True))

    for value in ('0', '-1', '01', '1.5', 1, True, None, '1e3'):
        bad('cost_' + repr(value), lambda x, v=value: x['actions'][0].__setitem__('cost', v))
    for value in ('-1', '01', 1, True, None):
        bad('budget_' + repr(value), lambda x, v=value: x.__setitem__('remainingBudget', v))
    bad('duplicate_world', lambda x: x['worlds'].append(copy.deepcopy(x['worlds'][0])))
    bad('duplicate_action', lambda x: x['actions'].append(copy.deepcopy(x['actions'][0])))
    bad('duplicate_decision', lambda x: x['decisions'].append(copy.deepcopy(x['decisions'][0])))
    bad('missing_outcome', lambda x: x['actions'][0]['outcomes'].pop('w0'))
    bad('extra_outcome', lambda x: x['actions'][0]['outcomes'].__setitem__('missing', 'o0'))
    bad('missing_answer', lambda x: x['worlds'][0]['answers'].pop('q0'))
    bad('answer_outside_domain', lambda x: x['worlds'][0]['answers'].__setitem__('q0', 'outside'))
    bad('empty_decisions', lambda x: x.__setitem__('decisions', []))
    bad('unknown_action_observation', lambda x: x['observations'].append(
        {'action': 'missing', 'outcome': 'o0', 'source': 'fixture'}))
    bad('invalid_gate', lambda x: x.__setitem__('gate', 'maybe'))
    bad('invalid_coverage', lambda x: x.__setitem__('coverage', 'maybe'))
    bad('unknown_field', lambda x: x.__setitem__('surprise', True))
    for value in ('\ue000', '\U00010000', '__proto__', 'a b'):
        bad('noncanonical_id_' + repr(value), lambda x, v=value: x['actions'][0].__setitem__('id', v))
    for index, raw in enumerate((None, [], 'input', 3, True)):
        cases.append(Case(f'invalid_root_{index}', 'malformed', raw, expected_error=True))
    ceilings = {'maxWorlds': 512, 'maxActions': 64, 'maxStates': 200000,
                'maxTransitions': 2000000, 'maxDepth': 64, 'maxMillis': 10000}
    for name, upper in ceilings.items():
        invalid = [-1, upper + 1, 1.5, True, '1', None]
        if name != 'maxDepth':
            invalid.append(0)
        for index, value in enumerate(invalid):
            cases.append(Case(f'invalid_option_{name}_{index}', 'malformed', copy.deepcopy(base),
                              {name: value}, expected_error=True))
    for index, options in enumerate((None, [], 'options', 3, True, {'surprise': 1})):
        cases.append(Case(f'invalid_options_object_{index}', 'malformed', copy.deepcopy(base),
                          options, expected_error=True))
    return cases


def self_test() -> dict:
    regressions = regression_cases()
    hand_checked = 0
    for case in regressions + limit_cases():
        ref = reference(case.input)
        if case.hand_cost is not None:
            require(ref.optimum == case.hand_cost, f'oracle self-check cost failed: {case.name}')
            hand_checked += 1
        if case.hand_status is not None:
            require(ref.status == case.hand_status, f'oracle self-check status failed: {case.name}')
    x = model([('v0',), ('v1',)], [('resolve', 2, ['o0', 'o1'])], 2)
    ref = reference(x)
    valid = {'recommendedAction': 'resolve', 'worstCaseCost': '2', 'policy': {'root': 'n0', 'nodes': [
        {'id': 'n0', 'type': 'decision', 'action': 'resolve',
         'branches': [{'outcome': 'o0', 'child': 'n1'}, {'outcome': 'o1', 'child': 'n2'}]},
        {'id': 'n1', 'type': 'leaf', 'answers': {'q0': 'v0'}},
        {'id': 'n2', 'type': 'leaf', 'answers': {'q0': 'v1'}},
    ]}}
    verify_policy(x, valid, ref)
    corruptions = [
        lambda r: r.__setitem__('worstCaseCost', 2),
        lambda r: r.__setitem__('worstCaseCost', '3'),
        lambda r: r.__setitem__('recommendedAction', 'missing'),
        lambda r: r['policy']['nodes'][1]['answers'].__setitem__('q0', 'v1'),
        lambda r: r['policy']['nodes'][0]['branches'].pop(),
        lambda r: r['policy']['nodes'][0]['branches'][0].__setitem__('child', 'missing'),
        lambda r: r['policy']['nodes'][0]['branches'][0].__setitem__('child', 'n0'),
        lambda r: r['policy']['nodes'][0].__setitem__('action', 'unknown'),
        lambda r: r['policy']['nodes'].append({'id': 'unused', 'type': 'leaf', 'answers': {'q0': 'v0'}}),
        lambda r: r['policy']['nodes'].append(copy.deepcopy(r['policy']['nodes'][1])),
    ]
    rejected = 0
    for corrupt in corruptions:
        altered = copy.deepcopy(valid)
        corrupt(altered)
        try:
            verify_policy(x, altered, ref)
        except AssertionError:
            rejected += 1
        else:
            raise AssertionError('certificate checker accepted a deliberately corrupted policy')
    repeated = copy.deepcopy(valid)
    second = copy.deepcopy(repeated['policy']['nodes'][0])
    second['id'] = 'n3'
    repeated['policy']['nodes'].append(second)
    repeated['policy']['nodes'][0]['branches'][0]['child'] = 'n3'
    try:
        verify_policy(x, repeated, ref)
    except AssertionError:
        rejected += 1
    else:
        raise AssertionError('certificate checker accepted a repeated action without a graph cycle')
    for field_name, value in (('permission', 'denied'), ('permission', 'unknown'), ('available', False)):
        changed = copy.deepcopy(x)
        changed['actions'][0][field_name] = value
        try:
            verify_policy(changed, valid, ref)
        except AssertionError:
            rejected += 1
        else:
            raise AssertionError('certificate checker accepted an inadmissible action')
    changed = copy.deepcopy(x)
    changed['remainingBudget'] = '1'
    try:
        verify_policy(changed, valid, ref)
    except AssertionError:
        rejected += 1
    else:
        raise AssertionError('certificate checker accepted an over-budget path')
    return {'hand_derived_optimum_checks': hand_checked, 'corrupt_certificates_rejected': rejected}


def run_batch(cases: list[Case], module: str | None) -> list[dict]:
    command = ['node', str(ROOT / 'tests/plan-batch.mjs')]
    if module:
        command += ['--module', str(Path(module).resolve())]
    run = subprocess.run(command, cwd=ROOT, input=json.dumps([case.request() for case in cases]),
                         text=True, capture_output=True, timeout=120)
    require(run.returncode == 0, f'batch process exited {run.returncode}: {run.stderr[:4000]}')
    output = json.loads(run.stdout)
    require(isinstance(output, list) and len(output) == len(cases), 'batch response size mismatch')
    return output


def module_fingerprint(module: str | None) -> dict:
    """Hash compiled public-module artifacts for provenance without inspecting their code."""
    entry = Path(module).resolve() if module else ROOT / 'dist/index.js'
    require(entry.is_file(), f'built public API module is missing: {entry}; run npm run build')
    files = {str(path.relative_to(entry.parent)): hashlib.sha256(path.read_bytes()).hexdigest()
             for path in sorted(entry.parent.rglob('*.js'))}
    payload = json.dumps(files, sort_keys=True, separators=(',', ':')).encode()
    return {'entry': str(entry), 'sha256': hashlib.sha256(payload).hexdigest(), 'javascript_files': files}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--output', type=Path, help='write complete machine-readable evidence JSON')
    parser.add_argument('--module', help='built module exposing plan(); defaults to ../dist/index.js')
    parser.add_argument('--seeded-count', type=int, default=1200)
    parser.add_argument('--batch-size', type=int, default=256)
    parser.add_argument('--self-test', action='store_true', help='check the Python oracle and certificate checker only')
    parser.add_argument('--quick', action='store_true', help='regressions, limits and malformed inputs only')
    args = parser.parse_args()
    require(args.seeded_count >= 0 and args.batch_size > 0, 'invalid campaign size')
    started = time.monotonic()
    self_checks = self_test()
    if args.self_test:
        print(json.dumps({'status': 'PASS', 'self_checks': self_checks}, sort_keys=True))
        return 0
    artifacts = module_fingerprint(args.module)
    cases = regression_cases() + limit_cases() + malformed_cases()
    if not args.quick:
        cases += exhaustive_cases() + seeded_cases(args.seeded_count) + historical_cases()
    require(len({case.name for case in cases}) == len(cases), 'duplicate campaign case identifier')
    digest = hashlib.sha256()
    for case in cases:
        digest.update(json.dumps({'id': case.name, **case.request()}, sort_keys=True,
                                 separators=(',', ':'), ensure_ascii=True).encode())
        digest.update(b'\n')
    status_counts, groups = Counter(), defaultdict(Counter)
    failures, records, by_name = [], [], {}
    world_paths, action_steps, certificates, maximum_path, maximum_nodes = 0, 0, 0, 0, 0
    exact_large_costs, oracle_states, planner_states, planner_transitions = 0, 0, 0, 0
    for start in range(0, len(cases), args.batch_size):
        batch = cases[start:start + args.batch_size]
        require(module_fingerprint(args.module) == artifacts, 'built module changed during the campaign')
        actual = run_batch(batch, args.module)
        for case, observed in zip(batch, actual):
            ref = None if case.expected_error else reference(case.input)
            record = {'id': case.name, 'group': case.group, 'pass': False}
            if ref is not None:
                record['reference_status'] = 'limit_exceeded' if case.limit_reason else ref.status
                record['unconstrained_optimum'] = None if ref.optimum is None else str(ref.optimum)
                record['reference_first_action'] = ref.action
                oracle_states += ref.states
            try:
                metrics = verify_result(case, observed, ref)
                if case.same_as:
                    require(case.same_as in by_name, 'metamorphic source case was not executed')
                    require(observed == by_name[case.same_as], 'reordered/duplicate observation output changed')
                if case.hand_cost is not None:
                    require(ref.optimum == case.hand_cost, 'hand-derived expected optimum changed')
                if case.hand_status is not None:
                    require(ref.status == case.hand_status, 'hand-derived expected status changed')
                status_counts[metrics['status']] += 1
                groups[case.group]['passed'] += 1
                record.update({'pass': True, 'actual_status': metrics['status'],
                               'world_paths_checked': metrics['world_paths']})
                world_paths += metrics['world_paths']
                action_steps += metrics['action_steps']
                if metrics['world_paths']:
                    certificates += 1
                    maximum_path = max(maximum_path, metrics['max_path_actions'])
                    maximum_nodes = max(maximum_nodes, metrics['nodes'])
                if observed['ok']:
                    result = observed['result']
                    record['worstCaseCost'] = result['worstCaseCost']
                    record['recommendedAction'] = result['recommendedAction']
                    planner_states += result['statistics']['states']
                    planner_transitions += result['statistics']['transitions']
                    if result['worstCaseCost'] is not None and int(result['worstCaseCost']) > 2 ** 53:
                        exact_large_costs += 1
                else:
                    record['error_name'] = observed['error']['name']
            except (AssertionError, KeyError, TypeError, ValueError) as error:
                groups[case.group]['failed'] += 1
                failure = {'id': case.name, 'error': str(error), 'input': case.input,
                           'options': case.options, 'actual': observed}
                failures.append(failure)
                record['failure'] = str(error)
                print(f'FAIL {case.name}: {error}', file=sys.stderr)
            by_name[case.name] = observed
            records.append(record)
        if start == 0 or start + len(batch) == len(cases) or (start // args.batch_size + 1) % 16 == 0:
            print(f'planner oracle: {start + len(batch)}/{len(cases)} checked; failures={len(failures)}',
                  file=sys.stderr, flush=True)
    require(module_fingerprint(args.module) == artifacts, 'built module changed during the campaign')
    summary = {
        'status': 'PASS' if not failures else 'FAIL', 'seed': SEED,
        'cases': len(cases), 'passed': len(cases) - len(failures), 'failed': len(failures),
        'case_sha256': digest.hexdigest(), 'historical_sha256': HISTORICAL_SHA256 if not args.quick else None,
        'statuses': dict(sorted(status_counts.items())),
        'groups': {name: dict(counts) for name, counts in sorted(groups.items())},
        'certificates_checked': certificates, 'compatible_world_paths_checked': world_paths,
        'authorized_action_steps_checked': action_steps, 'maximum_path_actions': maximum_path,
        'maximum_policy_nodes': maximum_nodes, 'exact_costs_above_2pow53_checked': exact_large_costs,
        'oracle_states': oracle_states, 'planner_states': planner_states,
        'planner_transitions': planner_transitions, 'self_checks': self_checks,
        'module_artifacts': artifacts,
        'elapsed_seconds': round(time.monotonic() - started, 3),
        'limitations': ['Finite synthetic models; completeness and permissions remain supplied assertions.',
                        'Deterministic capacity limits are tested; wall-clock timeout timing is not asserted.',
                        'Shared development environment; not a blind evaluation.'],
    }
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(json.dumps({'summary': summary, 'cases': records, 'failures': failures},
                                         indent=2, ensure_ascii=True) + '\n')
    print(json.dumps(summary, indent=2, sort_keys=True))
    return 0 if not failures else 1


if __name__ == '__main__':
    try:
        raise SystemExit(main())
    except (AssertionError, subprocess.TimeoutExpired, json.JSONDecodeError) as error:
        print(f'planner oracle aborted: {error}', file=sys.stderr)
        raise SystemExit(2)
