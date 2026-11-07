// Fault-injection tests for the Control Room sourcing contract. Runs the real
// scripts/build-scenarios.mjs as a child process inside a throwaway copy of the
// repo layout (the script derives its root from its own location, so its
// output write lands in the temp tree, never in src/data/scenarios.json).
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = join(dirname(fileURLToPath(import.meta.url)), '..');
const tmpDirs = [];
after(() => tmpDirs.forEach((d) => rmSync(d, { recursive: true, force: true })));

/** Build a temp repo layout; `mutate(files)` edits parsed scenario JSON by filename. */
function run(mutate, { raw = {} } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'cc-scen-'));
  tmpDirs.push(dir);
  mkdirSync(join(dir, 'scripts'));
  mkdirSync(join(dir, 'src', 'data'), { recursive: true });
  mkdirSync(join(dir, 'public'));
  cpSync(join(repo, 'scripts', 'build-scenarios.mjs'), join(dir, 'scripts', 'build-scenarios.mjs'));
  cpSync(join(repo, 'data', 'scenarios'), join(dir, 'data', 'scenarios'), { recursive: true });
  symlinkSync(join(repo, 'public', 'control-room'), join(dir, 'public', 'control-room'));
  const edit = (name, fn) => {
    const p = join(dir, 'data', 'scenarios', name);
    const j = JSON.parse(readFileSync(p, 'utf8'));
    fn(j);
    writeFileSync(p, JSON.stringify(j, null, 2));
  };
  if (mutate) mutate(edit);
  for (const [name, text] of Object.entries(raw)) writeFileSync(join(dir, 'data', 'scenarios', name), text);
  const r = spawnSync(process.execPath, [join(dir, 'scripts', 'build-scenarios.mjs')], { encoding: 'utf8' });
  return { code: r.status, out: r.stdout + r.stderr };
}

const L = 'lahaina-2023.json';
const rejects = (name, mutate, pattern, opts) => test(`rejects: ${name}`, () => {
  const r = run(mutate, opts);
  assert.notEqual(r.code, 0, 'build should fail');
  assert.match(r.out, pattern);
});
const firstMedia = (s) => s.timesteps.flatMap((t) => t.info_available).find((i) => i.media).media;

test('real data passes (and writes only to the temp tree)', () => {
  const r = run();
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /\d+ playable, \d+ stub/);
});

rejects('uncited playable fact', (e) => e(L, (s) => { delete s.timesteps[0].info_available[0].citation; }), /missing citation/);
rejects('citation to an unknown source id', (e) => e(L, (s) => { s.timesteps[0].info_available[0].citation.sourceId = 'no-such-source'; }), /not in sources\[\]/);
rejects('SOURCE NEEDED placeholder in a playable scenario', (e) => e(L, (s) => { s.timesteps[0].info_available[0].text = 'SOURCE NEEDED'; }), /placeholder text/);
rejects('media file missing on disk', (e) => e(L, (s) => { firstMedia(s).file = 'does-not-exist.jpg'; }), /file not found at public\/control-room/);
rejects('media file name with a path', (e) => e(L, (s) => { firstMedia(s).file = '../x.jpg'; }), /bare kebab-case file name/);
rejects('media taken after the scenario day in the play log', (e) => e(L, (s) => { firstMedia(s).takenOn = '2023-08-09'; }), /after the scenario day/);
rejects('media licence is a placeholder', (e) => e(L, (s) => { firstMedia(s).license = 'license needed'; }), /placeholder, not a licence/);
rejects('media sourcePage not a URL', (e) => e(L, (s) => { firstMedia(s).sourcePage = 'see wikipedia'; }), /http\(s\) URL/);
rejects('timesteps out of clock order', (e) => e(L, (s) => { s.timesteps[2].time = '05:00'; }), /clock order/);
rejects('info item zone not in at_risk_zones', (e) => e(L, (s) => { s.timesteps[0].info_available[0].zones = ['atlantis']; }), /at_risk_zones ids/);
rejects('option count out of range', (e) => e(L, (s) => { s.timesteps[0].options.length = 1; }), /needs 2–4 options/);
rejects('contested death toll without a note', (e) => e(L, (s) => { delete s.outcome.deaths.note; }), /contested toll needs a note/);
rejects('id does not match filename', (e) => e(L, (s) => { s.id = 'something-else'; }), /must match filename/);
rejects('stub that does not say SOURCE NEEDED', (e) => e('derna-2023.json', (s) => { s.research_notes = 'done'; }), /stub must say "SOURCE NEEDED"/);
rejects('invalid JSON', null, /not valid JSON/, { raw: { 'broken.json': '{ nope' } });

test('debrief media taken after the day is allowed (positive control)', () => {
  const r = run((e) => e(L, (s) => { s.debrief_media[0].takenOn = '2024-01-01'; }));
  assert.equal(r.code, 0, r.out);
});
