import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

test('the recorded FALP pilot retains its controls and replays against the exported engine', () => {
  const report = JSON.parse(
    execFileSync(
      process.execPath,
      [fileURLToPath(new URL('../scripts/verify-router-pilot.mjs', import.meta.url))],
      { encoding: 'utf8' },
    ),
  );
  assert.equal(report.status, 'PASS');
  assert.equal(report.replayedEngineCalls, 8);
});
