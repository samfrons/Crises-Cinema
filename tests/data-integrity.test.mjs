// Committed preparedness artifacts must stay structurally sane.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'data', 'preparedness');
const read = (f) => JSON.parse(readFileSync(join(dir, f), 'utf8'));
// Known, documented exceptions in the committed data (extend only with a reason):
//  AB9: IDMC's own pseudo-code for Abyei, which has no ISO3 code.
const NON_ISO3 = new Set(['AB9']);
const CENTROID_OUTSIDE = new Set(); // none: the geometry script now corrects antimeridian centroids
const layerFiles = readdirSync(dir).filter((f) => f.endsWith('.json') && !['manifest.json', 'world.json', 'funding.json'].includes(f));

test('every layer file parses and is in the manifest', () => {
  const manifest = read('manifest.json');
  assert.ok(layerFiles.length >= 5);
  for (const f of layerFiles) read(f);
  const listed = new Set(manifest.layers.map((l) => l.file));
  for (const f of layerFiles) assert.ok(listed.has(f), `${f} missing from manifest.json`);
});

test('manifest statuses match each layer file', () => {
  for (const l of read('manifest.json').layers) {
    assert.equal(read(l.file).status, l.status, `${l.file} status disagrees with manifest`);
  }
});

for (const f of layerFiles) {
  test(`${f}: scale and country scores`, () => {
    const layer = read(f);
    if (layer.status !== 'loaded') return; // not_loaded layers carry instructions, not data
    const { min, max } = layer.scale;
    assert.ok(min < max, 'scale.min < scale.max');
    const entries = Object.entries(layer.countries);
    assert.ok(entries.length > 50, 'expected a real country set');
    for (const [iso, c] of entries) {
      if (!NON_ISO3.has(iso)) assert.match(iso, /^[A-Z]{3}$/, `bad ISO3 key ${iso}`);
      // Inclusive bounds: log-scaled layers cap at the observed max, so score === max is legal.
      if (c.score !== null && c.score !== undefined) {
        assert.ok(Number.isFinite(c.score) && c.score >= min && c.score <= max, `${iso} score ${c.score} outside [${min}, ${max}]`);
      }
    }
  });
}

test('world.json: >150 countries with paths and in-viewBox centroids', () => {
  const w = read('world.json');
  assert.ok(w.countries.length > 150);
  for (const c of w.countries) {
    assert.match(c.iso3, /^[A-Z]{3}$/);
    assert.ok(typeof c.d === 'string' && c.d.length > 0, `${c.iso3} has empty path`);
    if (CENTROID_OUTSIDE.has(c.iso3)) { assert.ok(Number.isFinite(c.cx) && Number.isFinite(c.cy)); continue; }
    assert.ok(Number.isFinite(c.cx) && c.cx >= 0 && c.cx <= w.width, `${c.iso3} cx ${c.cx}`);
    assert.ok(Number.isFinite(c.cy) && c.cy >= 0 && c.cy <= w.height, `${c.iso3} cy ${c.cy}`);
  }
  assert.equal(new Set(w.countries.map((c) => c.iso3)).size, w.countries.length, 'duplicate iso3');
});

test('funding.json: appeals year-ordered, coverage = funded/required', () => {
  const { appeals } = read('funding.json');
  assert.ok(appeals.length >= 10);
  for (let i = 0; i < appeals.length; i++) {
    const a = appeals[i];
    if (i) assert.ok(a.year > appeals[i - 1].year, `year order broken at ${a.year}`);
    assert.ok(Math.abs(a.coverage - a.fundedUsd / a.requiredUsd) <= 0.01, `${a.year} coverage ${a.coverage} vs ${a.fundedUsd / a.requiredUsd}`);
  }
});

/* ── Control Room terrain (scripts/build-terrain.mjs) ─────────────────────── */
import { statSync, existsSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';

const repo = join(dirname(fileURLToPath(import.meta.url)), '..');
const terrainDir = join(repo, 'public', 'control-room', 'terrain');
const playableIds = readdirSync(join(repo, 'data', 'scenarios'))
  .filter((f) => f.endsWith('.json'))
  .map((f) => JSON.parse(readFileSync(join(repo, 'data', 'scenarios', f), 'utf8')))
  .filter((s) => s.status === 'playable')
  .map((s) => s.id);
const terrainMetas = readdirSync(terrainDir).filter((f) => f.endsWith('.json'));

test('every playable scenario has a terrain heightmap + meta pair', () => {
  assert.ok(playableIds.length >= 4);
  for (const id of playableIds) {
    assert.ok(existsSync(join(terrainDir, `${id}.png`)), `${id}.png missing`);
    assert.ok(existsSync(join(terrainDir, `${id}.json`)), `${id}.json missing`);
  }
  for (const f of terrainMetas) assert.ok(existsSync(join(terrainDir, f.replace(/\.json$/, '.png'))), `${f} has no png`);
});

test('terrain meta parses with finite elevations and sane bbox', () => {
  for (const f of terrainMetas) {
    const m = JSON.parse(readFileSync(join(terrainDir, f), 'utf8'));
    assert.ok(Number.isFinite(m.minElev) && Number.isFinite(m.maxElev) && m.minElev < m.maxElev, `${f} elevation range`);
    const [w, s, e, n] = m.bbox;
    assert.ok([w, s, e, n].every(Number.isFinite) && w < e && s < n, `${f} bbox order`);
    assert.ok(w >= -180 && e <= 180 && s >= -90 && n <= 90, `${f} bbox range`);
    assert.ok(m.widthPx > 0 && m.heightPx > 0 && m.metresPerPixel > 0, `${f} grid`);
    assert.ok(m.source.publisher && m.source.url && m.source.license && m.source.retrieved && m.source.tilesZoom, `${f} source fields`);
    assert.equal(m.water.seaLevelM, 0);
  }
});

test('terrain PNGs are 16-bit greyscale of the declared size, within budget', () => {
  let total = 0;
  for (const f of terrainMetas) {
    const m = JSON.parse(readFileSync(join(terrainDir, f), 'utf8'));
    const png = join(terrainDir, f.replace(/\.json$/, '.png'));
    const b = readFileSync(png);
    assert.equal(b.readUInt32BE(0), 0x89504e47, `${f} png signature`);
    assert.equal(b.readUInt32BE(16), m.widthPx);
    assert.equal(b.readUInt32BE(20), m.heightPx);
    assert.equal(b[24], 16, 'bit depth 16');
    assert.equal(b[25], 0, 'greyscale');
    assert.ok(statSync(png).size <= 300 * 1024, `${f} heightmap over 300 KB`);
    total += statSync(png).size + statSync(join(terrainDir, f)).size;
  }
  assert.ok(total <= 1.5 * 1024 * 1024, `terrain total ${total} over 1.5 MB`);
});

test('terrain gate: build-terrain fails on a playable scenario with no bbox entry', () => {
  const dir = mkdtempSync(join(tmpdir(), 'terrain-gate-'));
  writeFileSync(join(dir, 'no-ground-2099.json'), JSON.stringify({ id: 'no-ground-2099', status: 'playable' }));
  const bad = spawnSync(process.execPath, [join(repo, 'scripts', 'build-terrain.mjs'), '--check', `--scenarios-dir=${dir}`], { encoding: 'utf8' });
  assert.notEqual(bad.status, 0);
  assert.match(bad.stderr, /TERRAIN GATE FAILED.*no-ground-2099/);
  const good = spawnSync(process.execPath, [join(repo, 'scripts', 'build-terrain.mjs'), '--check'], { encoding: 'utf8' });
  assert.equal(good.status, 0, good.stderr);
});
