// The essay's reproducibility claim: the analysis script runs clean on committed data.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = join(dirname(fileURLToPath(import.meta.url)), '..');
const r = spawnSync(process.execPath, [join(repo, 'scripts', 'essay-analysis.mjs')], { encoding: 'utf8' });

test('essay-analysis exits 0 with no stderr', () => {
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stderr.trim(), '');
});

const sections = ['1. FUNDING', '2. CONCENTRATION', '3. SCORES vs OUTCOMES', '4. HAZARD PROFILE', '5. WARNING LATENCY', 'DATA QUALITY NOTES'];
test('every section header is present and each statistical section reports N=', () => {
  const idx = sections.map((h) => r.stdout.indexOf(h));
  idx.forEach((i, k) => assert.ok(i >= 0, `missing section "${sections[k]}"`));
  assert.deepEqual([...idx].sort((a, b) => a - b), idx, 'sections out of order');
  for (let k = 0; k < 5; k++) {
    const body = r.stdout.slice(idx[k], idx[k + 1]);
    assert.match(body, /N=\d+/i, `section "${sections[k]}" reports no N=`);
  }
});
