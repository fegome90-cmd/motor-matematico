import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const permanentBranches = new Set(['developer', 'tester', 'main']);
const reject = (reason) => ({ allowed: false, reason });

function isObject(value) {
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

function repositoryName(value) {
  if (typeof value !== 'string') return null;
  const match = /^[A-Za-z0-9][A-Za-z0-9-]{0,38}\/[A-Za-z0-9._-]{1,100}$/.exec(value);
  if (!match || match[0] !== value) {
    return null;
  }
  const name = value.split('/')[1];
  return name === '.' || name === '..' ? null : value.toLowerCase();
}

function isBranch(value) {
  if (typeof value !== 'string' || value.length === 0) return false;
  if (value === '@' || value.startsWith('-') || value.endsWith('.')) return false;
  const forbiddenBranchPunctuation = new Set(['~', '^', ':', '?', '*', '[', '\\']);
  for (const char of value) {
    const code = char.charCodeAt(0);
    if (code <= 32 || code === 127 || forbiddenBranchPunctuation.has(char)) return false;
  }
  if (value.includes('..') || value.includes('@{')) return false;
  return value
    .split('/')
    .every((part) => part.length > 0 && !part.startsWith('.') && !part.endsWith('.lock'));
}

/** Validate metadata only. Review, CI, and merge authorization are separate gates. */
export function checkPullRequestRoute(event, context) {
  if (!isObject(context) || context.eventName !== 'pull_request') {
    return reject('unsupported-event');
  }
  const expectedRepository = repositoryName(context.repository);
  if (!expectedRepository) return reject('invalid-context-repository');
  if (!isObject(event) || !isObject(event.repository) || !isObject(event.pull_request)) {
    return reject('incomplete-event');
  }
  const { base, head } = event.pull_request;
  if (!isObject(base) || !isObject(head) || !isObject(base.repo) || !isObject(head.repo)) {
    return reject('incomplete-pull-request');
  }
  const eventRepository = repositoryName(event.repository.full_name);
  const baseRepository = repositoryName(base.repo.full_name);
  const headRepository = repositoryName(head.repo.full_name);
  if (!eventRepository || !baseRepository || !headRepository) {
    return reject('invalid-repository-name');
  }
  if (eventRepository !== expectedRepository || baseRepository !== expectedRepository) {
    return reject('repository-mismatch');
  }
  if (!isBranch(base.ref) || !isBranch(head.ref)) return reject('invalid-branch-name');

  if (base.ref === 'developer') {
    return permanentBranches.has(head.ref)
      ? reject('invalid-source-branch')
      : { allowed: true, route: 'work-to-developer' };
  }
  if (base.ref !== 'tester' && base.ref !== 'main') return reject('unsupported-target');
  if (headRepository !== expectedRepository) return reject('fork-promotion');
  const requiredSource = base.ref === 'tester' ? 'developer' : 'tester';
  return head.ref === requiredSource
    ? { allowed: true, route: `${requiredSource}-to-${base.ref}` }
    : reject('invalid-source-branch');
}

export function checkEventFile(env) {
  if (!env || typeof env.GITHUB_EVENT_PATH !== 'string' || env.GITHUB_EVENT_PATH.length === 0) {
    return reject('missing-event-path');
  }
  let event;
  try {
    event = JSON.parse(readFileSync(env.GITHUB_EVENT_PATH, 'utf8'));
  } catch {
    return reject('unreadable-event');
  }
  return checkPullRequestRoute(event, {
    eventName: env.GITHUB_EVENT_NAME,
    repository: env.GITHUB_REPOSITORY,
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = checkEventFile(process.env);
  if (result.allowed) {
    console.log(`PR route accepted: ${result.route}.`);
  } else {
    console.error(`PR route rejected: ${result.reason}.`);
    process.exitCode = 1;
  }
}
