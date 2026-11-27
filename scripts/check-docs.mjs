import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, posix } from "node:path";

const repo = execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim();
process.chdir(repo);
const tracked = new Set(execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" }).split("\0").filter(Boolean));
const docs = [...tracked].filter(p => p.endsWith(".md"));
const utf8 = new TextDecoder("utf-8", { fatal: true });
let failures = 0;
for (const file of docs) {
  let lines;
  try { lines = utf8.decode(readFileSync(file)).split("\n"); }
  catch { console.error(`${file}: no se pudo leer como UTF-8`); failures++; continue; }
  let fenced;
  for (const [i, line] of lines.entries()) {
    const fence = /^\s*(`{3,}|~{3,})/.exec(line)?.[1];
    if (fence) {
      if (!fenced) fenced = fence;
      else if (fence[0] === fenced[0] && fence.length >= fenced.length && line.trim() === fence) fenced = undefined;
      continue;
    }
    if (fenced) continue;
    for (const [, target] of line.replace(/`[^`]*`/g, "").matchAll(/\]\(([^\s)]+)\)/g)) {
      if (/^(?:[a-z][a-z0-9+.-]*:|#|\/\/)/i.test(target)) continue;
      let path;
      try { path = posix.normalize(posix.join(dirname(file), decodeURIComponent(target.split(/[?#]/, 1)[0]))); }
      catch { path = null; }
      if (!path || target.startsWith("/") || path.startsWith("../") || (!tracked.has(path) && ![...tracked].some(p => p.startsWith(path.replace(/\/$/, "") + "/")))) {
        console.error(`${file}:${i+1}: destino local no versionado`);
        failures++;
      }
    }
  }
}
if (!docs.length || failures) process.exit(1);
console.log(`Verificados UTF-8 y destinos de enlaces locales en ${docs.length} documentos.`);
