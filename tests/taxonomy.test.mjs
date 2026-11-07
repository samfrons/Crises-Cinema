// scripts/taxonomy.mjs is plain JS; src/lib/taxonomy.ts (display mirror) is not importable without a TS build.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FAMILIES, FAMILY_ORDER, BLAME_GROUPS, classify, subtypeLabel } from '../scripts/taxonomy.mjs';

const repo = join(dirname(fileURLToPath(import.meta.url)), '..');

test('FAMILY_ORDER is unique and covers exactly the FAMILIES keys', () => {
  assert.equal(new Set(FAMILY_ORDER).size, FAMILY_ORDER.length);
  assert.deepEqual([...FAMILY_ORDER].sort(), Object.keys(FAMILIES).sort());
});

test('every family belongs to a defined blame group', () => {
  const groups = new Set(BLAME_GROUPS.map((g) => g.id));
  for (const [id, f] of Object.entries(FAMILIES)) assert.ok(groups.has(f.blame), `${id} -> ${f.blame}`);
});

test('src/lib/taxonomy.ts palette ids and hex colors are sane and agree with the script', () => {
  const ts = readFileSync(join(repo, 'src', 'lib', 'taxonomy.ts'), 'utf8');
  const block = ts.slice(ts.indexOf('export const FAMILIES'), ts.indexOf('export const GROUPS'));
  const ids = [...block.matchAll(/\bid:\s*'([a-z]+)'/g)].map((m) => m[1]);
  assert.equal(new Set(ids).size, ids.length, 'duplicate ids in TS FAMILIES');
  assert.deepEqual([...ids].sort(), Object.keys(FAMILIES).sort());
  for (const m of block.matchAll(/'(#[0-9a-fA-F]+)'/g)) assert.match(m[1], /^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
});

const film = (DisasterType, MainCategory = '', Subcategory = '', SpecificDisasterTypes = []) =>
  ({ DisasterType, MainCategory, Subcategory, SpecificDisasterTypes });

const cases = [
  ['zombie outbreak beats plague', film('Zombie Apocalypse', 'Biological', '', ['zombie virus']), 'undead'],
  ['reactor meltdown is atomic', film('Nuclear Disaster', 'Man-Made'), 'atomic'],
  ['Titanic: iceberg outranks "Natural Disaster"', film('Natural Disaster - Collision with Iceberg', 'Natural', 'Geological', ['iceberg']), 'wreckage'],
  ['Noah flood is divine, not earth', film('Biblical Flood', 'Natural'), 'divine'],
  ['earthquake is earth', film('Earthquake', 'Natural'), 'earth'],
  ['pandemic is plague', film('Pandemic', 'Biological'), 'plague'],
  ['asteroid impact is cosmic', film('Asteroid Impact', 'Cosmic'), 'cosmic'],
  ['meteorological is not cosmic (Twister)', film('Tornado', 'Meteorological'), 'earth'],
  ['AI is machines', film('Artificial Intelligence'), 'machines'],
  ['nothing known is unsorted', film('', '', ''), 'unsorted'],
];
for (const [name, f, expected] of cases) test(`classify: ${name}`, () => assert.equal(classify(f), expected));

test('classify: category word alone (generic tier) still resolves', () => {
  assert.equal(classify(film('Man-Made')), 'wreckage');
});

test('subtypeLabel agrees with the family and falls back to the family label', () => {
  assert.equal(subtypeLabel(film('', '', '', ['Wasteland', 'Nuclear War']), 'atomic'), 'Nuclear War');
  assert.equal(subtypeLabel(film('', '', ''), 'earth'), FAMILIES.earth.label);
});
