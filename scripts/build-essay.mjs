/**
 * Validate and bundle the essay drafts.
 *
 * Reads data/essay/*.json, enforces the sourcing contract, and writes
 * src/data/essay.json keyed by essay id. Run by hand; the output is committed
 * (it is deliberately NOT part of build:data). The same file feeds the
 * /preparedness page now and an in-game edition later.
 *
 * Contract (any failure exits 1):
 *  - id matches the filename; status is "draft" or "ready"; updated is YYYY-MM-DD.
 *  - sources[]: unique ids, a non-empty label, url null or http(s). Every source
 *    is cited at least once (an uncited source is a stray).
 *  - sections: a..f once each, in order; each has eyebrow, title, paragraphs.
 *  - every paragraph containing a digit carries >= 1 cite; every cite resolves.
 *  - no placeholder text ("SOURCE NEEDED", TBD, TODO, lorem...) in any status;
 *    a "ready" essay may not carry the DRAFT label either.
 * The output lists sources in order of first citation, so [n] marks are stable.
 */
import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const srcDir = join(root, 'data', 'essay');
const outFile = join(root, 'src', 'data', 'essay.json');

const PLACEHOLDER = /source needed|license needed|licence needed|\btbd\b|\btodo\b|lorem ipsum|\?\?\?|placeholder/i;
const DRAFT_LABEL = /draft\s*[—-]\s*cited|for your edit|draft scaffold/i;
const URL_RE = /^https?:\/\/\S+$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const SECTION_IDS = ['a', 'b', 'c', 'd', 'e', 'f'];

const errors = [];
const out = {};

for (const file of existsSync(srcDir) ? readdirSync(srcDir).filter((f) => f.endsWith('.json')).sort() : []) {
  const err = (m) => errors.push(`${file}: ${m}`);
  let e;
  try { e = JSON.parse(readFileSync(join(srcDir, file), 'utf8')); } catch (x) { err(`invalid JSON (${x.message})`); continue; }

  if (e.id !== file.replace(/\.json$/, '')) err(`id "${e.id}" must match the filename`);
  if (e.status !== 'draft' && e.status !== 'ready') err(`status must be "draft" or "ready", got "${e.status}"`);
  if (!DATE_RE.test(e.updated ?? '')) err('updated must be YYYY-MM-DD');
  if (!Array.isArray(e.sources) || !Array.isArray(e.sections)) { err('sources[] and sections[] are required'); continue; }

  const ids = new Set();
  for (const s of e.sources) {
    if (!s.id || typeof s.id !== 'string') { err('a source has no id'); continue; }
    if (ids.has(s.id)) err(`duplicate source id "${s.id}"`);
    ids.add(s.id);
    if (!s.label || !String(s.label).trim()) err(`source "${s.id}" has no label`);
    if (s.url !== null && !(typeof s.url === 'string' && URL_RE.test(s.url))) err(`source "${s.id}" url must be null or http(s)`);
  }

  const order = [];
  const seenSec = [];
  for (const sec of e.sections) {
    seenSec.push(sec.id);
    for (const k of ['eyebrow', 'title']) if (!sec[k]) err(`section ${sec.id}: missing ${k}`);
    if (!Array.isArray(sec.paragraphs) || !sec.paragraphs.length) { err(`section ${sec.id}: no paragraphs`); continue; }
    sec.paragraphs.forEach((p, i) => {
      const where = `section ${sec.id} paragraph ${i + 1}`;
      if (!p.text || !String(p.text).trim()) { err(`${where}: empty text`); return; }
      if (!Array.isArray(p.cites)) { err(`${where}: cites must be an array`); return; }
      if (/\d/.test(p.text) && p.cites.length === 0) err(`${where}: contains a number but has no cite`);
      for (const c of p.cites) {
        if (!ids.has(c)) err(`${where}: cite "${c}" is not in sources[]`);
        else if (!order.includes(c)) order.push(c);
      }
      if (PLACEHOLDER.test(p.text)) err(`${where}: placeholder text`);
      if (e.status === 'ready' && DRAFT_LABEL.test(p.text)) err(`${where}: draft label in a ready essay`);
    });
    for (const k of ['eyebrow', 'title']) {
      if (PLACEHOLDER.test(sec[k] ?? '')) err(`section ${sec.id}: placeholder text in ${k}`);
    }
  }
  if (seenSec.join(',') !== SECTION_IDS.join(',')) err(`sections must be ${SECTION_IDS.join(',')} in order, got ${seenSec.join(',')}`);
  for (const id of ids) if (!order.includes(id)) err(`source "${id}" is never cited`);

  const byId = new Map(e.sources.map((s) => [s.id, s]));
  out[e.id] = { ...e, sources: order.filter((id) => byId.has(id)).map((id) => byId.get(id)) };
}

if (errors.length) {
  console.error(`build-essay: ${errors.length} problem(s)\n` + errors.map((m) => `  - ${m}`).join('\n'));
  process.exit(1);
}
writeFileSync(outFile, JSON.stringify(out, null, 2) + '\n');
const n = Object.values(out).map((x) => `${x.id} (${x.status}, ${x.sections.length} sections, ${x.sources.length} sources)`).join('; ');
console.log(`build-essay: ${n}`);
