/**
 * Validate and bundle the Control Room scenarios.
 *
 * Reads data/scenarios/*.json, enforces the sourcing contract described in
 * data/scenarios/README.md, and writes src/data/scenarios.json. A playable
 * scenario with any unsourced fact fails the build — that is the point of the
 * script, not an inconvenience to be routed around.
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const srcDir = join(root, 'data', 'scenarios');
const outFile = join(root, 'src', 'data', 'scenarios.json');

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const KINDS = new Set(['forecast', 'gauge', 'message', 'media', 'field_report']);
const SCOPES = new Set(['none', 'targeted', 'province']);
const PLACEHOLDER = /source needed/i;

/** Collects human-readable errors for one scenario file. */
class Check {
  constructor(file) {
    this.file = file;
    this.errors = [];
  }
  fail(path, msg) {
    this.errors.push(`${this.file} :: ${path} — ${msg}`);
  }
  require(cond, path, msg) {
    if (!cond) this.fail(path, msg);
    return !!cond;
  }
}

function checkCitation(chk, cite, path, sourceIds, playable) {
  if (!chk.require(cite && typeof cite === 'object', path, 'missing citation')) return;
  chk.require(typeof cite.sourceId === 'string' && cite.sourceId.length > 0, path, 'citation lacks sourceId');
  if (playable && typeof cite.sourceId === 'string') {
    chk.require(sourceIds.has(cite.sourceId), path, `citation sourceId "${cite.sourceId}" not in sources[]`);
    chk.require(!PLACEHOLDER.test(cite.sourceId) && !PLACEHOLDER.test(cite.detail ?? ''), path, 'placeholder "SOURCE NEEDED" in a playable scenario');
  }
}

function validate(file, s) {
  const chk = new Check(file);
  for (const field of ['id', 'status', 'title', 'date', 'location', 'hazard']) {
    chk.require(typeof s[field] === 'string' && s[field].length > 0, field, 'required string missing');
  }
  chk.require(s.status === 'playable' || s.status === 'stub', 'status', 'must be "playable" or "stub"');
  chk.require(file === `${s.id}.json`, 'id', `must match filename (${file})`);
  chk.require(/^\d{4}-\d{2}-\d{2}$/.test(s.date ?? ''), 'date', 'must be YYYY-MM-DD');

  const playable = s.status === 'playable';
  const sourceIds = new Set();
  chk.require(Array.isArray(s.sources), 'sources', 'must be an array');
  for (const [i, src] of (s.sources ?? []).entries()) {
    const p = `sources[${i}]`;
    chk.require(typeof src.id === 'string' && src.id.length > 0, p, 'source needs an id');
    chk.require(typeof src.label === 'string' && src.label.length > 10, p, 'source needs a real bibliographic label');
    if (playable) chk.require(!PLACEHOLDER.test(src.label), p, 'placeholder label in a playable scenario');
    if (src.id) {
      chk.require(!sourceIds.has(src.id), p, `duplicate source id "${src.id}"`);
      sourceIds.add(src.id);
    }
  }

  // Stubs only need the header block plus explicit research markers.
  if (!playable) {
    chk.require(typeof s.research_notes === 'string' && PLACEHOLDER.test(s.research_notes),
      'research_notes', 'a stub must say "SOURCE NEEDED" so it cannot pass as researched');
    return chk.errors;
  }

  chk.require(s.clock && HHMM.test(s.clock.start ?? '') && HHMM.test(s.clock.end ?? '') && typeof s.clock.timezone === 'string',
    'clock', 'needs {timezone, start HH:MM, end HH:MM}');
  chk.require(typeof s.record_caveat === 'string' && s.record_caveat.length > 0, 'record_caveat', 'required — say honestly what the record is');

  chk.require(Array.isArray(s.timesteps) && s.timesteps.length >= 2, 'timesteps', 'a playable scenario needs at least 2 timesteps');
  const stepIds = new Set();
  let prev = null;
  for (const [i, t] of (s.timesteps ?? []).entries()) {
    const p = `timesteps[${i}]`;
    chk.require(typeof t.id === 'string' && !stepIds.has(t.id), p, 'needs a unique id');
    stepIds.add(t.id);
    if (chk.require(HHMM.test(t.time ?? ''), `${p}.time`, 'must be HH:MM')) {
      if (prev !== null) chk.require(t.time > prev, `${p}.time`, 'timesteps must be in clock order');
      prev = t.time;
    }
    chk.require(typeof t.time_label === 'string' && t.time_label.length > 0, `${p}.time_label`, 'required');

    chk.require(Array.isArray(t.info_available) && t.info_available.length >= 1, `${p}.info_available`, 'at least one item');
    for (const [j, info] of (t.info_available ?? []).entries()) {
      const q = `${p}.info_available[${j}]`;
      chk.require(KINDS.has(info.kind), q, `kind must be one of ${[...KINDS].join('|')}`);
      chk.require(typeof info.text === 'string' && info.text.length > 0, q, 'needs text');
      chk.require(!PLACEHOLDER.test(info.text ?? ''), q, 'placeholder text in a playable scenario');
      checkCitation(chk, info.citation, `${q}.citation`, sourceIds, playable);
      if (info.zones !== undefined) {
        const known = new Set((s.scoring?.at_risk_zones ?? []).map((z) => z.id));
        chk.require(Array.isArray(info.zones) && info.zones.every((z) => known.has(z)),
          `${q}.zones`, 'zones must be an array of scoring.at_risk_zones ids');
      }
    }

    chk.require(Array.isArray(t.options) && t.options.length >= 2 && t.options.length <= 4, `${p}.options`, 'needs 2–4 options');
    const optIds = new Set();
    for (const [j, o] of (t.options ?? []).entries()) {
      const q = `${p}.options[${j}]`;
      chk.require(typeof o.id === 'string' && !optIds.has(o.id), q, 'needs a unique id');
      optIds.add(o.id);
      chk.require(typeof o.label === 'string' && o.label.length > 0, `${q}.label`, 'required');
      const e = o.effects ?? {};
      chk.require(SCOPES.has(e.warning_scope), `${q}.effects.warning_scope`, `must be one of ${[...SCOPES].join('|')}`);
      chk.require(typeof e.false_alarm_weight === 'number' && e.false_alarm_weight >= 0 && e.false_alarm_weight <= 2,
        `${q}.effects.false_alarm_weight`, 'must be a number 0–2');
      const c = o.consequence;
      if (chk.require(c && typeof c.known === 'boolean', `${q}.consequence`, 'needs { known: boolean }')) {
        if (c.known) {
          chk.require(typeof c.text === 'string' && c.text.length > 0, `${q}.consequence.text`, 'known consequence needs text');
          checkCitation(chk, c.citation, `${q}.consequence.citation`, sourceIds, playable);
        } else {
          chk.require(!c.text, `${q}.consequence`, 'an unknown consequence carries no text — the UI says the record is silent');
        }
      }
    }
    if (t.historical_option_id !== null) {
      chk.require(optIds.has(t.historical_option_id), `${p}.historical_option_id`, 'must reference one of the options (or be null)');
      checkCitation(chk, t.historical_citation, `${p}.historical_citation`, sourceIds, playable);
    }
  }

  chk.require(Array.isArray(s.historical_path) && s.historical_path.length >= 1, 'historical_path', 'required');
  for (const [i, h] of (s.historical_path ?? []).entries()) {
    const p = `historical_path[${i}]`;
    chk.require(stepIds.has(h.timestep_id), p, 'timestep_id must reference a timestep');
    chk.require(typeof h.action === 'string' && h.action.length > 0, `${p}.action`, 'required');
    checkCitation(chk, h.citation, `${p}.citation`, sourceIds, playable);
  }

  chk.require(Array.isArray(s.inquiry_findings) && s.inquiry_findings.length >= 1, 'inquiry_findings', 'required');
  for (const [i, f] of (s.inquiry_findings ?? []).entries()) {
    const p = `inquiry_findings[${i}]`;
    chk.require(f.kind === 'verbatim' || f.kind === 'paraphrase', `${p}.kind`, 'must be "verbatim" or "paraphrase"');
    chk.require(typeof f.quote === 'string' && f.quote.length > 0, `${p}.quote`, 'required');
    checkCitation(chk, f.citation, `${p}.citation`, sourceIds, playable);
  }

  const d = s.outcome?.deaths;
  chk.require(d && Number.isFinite(d.min) && Number.isFinite(d.max) && d.min <= d.max && typeof d.contested === 'boolean',
    'outcome.deaths', 'needs {min, max, contested}');
  if (d?.contested) chk.require(typeof d.note === 'string' && d.note.length > 0, 'outcome.deaths.note', 'a contested toll needs a note');
  checkCitation(chk, s.outcome?.citation, 'outcome.citation', sourceIds, playable);

  chk.require(s.scoring && HHMM.test(s.scoring.impact?.time ?? ''), 'scoring.impact.time', 'must be HH:MM');
  chk.require(typeof s.scoring?.impact?.label === 'string', 'scoring.impact.label', 'required');
  checkCitation(chk, s.scoring?.impact?.citation, 'scoring.impact.citation', sourceIds, playable);
  if (s.scoring?.impact?.window_minutes !== undefined) {
    chk.require(Number.isFinite(s.scoring.impact.window_minutes) && s.scoring.impact.window_minutes > 0,
      'scoring.impact.window_minutes', 'must be a positive number of minutes when present');
  }
  chk.require(Array.isArray(s.scoring?.at_risk_zones) && s.scoring.at_risk_zones.length >= 1, 'scoring.at_risk_zones', 'required');
  chk.require(HHMM.test(s.scoring?.historical_first_public_alert ?? ''), 'scoring.historical_first_public_alert', 'must be HH:MM');

  return chk.errors;
}

const files = readdirSync(srcDir).filter((f) => f.endsWith('.json')).sort();
const playable = [];
const stubs = [];
const allErrors = [];

for (const file of files) {
  let scenario;
  try {
    scenario = JSON.parse(readFileSync(join(srcDir, file), 'utf8'));
  } catch (e) {
    allErrors.push(`${file} :: not valid JSON — ${e.message}`);
    continue;
  }
  const errors = validate(file, scenario);
  if (errors.length) {
    allErrors.push(...errors);
    continue;
  }
  if (scenario.status === 'playable') playable.push(scenario);
  else stubs.push({
    id: scenario.id,
    status: 'stub',
    title: scenario.title,
    date: scenario.date,
    location: scenario.location,
    hazard: scenario.hazard,
  });
}

if (allErrors.length) {
  console.error(`scenarios: REJECTED — ${allErrors.length} problem(s):\n`);
  for (const e of allErrors) console.error(`  ✗ ${e}`);
  process.exit(1);
}

const bundle = { generated: new Date().toISOString(), playable, stubs };
writeFileSync(outFile, `${JSON.stringify(bundle, null, 2)}\n`);
console.log(`scenarios: ${playable.length} playable, ${stubs.length} stub(s) → src/data/scenarios.json`);
