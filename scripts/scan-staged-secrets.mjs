import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const reserved =
  /(^|\/)(\.env(?:\..+)?|\.netrc|\.npmrc|id_(?:rsa|ed25519))(?:$|\/)|\.(?:pem|p12|key)$/i;
const objectId = /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/;
const opts = { stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 32 * 1024 * 1024, timeout: 15000 };
const git = (...args) => execFileSync('git', args, opts);
const ref = (...args) => {
  const sha = git(...args)
    .toString('ascii')
    .trim();
  if (!objectId.test(sha)) throw Error();
  return sha;
};
const utf8 = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });
const fields = (bytes) => {
  if (bytes.length && bytes.at(-1) !== 0) throw Error();
  return utf8.decode(bytes).split('\0').slice(0, -1);
};

function run(scratch) {
  const head = ref('rev-parse', '--verify', 'HEAD');
  const tree = ref('write-tree');
  const changed = fields(
    git(
      'diff',
      '--no-ext-diff',
      '--no-textconv',
      '--no-renames',
      '--diff-filter=ACMRT',
      '--name-only',
      '-z',
      head,
      tree,
      '--',
    ),
  );
  const entries = new Map(
    fields(git('ls-tree', '-r', '-z', tree)).map((record) => {
      const split = record.indexOf('\t');
      if (split < 0) throw Error();
      return [record.slice(split + 1), record.slice(0, split).split(' ')];
    }),
  );
  const snapshot = join(scratch, 'files');
  const policy = join(scratch, 'policy.toml');
  mkdirSync(snapshot, { mode: 0o700 });
  for (const path of changed) {
    if (reserved.test(path)) return 'Ruta reservada para credenciales detectada.';
    const parts = path.split('/');
    if (parts.some((p) => !p || p === '.' || p === '..')) throw Error();
    const [mode, type, sha] = entries.get(path) ?? [];
    if (type !== 'blob' || !['100644', '100755'].includes(mode) || !objectId.test(sha)) {
      return 'El índice contiene un cambio de archivo no regular; requiere revisión.';
    }
    const file = join(snapshot, ...parts);
    mkdirSync(dirname(file), { recursive: true, mode: 0o700 });
    writeFileSync(file, git('cat-file', 'blob', sha), { mode: 0o600, flag: 'wx' });
  }
  if (changed.length) {
    writeFileSync(policy, git('cat-file', 'blob', `${head}:.gitleaks.toml`), {
      mode: 0o600,
      flag: 'wx',
    });
    try {
      execFileSync(
        'gitleaks',
        [
          'dir',
          '--config',
          policy,
          '--redact=100',
          '--no-banner',
          '--ignore-gitleaks-allow',
          '--gitleaks-ignore-path',
          '/dev/null',
          snapshot,
        ],
        { stdio: 'ignore', timeout: 60000 },
      );
    } catch {
      return 'Gitleaks detectó un posible secreto o no pudo completar el análisis.';
    }
  }
  if (ref('write-tree') !== tree || ref('rev-parse', '--verify', 'HEAD') !== head) {
    return 'El índice o HEAD cambió durante el chequeo; vuelve a ejecutarlo.';
  }
}

try {
  const message = run(process.argv[2]);
  if (message) {
    console.error(message);
    process.exitCode = 1;
  } else {
    console.log('Sin hallazgos en el chequeo de secretos y rutas reservadas.');
  }
} catch {
  console.error('No se pudo verificar una copia exacta del índice.');
  process.exitCode = 1;
}
