// node tools/catalog.mjs: CATALOG.md, from almanac.json (the entries) and references.json (the sources, in CSL-JSON).
// Edit those two; this file is written from them, and tests/run.mjs fails when it is stale.
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';

const root = new URL('../', import.meta.url).pathname;
const read = (f) => JSON.parse(readFileSync(root + f, 'utf8'));

// where each export is defined, and how it is called (from the code, so the catalog cannot disagree with it)
export function signatures() {
  const out = {};
  for (const file of readdirSync(root + 'src').filter((f) => f.endsWith('.js'))) {
    const src = readFileSync(root + 'src/' + file, 'utf8');
    for (const m of src.matchAll(/^export function (\w+)\(([^)]*)\)/gm))
      out[m[1]] = { module: `src/${file}`, call: `${m[1]}(${m[2].replace(/\s*=\s*[^,]+/g, '')})` };
    for (const m of src.matchAll(/^export const (\w+) =\s*\(([^)]*)\)\s*=>/gm))
      out[m[1]] = { module: `src/${file}`, call: `${m[1]}(${m[2].replace(/\s*=\s*[^,]+/g, '')})` };
    for (const m of src.matchAll(/^export class (\w+)[^]*?constructor\(([^)]*)\)/gm))
      out[m[1]] = { module: `src/${file}`, call: `new ${m[1]}(${m[2]})` };
  }
  return out;
}

// a reference in a reader's form: authors (year). Title. Where. Link
export function cite(r) {
  const names = (r.author || []).map(
    (a) => [a.family, a.given].filter(Boolean).join(', ') + (a.suffix ? ' ' + a.suffix : ''),
  );
  const who = names.length > 2 ? names.slice(0, -1).join('; ') + '; and ' + names.at(-1) : names.join(' and ');
  const year = r.issued ? r.issued['date-parts'][0][0] : null;
  const where = [
    r['container-title'] && `*${r['container-title']}*`,
    r.volume && (r.issue ? `${r.volume}(${r.issue})` : r.volume),
    r.page && r.page.replace('-', '–'),
    r['collection-title'] && r.number && `${r['collection-title']} ${r.number}`,
    r.publisher && (r['publisher-place'] ? `${r['publisher-place']}: ${r.publisher}` : r.publisher),
  ]
    .filter(Boolean)
    .join(', ');
  const link = r.DOI ? `https://doi.org/${r.DOI}` : r.URL;
  const read =
    r.accessed && !r.DOI
      ? ` (read ${r.accessed['date-parts'][0].map((n) => String(n).padStart(2, '0')).join('-')})`
      : '';
  return [
    who && `${who}${year ? ` (${year})` : ''}.`,
    !who && year && `(${year}).`,
    `${r.title}.`,
    where && `${where}.`,
    r.note && `${r.note[0].toUpperCase()}${r.note.slice(1)}.`,
    `<${link}>${read}`,
  ]
    .filter(Boolean)
    .join(' ');
}

export function buildCatalog() {
  const A = read('almanac.json'),
    R = Object.fromEntries(read('references.json').map((r) => [r.id, r])),
    S = signatures();
  const ref = (id) => `[${R[id].title}](#ref-${id})`,
    anchor = (name) => `[${name}](#${name.toLowerCase()})`;
  const out = [
    '# The catalog',
    '',
    '*Written from [almanac.json](almanac.json) and [references.json](references.json) by `npm run docs`: edit those, not this.*',
    '',
    'Each entry documents a single function or class. Established techniques include references to the original work, with an intro for accessible background reading (often an encyclopedia article) and a source pointing to a paper, book, standard, or published implementation. Original techniques are developed specifically for this almanac. Rather than citing an external source, their entries explain what they do, what inspired them, which ideas they build on, and how they work in plain language.',
    '',
    "Every entry also lists its tests, with a short description of what each test verifies. These descriptions are checked against the actual test suite, so the tests fail if a documented check doesn't exist.",
    '',
    '| entry | kind | what it does |',
    '|---|---|---|',
  ];
  for (const kind of ['established', 'original'])
    for (const [name, e] of Object.entries(A[kind])) out.push(`| ${anchor(name)} | ${kind} | ${e.does} |`);
  const tests = (e, name) => [
    `**Tests** (\`tests/checks/${S[name].module.slice(4, -3)}.mjs\`)`,
    '',
    ...e.tests.map((t) => `- ${t}`),
    '',
  ];
  const head = (name, e) => [
    `### ${name}`,
    '',
    `\`${S[name].call}\` in [${S[name].module}](${S[name].module})`,
    '',
    e.does[0].toUpperCase() + e.does.slice(1) + '.',
    '',
  ];
  out.push('', '## Established techniques', '');
  for (const [name, e] of Object.entries(A.established)) {
    out.push(...head(name, e), '**Sources**', '');
    for (const id of e.sources.intro) out.push(`- intro: ${ref(id)}`);
    for (const id of e.sources.source) out.push(`- source: ${ref(id)}`);
    out.push('');
    if (e.notes) out.push(`**Notes** ${e.notes}`, '');
    if (e.picture) out.push(`![${name}](${e.picture})`, '');
    out.push(...tests(e, name));
  }
  out.push('## Originals', '');
  for (const [name, e] of Object.entries(A.original)) {
    out.push(
      ...head(name, e),
      `**Purpose** ${e.purpose[0].toUpperCase() + e.purpose.slice(1)}.`,
      '',
      '**Inspiration**',
      '',
    );
    for (const i of e.inspiration)
      out.push(`- ${i.kind}: ${i.text}${i.refs ? ` (${i.refs.map(ref).join(', ')})` : ''}`);
    out.push('');
    if (e.buildsOn.length) out.push(`**Builds on** ${e.buildsOn.map(anchor).join(', ')}`, '');
    out.push(`**In words** ${e.inWords}`, '');
    if (e.picture) out.push(`![${name}](${e.picture})`, '');
    out.push(...tests(e, name));
  }
  out.push(
    '## References',
    '',
    '*In [CSL-JSON](https://citationstyles.org/) in references.json, so a reference manager can read them.*',
    '',
  );
  for (const r of Object.values(R).sort((a, b) => a.title.localeCompare(b.title)))
    out.push(`- <a id="ref-${r.id}"></a>${cite(r)}`);
  return out.join('\n') + '\n';
}

if (import.meta.url === `file://${process.argv[1]}`) {
  writeFileSync(root + 'CATALOG.md', buildCatalog());
  console.log('CATALOG.md written');
}
