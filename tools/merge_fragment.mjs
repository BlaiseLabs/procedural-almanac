// node tools/merge_fragment.mjs <fragment.json>
// Adds a set of entries to the almanac's shared files in one step, under a lock, so several people (or agents) can add
// entries at once without losing each other's: almanac.json (established and original entries), references.json,
// src/index.js (each module's export line), CHANGELOG.md ([Unreleased] / Added). A fragment:
//   { "established": { name: entry }, "original": { name: entry }, "references": [ reference ],
//     "exports": [ { "module": "raster", "names": ["fbSpan", ...] } ], "changelog": [ "- `raster` (new): ..." ] }
// An entry or reference already there is replaced (so a fragment can be merged again after a fix). Run npm run docs and
// npm test after.
import { readFileSync, writeFileSync, openSync, closeSync, unlinkSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const ROOT = new URL('../', import.meta.url).pathname,
  LOCK = ROOT + '.merge.lock';
const frag = JSON.parse(readFileSync(process.argv[2], 'utf8'));

// a lock file made only if it is not there (a merge left half done would hold it: one older than a minute is stale)
function lock() {
  for (let i = 0; i < 600; i++) {
    try {
      return closeSync(openSync(LOCK, 'wx'));
    } catch (e) {
      try {
        if (Date.now() - statSync(LOCK).mtimeMs > 60000) unlinkSync(LOCK);
      } catch (e2) {
        /* gone meanwhile */
      }
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100);
    }
  }
  throw new Error('the merge lock stayed held for a minute');
}

lock();
try {
  const A = JSON.parse(readFileSync(ROOT + 'almanac.json', 'utf8'));
  for (const kind of ['established', 'original'])
    for (const [name, entry] of Object.entries(frag[kind] || {})) A[kind][name] = entry;
  writeFileSync(ROOT + 'almanac.json', JSON.stringify(A, null, 2) + '\n');

  const R = JSON.parse(readFileSync(ROOT + 'references.json', 'utf8'));
  for (const ref of frag.references || []) {
    const i = R.findIndex((r) => r.id === ref.id);
    i >= 0 ? (R[i] = ref) : R.push(ref);
  }
  writeFileSync(ROOT + 'references.json', JSON.stringify(R, null, 2) + '\n');

  let idx = readFileSync(ROOT + 'src/index.js', 'utf8');
  for (const { module, names } of frag.exports || []) {
    const re = new RegExp(`export \\{([^}]*)\\} from '\\./${module}\\.js';`);
    const m = idx.match(re);
    if (m) {
      const have = m[1].split(',').map((s) => s.trim()).filter(Boolean),
        all = [...have, ...names.filter((n) => !have.includes(n))];
      idx = idx.replace(re, `export { ${all.join(', ')} } from './${module}.js';`);
    } else idx = idx.trimEnd() + `\nexport { ${names.join(', ')} } from './${module}.js';\n`;
  }
  writeFileSync(ROOT + 'src/index.js', idx);

  if ((frag.changelog || []).length) {
    let log = readFileSync(ROOT + 'CHANGELOG.md', 'utf8');
    const at = log.indexOf('### Added', log.indexOf('## [Unreleased]'));
    const end = log.indexOf('\n', at) + 1;
    const add = frag.changelog.filter((l) => !log.includes(l)).join('\n');
    if (add) log = log.slice(0, end) + '\n' + add + '\n' + log.slice(end);
    writeFileSync(ROOT + 'CHANGELOG.md', log);
  }
  // laid out as the rest of the repository is (prettier), so a merge changes only what it adds
  execFileSync(ROOT + 'node_modules/.bin/prettier', ['--write', 'almanac.json', 'references.json', 'src/index.js'], { cwd: ROOT, stdio: 'ignore' });
  console.log(
    `merged: ${Object.keys(frag.established || {}).length + Object.keys(frag.original || {}).length} entries, ${(frag.references || []).length} references, ${(frag.exports || []).length} export lines`,
  );
} finally {
  unlinkSync(LOCK);
}
