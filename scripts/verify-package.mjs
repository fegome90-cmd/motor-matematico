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
  assert.ok(names.includes('docs/api.md'));
  assert.ok(names.includes('docs/design.md'));
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
  console.log(
    JSON.stringify({
      status: 'PASS',
      packedFiles: names.length,
      libraryCost: imported,
      cliCost: result.worstCaseCost,
      runtimeDependencies: 0,
    }),
  );
} finally {
  rmSync(work, { recursive: true, force: true });
}
