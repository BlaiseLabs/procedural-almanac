// node tests/run.mjs (npm test): every check of every entry, then the almanac held to itself: every export has an
// entry, every entry is complete for its kind, every reference it names exists (in the code's comments too), every
// test it lists is a real check, and the catalog and the gallery are up to date.
import { readFileSync, readdirSync, existsSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import * as A from '../src/index.js';
import { buildCatalog, signatures } from '../tools/catalog.mjs';
import { buildGallery } from '../tools/gallery.mjs';

const root = new URL('../', import.meta.url).pathname;
// every check, from every file in tests/checks/ (each check knows its file, for the catalog)
const CHECKS = [];
for (const f of readdirSync(new URL('./checks/', import.meta.url))
  .filter((f) => f.endsWith('.mjs'))
  .sort())
  for (const c of (await import(`./checks/${f}`)).CHECKS) CHECKS.push({ ...c, file: `tests/checks/${f}` });
const read = (f) => readFileSync(root + f, 'utf8');
const fails = [],
  say = (ok, line) => {
    console.log((ok ? 'ok   ' : 'FAIL ') + line);
    if (!ok) fails.push(line);
  };

// ---------------------------------------------------------------- the checks
for (const c of CHECKS) {
  try {
    await c.run();
    say(true, `${c.entry}: ${c.says}`);
  } catch (e) {
    say(false, `${c.entry}: ${c.says}\n       ${String(e.message).split('\n')[0]}`);
  }
}

// ---------------------------------------------------------------- the almanac, held to itself
const almanac = JSON.parse(read('almanac.json')),
  refs = JSON.parse(read('references.json')),
  byId = new Map(refs.map((r) => [r.id, r]));
const entries = { ...almanac.established, ...almanac.original },
  kindOf = (name) => (name in almanac.established ? 'established' : 'original');
const problems = [],
  bad = (m) => problems.push(m);

// every export has an entry, and every entry is an export
for (const file of readdirSync(root + 'src').filter((f) => f.endsWith('.js') && f !== 'index.js'))
  for (const name of Object.keys(await import(`../src/${file}`)))
    if (!(name in A)) bad(`src/${file} exports ${name}, but src/index.js does not (so it has escaped the almanac)`);
for (const name of Object.keys(A)) if (!entries[name]) bad(`${name} is exported but has no entry in almanac.json`);
for (const name of Object.keys(entries))
  if (!(name in A)) bad(`${name} has an entry but is not exported by src/index.js`);
for (const name of Object.keys(almanac.established))
  if (name in almanac.original) bad(`${name} is both established and original`);

// every entry is complete for its kind, and holds nothing else
const FIELDS = {
  established: { need: ['does', 'sources', 'tests'], may: ['notes', 'picture'] },
  original: { need: ['does', 'purpose', 'inspiration', 'buildsOn', 'inWords', 'tests'], may: ['picture'] },
};
const INSPIRATION = ['observation', 'art', 'code', 'established'];
const refsOf = (e) => [
  ...(e.sources ? [...e.sources.intro, ...e.sources.source] : []),
  ...(e.inspiration || []).flatMap((i) => i.refs || []),
];
const used = new Set();
for (const [name, e] of Object.entries(entries)) {
  const kind = kindOf(name),
    F = FIELDS[kind];
  for (const k of F.need)
    if (e[k] === undefined || e[k] === '' || (Array.isArray(e[k]) && !e[k].length && k !== 'buildsOn'))
      bad(`${name} (${kind}) has no ${k}`);
  for (const k of Object.keys(e))
    if (!F.need.includes(k) && !F.may.includes(k)) bad(`${name} (${kind}) has a field "${k}" its kind does not have`);
  if (kind === 'established') {
    if (!e.sources || !Array.isArray(e.sources.intro) || !Array.isArray(e.sources.source))
      bad(`${name}: sources is { intro: [...], source: [...] }`);
    else if (!e.sources.intro.length && !e.sources.source.length) bad(`${name} is established but cites nothing`);
  } else {
    for (const i of e.inspiration || []) {
      if (!INSPIRATION.includes(i.kind))
        bad(`${name}: inspiration of kind "${i.kind}" (one of: ${INSPIRATION.join(', ')})`);
      if (!i.text) bad(`${name}: an inspiration with no text`);
    }
    for (const b of e.buildsOn || []) if (!entries[b]) bad(`${name} builds on "${b}", which is not an entry`);
  }
  for (const id of refsOf(e)) {
    if (!byId.has(id)) bad(`${name} cites "${id}", which is not in references.json`);
    used.add(id);
  }
  if (e.picture && !existsSync(root + e.picture)) bad(`${name}: its picture ${e.picture} does not exist`);
}
for (const r of refs) if (!used.has(r.id)) bad(`reference "${r.id}" is not cited by any entry`);

// the references are CSL-JSON: a unique id, a CSL type, a title, and a DOI or a link
const CSL_TYPES =
  'article article-journal article-magazine article-newspaper bill book broadcast chapter classic collection dataset document entry entry-dictionary entry-encyclopedia event figure graphic hearing interview legal_case legislation manuscript map motion_picture musical_score pamphlet paper-conference patent performance periodical personal_communication post post-weblog regulation report review review-book software song speech standard thesis treaty webpage'.split(
    ' ',
  );
if (byId.size !== refs.length) bad('two references share an id');
for (const r of refs) {
  if (!CSL_TYPES.includes(r.type)) bad(`reference ${r.id}: "${r.type}" is not a CSL type`);
  if (!r.title) bad(`reference ${r.id} has no title`);
  if (!r.DOI && !r.URL) bad(`reference ${r.id} has neither a DOI nor a URL`);
}

// every test an entry lists is a real check of it, and every check is listed
for (const [name, e] of Object.entries(entries))
  for (const t of e.tests || [])
    if (!CHECKS.some((c) => c.entry === name && c.says === t))
      bad(`${name} lists the test "${t}", but no check says that`);
for (const c of CHECKS)
  if (!(entries[c.entry]?.tests || []).includes(c.says))
    bad(`the check "${c.says}" (${c.entry}) is not listed in almanac.json`);

// the code cites what its entry cites: each export's doc comment names exactly its entry's references with @see, and
// every [reference] in a comment exists
for (const file of readdirSync(root + 'src').filter((f) => f.endsWith('.js'))) {
  const src = read('src/' + file);
  for (const m of src.matchAll(/\/\*\*((?:(?!\*\/)[^])*)\*\/\s*export (?:function|class|const) (\w+)/g)) {
    const [, doc, name] = m;
    if (!entries[name]) continue;
    const seen = [...doc.matchAll(/@see ([\w-]+)/g)].map((x) => x[1]).sort(),
      want = [...new Set(refsOf(entries[name]))].sort();
    if (seen.join() !== want.join())
      bad(
        `src/${file} ${name}: @see ${seen.join(', ') || '(none)'}, but its entry cites ${want.join(', ') || '(none)'}`,
      );
  }
  for (const m of src.matchAll(/\/\/[^\n]*\[([a-z0-9-]+)\]/g))
    if (!byId.has(m[1])) bad(`src/${file}: a comment cites [${m[1]}], which is not in references.json`);
}

// the gallery's pictures are well-formed SVG: no attribute twice in a tag, and every tag closed (a picture that is not
// well-formed XML shows nowhere, GitHub included)
for (const [file, content] of Object.entries(buildGallery())) {
  for (const tag of content.match(/<[a-z][^>]*>/g) || []) {
    const names = [...tag.matchAll(/\s([\w:-]+)=/g)].map((m) => m[1]);
    if (new Set(names).size !== names.length) bad(`${file}: an attribute given twice in ${tag.slice(0, 60)}`);
  }
  const open = (content.match(/<[a-z][^>]*[^/]>|<[a-z]+>/g) || []).length,
    close = (content.match(/<\/[a-z]+>/g) || []).length;
  if (open !== close) bad(`${file}: ${open} tags opened, ${close} closed`);
}
// the README's example runs, as written (its import pointed at this copy of the almanac)
{
  const blocks = [...read('README.md').matchAll(/```js\n([^]*?)```/g)].map((m) => m[1]);
  if (!blocks.length) bad('README.md has no example to run');
  for (const [i, code] of blocks.entries()) {
    const file = join(tmpdir(), `almanac-readme-${process.pid}-${i}.mjs`);
    writeFileSync(file, code.replaceAll("'procedural-almanac'", `'${pathToFileURL(root + 'src/index.js').href}'`));
    try {
      await import(pathToFileURL(file).href);
    } catch (e) {
      bad(`README.md example ${i + 1} does not run: ${e.message}`);
    } finally {
      rmSync(file);
    }
  }
}

// the catalog can say how each entry is called, and each entry's checks are in its module's checks file
{
  const S = signatures();
  for (const name of Object.keys(entries)) {
    if (!S[name]) {
      bad(
        `${name}: the catalog cannot find how it is called (export it as a function, a class or a const arrow function)`,
      );
      continue;
    }
    const want = `tests/checks/${S[name].module.slice(4, -3)}.mjs`;
    for (const c of CHECKS.filter((c) => c.entry === name && c.file !== want))
      bad(`the check "${c.says}" (${name}) is in ${c.file}, not ${want}`);
  }
}
// the catalog and the gallery are what the almanac and the code make now
if (!problems.length && (!existsSync(root + 'CATALOG.md') || read('CATALOG.md') !== buildCatalog()))
  bad('CATALOG.md is stale: npm run docs');
for (const [file, content] of Object.entries(buildGallery()))
  if (!existsSync(root + file) || read(file) !== content) bad(`${file} is stale: npm run docs`);

for (const p of problems) say(false, p);
if (!problems.length)
  say(
    true,
    `the almanac holds together: ${Object.keys(entries).length} entries (${Object.keys(almanac.established).length} established, ${Object.keys(almanac.original).length} original), ${refs.length} references, ${CHECKS.length} checks`,
  );
console.log(fails.length ? `\n${fails.length} FAILED` : `\nall ${CHECKS.length + 1} passed`);
process.exit(fails.length ? 1 : 0);
