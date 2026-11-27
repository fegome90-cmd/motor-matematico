import { strict as assert } from "node:assert";
import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), "motor-matematico-staged-test-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const scripts = join(root, "scripts"), bin = join(root, "bin"), tmp = join(root, "tmp");
  for (const dir of [scripts, bin, tmp]) mkdirSync(dir);
  for (const file of ["check-secrets.sh", "scan-staged-secrets.mjs"]) {
    copyFileSync(new URL(file, import.meta.url), join(scripts, file));
  }
  const run = (command, args, more = {}) => spawnSync(command, args, {
    cwd: root, encoding: "utf8",
    env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, TMPDIR: tmp,
      GIT_AUTHOR_NAME: "Fixture", GIT_COMMITTER_NAME: "Fixture",
      GIT_AUTHOR_EMAIL: "test@example.invalid", GIT_COMMITTER_EMAIL: "test@example.invalid", ...more },
  });
  const git = (...args) => {
    const result = run("git", args);
    assert.equal(result.status, 0, result.stderr);
  };
  const put = (file, value) => writeFileSync(join(root, file), value);
  git("init", "-q");
  put(".gitleaks.toml", "title = 'trusted fixture'\n");
  git("add", ".gitleaks.toml");
  git("-c", "commit.gpgsign=false", "-c", "core.hooksPath=/dev/null", "commit", "-qm", "fixture policy");
  writeFileSync(join(bin, "gitleaks"), `#!/usr/bin/env node
const fs = require("node:fs"), path = require("node:path"), assert = require("node:assert").strict;
const args = process.argv.slice(2);
assert.equal(args[0], "dir");
assert.match(fs.readFileSync(args[args.indexOf("--config") + 1], "utf8"), /trusted fixture/);
assert.equal(fs.readFileSync(path.join(args.at(-1), "sample file.txt"), "utf8"), "staged example");
if (process.env.FIXTURE_RESULT === "index-change") {
  require("node:child_process").execFileSync("git", ["add", "sample file.txt"]);
}
if (process.env.FIXTURE_RESULT === "failure") {
  console.error("scanner details are not for the user log");
  process.exit(1);
}
`, { mode: 0o700 });
  return { git, put, scan: extra => run("bash", ["scripts/check-secrets.sh", "staged"], extra),
    empty: () => assert.deepEqual(readdirSync(tmp), []) };
}

test("scans exact index bytes, uses committed policy and cleans the copy", t => {
  const f = fixture(t);
  f.put("sample file.txt", "staged example");
  f.git("add", "sample file.txt");
  f.put("sample file.txt", "worktree edit");
  f.put(".gitleaks.toml", "title = 'uncommitted policy'\n");
  const r = f.scan();
  assert.equal(r.status, 0, r.stderr);
  f.empty();
});

test("scanner failures do not print its details and still clean the copy", t => {
  const f = fixture(t);
  f.put("sample file.txt", "staged example");
  f.git("add", "sample file.txt");
  const r = f.scan({ FIXTURE_RESULT: "failure" });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /no pudo completar/);
  assert.doesNotMatch(r.stderr, /scanner details/);
  f.empty();
});

test("a reserved filename is rejected without printing it", t => {
  const f = fixture(t);
  f.put(".env.sample", "benign example");
  f.git("add", ".env.sample");
  const r = f.scan();
  assert.equal(r.status, 1);
  assert.match(r.stderr, /Ruta reservada/);
  assert.doesNotMatch(r.stderr, /\.env\.sample/);
  f.empty();
});

test("changing the index during the scan requires a fresh check", t => {
  const f = fixture(t);
  f.put("sample file.txt", "staged example");
  f.git("add", "sample file.txt");
  f.put("sample file.txt", "new example");
  const r = f.scan({ FIXTURE_RESULT: "index-change" });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /índice o HEAD cambió/);
  f.empty();
});
