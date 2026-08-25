#!/usr/bin/env node
// Prints the headline numbers the README quotes in prose, read straight from
// the build artefact — so a refresh compares against the same source of
// truth the site itself renders from, not a stale mental model of the data.
//
// Usage: node .claude/skills/readme-screenshots/scripts/print-stats.mjs

import { readFileSync } from 'node:fs';

// Mirrors the `group` field on FAMILIES in src/lib/taxonomy.ts — duplicated
// here rather than imported because that file is TypeScript and this is a
// quick maintenance script. If a family's group changes there, update it
// here too, or the group totals below will silently drift from Hero.tsx's.
const GROUP = {
  earth: 'world', climate: 'world', cosmic: 'world',
  wreckage: 'ourselves', atomic: 'ourselves', machines: 'ourselves',
  plague: 'alive', undead: 'alive', invaders: 'alive',
  divine: 'beyond', afterfall: 'beyond', unsorted: 'beyond',
};
const GROUP_LABEL = { world: 'Earth & sky', ourselves: 'Our own machinery', alive: 'Something alive', beyond: 'Beyond explanation' };

const summary = JSON.parse(readFileSync('src/data/summary.json', 'utf8'));
const byFamily = Object.entries(summary.byFamily).sort((a, b) => b[1] - a[1]);

const byGroup = {};
for (const [id, n] of Object.entries(summary.byFamily)) {
  const g = GROUP[id] ?? 'beyond';
  byGroup[g] = (byGroup[g] ?? 0) + n;
}

console.log(`total films:      ${summary.total}`);
console.log(`year range:       ${summary.firstYear}–${summary.lastYear}`);
console.log(`decades:          ${summary.decades.length}`);
console.log(`data generated:   ${summary.generated}`);
console.log(`\ngroups (the hero's headline split), by count:`);
for (const [g, n] of Object.entries(byGroup).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${GROUP_LABEL[g].padEnd(20)} ${n}`);
}
console.log(`\nfamilies (11), by count:`);
for (const [id, n] of byFamily) console.log(`  ${id.padEnd(10)} ${n}`);
