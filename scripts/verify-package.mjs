import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const work = mkdtempSync(join(tmpdir(), 'motor-package-'));
try {
  const packed = JSON.parse(
    execFileSync('npm', ['pack', '--ignore-scripts', '--json', '--pack-destination', work], {
      cwd: root,
      encoding: 'utf8',
    }),
  )[0];
  const names = packed.files.map((file) => file.path);
  assert.ok(names.includes('dist/index.js'));
  assert.ok(names.includes('dist/index.d.ts'));
  assert.ok(names.includes('dist/falp.d.ts'));
  assert.ok(names.includes('docs/api.md'));
  assert.ok(names.includes('docs/design.md'));
  assert.ok(names.includes('docs/falp-integration.md'));
  assert.ok(!names.some((name) => name.startsWith('tests/') || name.startsWith('.audit/')));
  writeFileSync(join(work, 'package.json'), '{"private":true,"type":"module"}\n');
  execFileSync(
    'npm',
    ['install', '--ignore-scripts', '--no-audit', '--no-fund', join(work, packed.filename)],
    {
      cwd: work,
      stdio: 'pipe',
    },
  );
  const fixture = readFileSync(join(root, 'examples/parity3.json'), 'utf8');
  const executable = join(work, 'node_modules/.bin/motor-matematico');
  const result = JSON.parse(
    execFileSync(executable, ['plan', '-'], { cwd: work, input: fixture, encoding: 'utf8' }),
  );
  assert.equal(result.status, 'planned');
  assert.equal(result.worstCaseCost, '6');
  assert.equal(result.recommendedAction, 'signal_0');
  const imported = execFileSync(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      "import {plan} from '@fegome90/motor-matematico'; import fs from 'node:fs'; process.stdout.write(plan(JSON.parse(fs.readFileSync(0,'utf8'))).worstCaseCost)",
    ],
    { cwd: work, input: fixture, encoding: 'utf8' },
  );
  assert.equal(imported, '6');
  const anchorFixture = readFileSync(join(root, 'examples/anchor-routing.json'), 'utf8');
  const anchorImported = execFileSync(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      "import {compileAnchor,routeAnchor} from '@fegome90/motor-matematico'; import fs from 'node:fs'; const r=routeAnchor(compileAnchor(JSON.parse(fs.readFileSync(0,'utf8')))); process.stdout.write(JSON.stringify([r.route,r.plan.worstCaseCost]))",
    ],
    { cwd: work, input: anchorFixture, encoding: 'utf8' },
  );
  assert.deepEqual(JSON.parse(anchorImported), ['exploratory', '5']);
  const falpConsumer = `
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {compileAnchor, routeFalp, acceptFalpReceipt} from '@fegome90/motor-matematico';
const brief = JSON.parse(fs.readFileSync(0, 'utf8'));
const context = {taskId:'pack-check', revision:'rev-1', anchor:brief.anchor, gate:'allowed'};
const ready = routeFalp({kind:'ready', context, explorationRequested:false});
assert.equal(ready.next, 'readback');
assert.equal(ready.plan, null);
let request = {kind:'investigation', context, classification:'focused', explorationRequested:false, state:compileAnchor(brief)};
const initial = routeFalp(request);
assert.deepEqual([initial.route, initial.observationRoute, initial.next, initial.plan.worstCaseCost], ['focused', 'exploratory', 'observe', '5']);
for (const [questionId, action, outcome, budget] of [
  ['runtime', 'inspect_host', 'native', '3'],
  ['contract', 'locate_contract', 'local', '0'],
]) {
  const dispatch = {taskId:context.taskId, revision:context.revision, anchor:context.anchor, questionId, action};
  const receipt = {...dispatch, status:'SUPPORTED', outcome, source:'tarball-smoke'};
  const result = acceptFalpReceipt(request, dispatch, receipt);
  assert.equal(result.status, 'ACCEPTED');
  assert.equal(result.request.state.model.remainingBudget, budget);
  request = result.request;
  const replay = acceptFalpReceipt(request, dispatch, receipt);
  assert.equal(replay.status, 'DUPLICATE');
  assert.deepEqual(replay.request, request);
}
const final = routeFalp(request);
assert.deepEqual([final.route, final.next, final.plan.status], ['focused', 'reassess', 'solved']);
assert.equal(request.context.anchor, brief.anchor);
assert.equal(request.state.anchor, brief.anchor);
process.stdout.write(JSON.stringify({next:final.next, remainingBudget:request.state.model.remainingBudget}));
`;
  writeFileSync(join(work, 'falp-consumer.mjs'), falpConsumer);
  const falpImported = JSON.parse(
    execFileSync(process.execPath, ['falp-consumer.mjs'], {
      cwd: work,
      input: anchorFixture,
      encoding: 'utf8',
    }),
  );
  assert.deepEqual(falpImported, { next: 'reassess', remainingBudget: '0' });
  console.log(
    JSON.stringify({
      status: 'PASS',
      packedFiles: names.length,
      libraryCost: imported,
      cliCost: result.worstCaseCost,
      falpSession: falpImported,
      runtimeDependencies: 0,
    }),
  );
} finally {
  rmSync(work, { recursive: true, force: true });
}
