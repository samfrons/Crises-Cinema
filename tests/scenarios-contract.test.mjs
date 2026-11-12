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
  // The presentational vocabulary the validator checks icons / chain / wind against.
  mkdirSync(join(dir, 'src', 'app', 'control-room'), { recursive: true });
  cpSync(join(repo, 'src', 'app', 'control-room', 'vocabulary.json'), join(dir, 'src', 'app', 'control-room', 'vocabulary.json'));
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
const V = 'valencia-dana-2024.json';
const item = (s, id) => s.timesteps.flatMap((t) => t.info_available).find((i) => i.id === id);
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

// Presentational fields: they may only restate what the cited item says.
rejects('slip icon outside the pictogram vocabulary', (e) => e(L, (s) => { item(s, 't2-i1').icon = 'explosion'; }), /not in the pictogram vocabulary/);
rejects('warning-chain link outside the vocabulary', (e) => e(L, (s) => { item(s, 't5-i4').chain = [{ link: 'pager', state: 'used' }]; }), /chain\[0\]\.link — must be one of/);
rejects('warning-chain state outside the vocabulary', (e) => e(L, (s) => { item(s, 't5-i4').chain[0].state = 'probably-fine'; }), /chain\[0\]\.state — must be one of/);
rejects('warning-chain time the item text does not state', (e) => e(L, (s) => { item(s, 't6-i4').chain[1].at = '17:00'; }), /HH:MM that the item's own text states/);
rejects('warning-chain zones outside the item\'s own zones', (e) => e(L, (s) => { item(s, 't1-i3').chain[0].zones = ['lahaina-front-street']; }), /subset of the item's own zones/);
rejects('forecast link marked cut', (e) => e(V, (s) => { item(s, 't1-i1').chain[0].state = 'cut'; }), /forecast link is only ever "used"/);
rejects('origin time the item text does not state', (e) => e(L, (s) => { item(s, 't2-i1').origin = '06:00'; }), /origin — must be true or an HH:MM/);
rejects('origin on an item with several zones', (e) => e(L, (s) => { item(s, 't4-i3').origin = true; }), /exactly one zone/);
rejects('two origins in one zone', (e) => e(L, (s) => { item(s, 't3-i1').origin = true; }), /already has an origin mark/);
rejects('wind direction the item text does not state', (e) => e(L, (s) => { item(s, 't1-i1').wind.from = 'W'; }), /does not say "W" winds/);
rejects('wind arrow on an item with no direction', (e) => e(L, (s) => { item(s, 't7-i4').wind = { from: 'E' }; }), /does not say "E" winds/);
rejects('warning-chain label key outside the vocabulary', (e) => e(L, (s) => { s.warning_chain.labels.pigeon = 'Pigeons'; }), /warning_chain\.labels\.pigeon — key must be one of/);
rejects('warning-chain channel label too long for its box', (e) => e(L, (s) => { s.warning_chain.labels.social = 'County social media'; }), /labels\.social — a label of 1–11 characters/);
rejects('warning-chain zone label for an unknown zone', (e) => e(L, (s) => { s.warning_chain.zones.atlantis = 'Atlantis'; }), /warning_chain\.zones\.atlantis — must be a scoring\.at_risk_zones id/);

// "What the record teaches": each lesson is tied to one cited line and may not outrun it.
rejects('takeaway without a citation', (e) => e(L, (s) => { delete s.takeaways[0].citation; }), /takeaways\[0\]\.citation — missing citation/);
rejects('takeaway citing a source not in sources[]', (e) => e(L, (s) => { s.takeaways[0].citation.sourceId = 'my-memory'; }), /not in sources\[\]/);
rejects('takeaway that names no cited line', (e) => e(L, (s) => { delete s.takeaways[0].from; }), /takeaways\[0\]\.from — must name exactly one cited line/);
rejects('takeaway drawn from a finding that does not exist', (e) => e(L, (s) => { s.takeaways[0].from = { finding: 99 }; }), /from\.finding — must be an index into inquiry_findings/);
rejects('takeaway drawn from a step with no historical path', (e) => e(V, (s) => { s.takeaways[0].from = { step: 't99' }; }), /from\.step — must be a timestep id/);
rejects('takeaway citing a different source from its line', (e) => e(L, (s) => { s.takeaways[0].citation.sourceId = 'fsri-p1'; }), /must cite the source of the line it is drawn from/);
rejects('takeaway that adds a figure its line does not print', (e) => e(L, (s) => { s.takeaways[1].text = s.takeaways[1].text.replace('16:30', '15:00'); }), /prints "15:00".*may not add a figure/);
rejects('takeaway with SOURCE NEEDED', (e) => e(V, (s) => { s.takeaways[0].text = 'SOURCE NEEDED — lesson to be written later'; }), /takeaways\[0\]\.text — placeholder/);

// "Terms of the desk": official definitions, cited, for words the slips actually use.
rejects('glossary definition without a citation', (e) => e(L, (s) => { delete s.glossary[0].citation; }), /glossary\[0\]\.citation — missing citation/);
rejects('glossary definition citing a source not in sources[]', (e) => e(V, (s) => { s.glossary[0].citation.sourceId = 'wikipedia'; }), /glossary\[0\]\.citation — citation sourceId "wikipedia" not in sources/);
rejects('glossary term that never appears on the desk', (e) => e(L, (s) => { s.glossary[0].match = ['Tsunami Warning']; }), /glossary\[0\]\.match — none of these spellings appears/);
rejects('glossary definition with no kind', (e) => e(L, (s) => { delete s.glossary[0].kind; }), /glossary\[0\]\.kind — must be "verbatim" or "paraphrase"/);
rejects('glossary definition that runs long', (e) => e(L, (s) => { s.glossary[0].definition = 'x'.repeat(400); }), /glossary\[0\]\.definition — a definition of 1–320/);

// Instrument readings: a drawn reading may only restate its slip.
rejects('reading on a series the scenario does not declare', (e) => e(V, (s) => { item(s, 't2-i1').readings[0].series = 'turia'; }), /readings\[0\]\.series — "turia" is not declared/);
rejects('reading state outside the vocabulary', (e) => e(V, (s) => { item(s, 't2-i1').readings[0].state = 'catastrophic'; }), /readings\[0\]\.state — must be one of/);
rejects('reading state the slip does not say', (e) => e(V, (s) => { item(s, 't2-i1').readings[0].state = 'falling'; }), /does not say "falling"/);
rejects('reading time the slip does not state', (e) => e(V, (s) => { item(s, 't5-i1').readings[0].at = '18:30'; }), /readings\[0\]\.at — "18:30" must be an HH:MM/);
rejects('reading value with a number the slip does not print', (e) => e(V, (s) => { item(s, 't5-i1').readings[0].value = '1,700 m³/s'; }), /readings\[0\]\.value — .*every number the item's text already prints/);
rejects('reading series that runs backwards in time', (e) => e(L, (s) => {
  // 14:55's slip, re-timed to 08:00 (and saying so), lands after the 09:00 reading
  const i = item(s, 't4-i2');
  i.text = i.text.replace('14:55:', '08:00 and 14:55:');
  i.readings[0].at = '08:00';
}), /runs backwards in time/);
rejects('reading series mixing timed and untimed readings', (e) => e(L, (s) => { delete item(s, 't4-i2').readings[0].at; }), /mixes timed and untimed readings/);
rejects('reading "by" without a time', (e) => e(L, (s) => { delete item(s, 't3-i1').readings[1].at; item(s, 't3-i1').readings[0].by = true; delete item(s, 't3-i1').readings[0].at; }), /by — only `true`, and only with an `at`/);
rejects('instrument label that runs long', (e) => e(V, (s) => { s.instruments.poyo = 'x'.repeat(41); }), /instruments\.poyo — a label of 1–40/);

test('every icon, chain link and state used in the real data is in the vocabulary (positive control)', () => {
  const vocab = JSON.parse(readFileSync(join(repo, 'src', 'app', 'control-room', 'vocabulary.json'), 'utf8'));
  for (const name of [L, V]) {
    const s = JSON.parse(readFileSync(join(repo, 'data', 'scenarios', name), 'utf8'));
    for (const i of s.timesteps.flatMap((t) => t.info_available)) {
      if (i.icon) assert.ok(vocab.icons.includes(i.icon), `${name} ${i.id} icon ${i.icon}`);
      for (const c of i.chain ?? []) assert.ok(vocab.chain.links.includes(c.link) && vocab.chain.states.includes(c.state), `${name} ${i.id}`);
    }
  }
});

test('debrief media taken after the day is allowed (positive control)', () => {
  const r = run((e) => e(L, (s) => { s.debrief_media[0].takenOn = '2024-01-01'; }));
  assert.equal(r.code, 0, r.out);
});
