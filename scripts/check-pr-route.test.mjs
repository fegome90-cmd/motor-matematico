import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { checkPullRequestRoute } from "./check-pr-route.mjs";

const repository = "fegome90-cmd/motor-matematico";
const context = { eventName: "pull_request", repository };
const script = fileURLToPath(new URL("./check-pr-route.mjs", import.meta.url));

function event(head, base, headRepository = repository) {
  return {
    repository: { full_name: repository },
    pull_request: {
      head: { ref: head, repo: { full_name: headRepository } },
      base: { ref: base, repo: { full_name: repository } },
    },
  };
}

function runEvent(text, env = {}) {
  const dir = mkdtempSync(join(tmpdir(), "motor-pr-route-"));
  try {
    const path = join(dir, "event.json");
    writeFileSync(path, text);
    return spawnSync(process.execPath, [script], {
      encoding: "utf8",
      timeout: 5000,
      env: {
        GITHUB_EVENT_PATH: path,
        GITHUB_EVENT_NAME: "pull_request",
        GITHUB_REPOSITORY: repository,
        ...env,
      },
    });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test("allows work PRs and the two same-repository promotions", () => {
  const cases = [
    ["chore/github-governance", "developer", repository, "work-to-developer"],
    ["fix/invariant", "developer", "contributor/motor-fork", "work-to-developer"],
    ["developer", "tester", repository, "developer-to-tester"],
    ["tester", "main", repository, "tester-to-main"],
  ];
  for (const [head, base, origin, route] of cases) {
    assert.deepEqual(checkPullRequestRoute(event(head, base, origin), context), {
      allowed: true,
      route,
    });
  }
});

test("rejects permanent branches as work and invalid promotion origins", () => {
  for (const [head, base] of [
    ["main", "developer"], ["tester", "developer"], ["developer", "developer"],
    ["feature/math", "tester"], ["main", "tester"], ["tester", "tester"],
    ["feature/math", "main"], ["developer", "main"], ["main", "main"],
  ]) {
    assert.deepEqual(checkPullRequestRoute(event(head, base), context), {
      allowed: false,
      reason: "invalid-source-branch",
    });
  }
  assert.equal(checkPullRequestRoute(event("topic", "release"), context).reason, "unsupported-target");
});

test("matching branch names in a fork do not authorize promotions", () => {
  for (const [head, base] of [["developer", "tester"], ["tester", "main"]]) {
    assert.deepEqual(checkPullRequestRoute(event(head, base, "other/motor-matematico"), context), {
      allowed: false,
      reason: "fork-promotion",
    });
  }
});

test("requires both base and event repository to match trusted workflow context", () => {
  for (const mutate of [
    (e) => { e.repository.full_name = "other/project"; },
    (e) => { e.pull_request.base.repo.full_name = "other/project"; },
  ]) {
    const payload = event("tester", "main");
    mutate(payload);
    assert.equal(checkPullRequestRoute(payload, context).reason, "repository-mismatch");
  }
  const payload = event("tester", "main", repository.toUpperCase());
  payload.repository.full_name = repository.toUpperCase();
  assert.equal(checkPullRequestRoute(payload, context).allowed, true);
  assert.equal(checkPullRequestRoute(event("Tester", "main"), context).allowed, false);
});

test("missing, deleted, malformed, or unsupported event fields fail closed", () => {
  const malformed = [null, [], {}, { repository: {} }, { pull_request: {} }];
  for (const payload of malformed) {
    assert.equal(checkPullRequestRoute(payload, context).allowed, false);
  }
  for (const mutate of [
    (e) => { delete e.pull_request.head; },
    (e) => { e.pull_request.head.repo = null; },
    (e) => { delete e.pull_request.base.repo.full_name; },
    (e) => { e.pull_request.head.repo.full_name = "owner/repo/extra"; },
    (e) => { e.pull_request.head.repo.full_name = `${repository}\n`; },
    (e) => { e.repository.full_name = 123; },
    (e) => { e.pull_request.base = []; },
  ]) {
    const payload = event("tester", "main");
    mutate(payload);
    assert.equal(checkPullRequestRoute(payload, context).allowed, false);
  }
  for (const ctx of [null, {}, { ...context, eventName: "push" }, { ...context, eventName: "pull_request_target" }, { ...context, repository: "" }]) {
    assert.equal(checkPullRequestRoute(event("tester", "main"), ctx).allowed, false);
  }
});

test("validates refs before allowing a work branch", () => {
  for (const head of [undefined, 1, "", "@", "-topic", "topic name", "topic\nname", "a..b", "a@{b", "a\\b", "a:b", "a[b", "a*", "a?", "a~b", "a^b", ".hidden", "a/.hidden", "a.lock", "a.lock/b", "a.", "a//b", "/a", "a/"]) {
    assert.equal(checkPullRequestRoute(event(head, "developer"), context).allowed, false);
  }
  assert.equal(checkPullRequestRoute(event("feature/x", "main\n"), context).allowed, false);
});

test("CLI accepts a valid promotion and rejects unauthorized routes without title, label, or env bypass", () => {
  const accepted = runEvent(JSON.stringify(event("developer", "tester")));
  assert.equal(accepted.status, 0, accepted.stderr);
  assert.match(accepted.stdout, /developer-to-tester/);

  const payload = event("chore/bootstrap", "main");
  payload.pull_request.title = "Bootstrap exception approved";
  payload.pull_request.labels = [{ name: "bypass" }];
  const rejected = runEvent(JSON.stringify(payload), { ALLOW_BOOTSTRAP: "true", SKIP_PR_GATE: "1" });
  assert.equal(rejected.status, 1);
  assert.match(rejected.stderr, /invalid-source-branch/);
  assert.equal(rejected.stdout, "");
});

test("CLI fails closed for invalid JSON, missing path, wrong event and absent context", () => {
  for (const [text, env, reason] of [
    ["not json", {}, "unreadable-event"],
    [JSON.stringify(event("tester", "main")), { GITHUB_EVENT_PATH: "" }, "missing-event-path"],
    [JSON.stringify(event("tester", "main")), { GITHUB_EVENT_NAME: "push" }, "unsupported-event"],
    [JSON.stringify(event("tester", "main")), { GITHUB_REPOSITORY: "" }, "invalid-context-repository"],
    ["{}", {}, "incomplete-event"],
  ]) {
    const result = runEvent(text, env);
    assert.equal(result.status, 1);
    assert.match(result.stderr, new RegExp(reason));
    assert.equal(result.stdout, "");
  }
});
