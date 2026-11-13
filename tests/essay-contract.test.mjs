// Fault-injection tests for the essay sourcing contract. Runs the real
// scripts/build-essay.mjs inside a throwaway copy of the repo layout, so its
// output write lands in the temp tree, never in src/data/essay.json.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = join(dirname(fileURLToPath(import.meta.url)), '..');
const tmpDirs = [];
after(() => tmpDirs.forEach((d) => rmSync(d, { recursive: true, force: true })));

function run(mutate) {
  const dir = mkdtempSync(join(tmpdir(), 'cc-essay-'));
  tmpDirs.push(dir);
  mkdirSync(join(dir, 'scripts'));
  mkdirSync(join(dir, 'src', 'data'), { recursive: true });
  cpSync(join(repo, 'scripts', 'build-essay.mjs'), join(dir, 'scripts', 'build-essay.mjs'));
  cpSync(join(repo, 'data', 'essay'), join(dir, 'data', 'essay'), { recursive: true });
  const p = join(dir, 'data', 'essay', 'last-mile.json');
  const j = JSON.parse(readFileSync(p, 'utf8'));
  if (mutate) mutate(j);
  writeFileSync(p, JSON.stringify(j, null, 2));
  const r = spawnSync(process.execPath, [join(dir, 'scripts', 'build-essay.mjs')], { encoding: 'utf8' });
  return { code: r.status, out: r.stdout + r.stderr, dir };
}
const rejects = (name, mutate, pattern) => test(`rejects: ${name}`, () => {
  const r = run(mutate);
  assert.notEqual(r.code, 0, 'build should fail');
  assert.match(r.out, pattern);
});

test('real essay passes and writes only to the temp tree', () => {
  const r = run();
  assert.equal(r.code, 0, r.out);
  const o = JSON.parse(readFileSync(join(r.dir, 'src', 'data', 'essay.json'), 'utf8'));
  assert.equal(o['last-mile'].sections.length, 6);
});

rejects('a cite that is not in sources[]', (e) => { e.sections[0].paragraphs[0].cites.push('no-such-source'); }, /not in sources\[\]/);
rejects('a paragraph with a number and no cite', (e) => { e.sections[0].paragraphs[0].cites = []; }, /contains a number but has no cite/);
rejects('SOURCE NEEDED placeholder in a ready essay', (e) => { e.status = 'ready'; e.sections[0].paragraphs[2].text = 'SOURCE NEEDED'; }, /placeholder text/);
rejects('SOURCE NEEDED placeholder in a draft essay', (e) => { e.sections[0].paragraphs[2].text = 'SOURCE NEEDED'; }, /placeholder text/);
rejects('draft label surviving into a ready essay', (e) => { e.status = 'ready'; e.sections[0].paragraphs[2].text += ' DRAFT — cited, for your edit'; }, /draft label in a ready essay/);
rejects('duplicate source id', (e) => { e.sources.push({ ...e.sources[0] }); }, /duplicate source id/);
rejects('a source never cited', (e) => { e.sources.push({ id: 'stray', label: 'Stray', url: null }); }, /never cited/);
rejects('a non-http source url', (e) => { e.sources[0].url = 'javascript:alert(1)'; }, /url must be null or http/);
