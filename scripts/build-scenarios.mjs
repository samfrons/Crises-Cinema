/**
 * Validate and bundle the Control Room scenarios.
 *
 * Reads data/scenarios/*.json, enforces the sourcing contract described in
 * data/scenarios/README.md, and writes src/data/scenarios.json. A playable
 * scenario with any unsourced fact fails the build — that is the point of the
 * script, not an inconvenience to be routed around.
 */
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const srcDir = join(root, 'data', 'scenarios');
const outFile = join(root, 'src', 'data', 'scenarios.json');
// Media a scenario attaches is served from public/control-room/<scenario-id>/.
const mediaRoot = join(root, 'public', 'control-room');

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const KINDS = new Set(['forecast', 'gauge', 'message', 'media', 'field_report']);
const SCOPES = new Set(['none', 'targeted', 'province']);
const PLACEHOLDER = /source needed/i;
const BOARD_STATES = new Set(['none', 'watch', 'signal', 'impact']);
const MEDIA_TYPES = { image: /\.(jpe?g|png|webp|avif|gif)$/i, video: /\.(mp4|webm)$/i };
// A licence line that is really a to-do note does not clear anything for publication.
const LICENSE_PLACEHOLDER = /source needed|license needed|licence needed|\btbd\b|\btodo\b|unknown|unclear|placeholder|\?\?|^\s*-?\s*$/i;
const URL_RE = /^https?:\/\/\S+$/;
const SAFE_FILE = /^[a-z0-9][a-z0-9.-]*$/;
// The presentational vocabulary (slip pictograms, the warning chain, wind
// compass) is shared with the UI, so a word the UI cannot draw cannot ship.
const VOCAB = JSON.parse(readFileSync(join(root, 'src', 'app', 'control-room', 'vocabulary.json'), 'utf8'));
const ICONS = new Set(VOCAB.icons);
const CHAIN_LINKS = new Set(VOCAB.chain.links);
const CHAIN_STATES = new Set(VOCAB.chain.states);
const CHAIN_LABEL_KEYS = new Set(VOCAB.chain.label_keys);
const READINGS = VOCAB.readings;
// Hazard families, in match order (the first whose pattern the hazard contains).
const HAZARD_FAMILIES = Object.entries(VOCAB.hazards ?? {}).filter(([k]) => k !== '_comment');
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

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

/**
 * A media attachment (image or short video) on an info item, the briefing or the
 * debrief. Same spirit as the citation gate: every field the UI prints as
 * provenance must be present and real, the licence must be an actual licence,
 * and the file must exist on disk — a missing figure fails the build rather
 * than shipping a broken frame. `notAfter` (YYYY-MM-DD) refuses imagery taken
 * after the scenario's day from appearing in the play log.
 */
function checkMedia(chk, m, path, scenarioId, notAfter) {
  if (!chk.require(m && typeof m === 'object' && !Array.isArray(m), path, 'media must be an object')) return;
  const nonEmpty = (k) => chk.require(typeof m[k] === 'string' && m[k].trim().length > 0, `${path}.${k}`, 'required string missing');
  ['file', 'caption', 'credit', 'license', 'sourcePage'].forEach(nonEmpty);
  chk.require(m.type === 'image' || m.type === 'video', `${path}.type`, 'must be "image" or "video"');
  for (const k of ['width', 'height']) {
    chk.require(Number.isInteger(m[k]) && m[k] > 0, `${path}.${k}`, 'must be a positive integer (pixels) so the frame reserves its space');
  }
  if (typeof m.license === 'string') {
    chk.require(!LICENSE_PLACEHOLDER.test(m.license), `${path}.license`, `"${m.license}" is a placeholder, not a licence`);
  }
  if (typeof m.sourcePage === 'string') chk.require(URL_RE.test(m.sourcePage), `${path}.sourcePage`, 'must be an http(s) URL');
  if (m.licenseUrl !== undefined) chk.require(typeof m.licenseUrl === 'string' && URL_RE.test(m.licenseUrl), `${path}.licenseUrl`, 'must be an http(s) URL when present');
  if (typeof m.caption === 'string') chk.require(!PLACEHOLDER.test(m.caption), `${path}.caption`, 'placeholder caption');

  const onDisk = (name, field) => {
    if (!chk.require(typeof name === 'string' && SAFE_FILE.test(name), `${path}.${field}`,
      'a bare kebab-case file name (no folders, no "..")')) return;
    const full = join(mediaRoot, scenarioId, name);
    chk.require(existsSync(full) && statSync(full).isFile() && statSync(full).size > 0, `${path}.${field}`,
      `file not found at public/control-room/${scenarioId}/${name}`);
  };
  onDisk(m.file, 'file');
  if (MEDIA_TYPES[m.type] && typeof m.file === 'string') {
    chk.require(MEDIA_TYPES[m.type].test(m.file), `${path}.file`, `extension does not match type "${m.type}"`);
  }
  if (m.poster !== undefined) {
    onDisk(m.poster, 'poster');
    if (typeof m.poster === 'string') chk.require(MEDIA_TYPES.image.test(m.poster), `${path}.poster`, 'poster must be an image');
  }

  // takenOn is free text that starts with a date when the research knows one.
  const taken = typeof m.takenOn === 'string' ? m.takenOn.match(/^\d{4}-\d{2}-\d{2}/)?.[0] : undefined;
  if (notAfter && taken) {
    chk.require(taken <= notAfter, `${path}.takenOn`,
      `taken ${taken}, after the scenario day (${notAfter}) — later imagery belongs in debrief_media, not the play log`);
  }
}

/** A time the presentation prints must be one the cited text already says. */
const saysTime = (text, at) => typeof text === 'string' && text.includes(at);

/**
 * Presentational fields on an info item. None of them may add information:
 * each one restates something the item's own cited text already says, and
 * where the field carries a time or a direction, the build checks that the
 * text says it in so many words.
 *   icon   — one word from the slip pictogram vocabulary.
 *   chain  — the warning-chain links this item shows used / cut / unused /
 *            pending; `at` must appear verbatim in the text; `zones` must be a
 *            subset of the item's own zones.
 *   origin — true, or an HH:MM in the text: the record first places the
 *            hazard in this item's (single) zone. One per zone.
 *   wind   — { from: compass point }: the text must say "<direction> wind(s)".
 */
function checkPresentation(chk, info, q, origins) {
  if (info.icon !== undefined) {
    chk.require(ICONS.has(info.icon), `${q}.icon`, `"${info.icon}" is not in the pictogram vocabulary (${[...ICONS].join('|')})`);
  }
  if (info.chain !== undefined) {
    if (chk.require(Array.isArray(info.chain) && info.chain.length > 0, `${q}.chain`, 'must be a non-empty array of { link, state }')) {
      for (const [k, c] of info.chain.entries()) {
        const r = `${q}.chain[${k}]`;
        if (!chk.require(c && typeof c === 'object', r, 'must be an object')) continue;
        chk.require(CHAIN_LINKS.has(c.link), `${r}.link`, `must be one of ${[...CHAIN_LINKS].join('|')}`);
        chk.require(CHAIN_STATES.has(c.state), `${r}.state`, `must be one of ${[...CHAIN_STATES].join('|')}`);
        if (c.link === 'forecast') chk.require(c.state === 'used', `${r}.state`, 'the forecast link is only ever "used" (the warning reached the desk)');
        if (c.at !== undefined) {
          chk.require(HHMM.test(c.at ?? '') && saysTime(info.text, c.at), `${r}.at`,
            `"${c.at}" must be an HH:MM that the item's own text states`);
        }
        if (c.zones !== undefined) {
          const own = new Set(info.zones ?? []);
          chk.require(Array.isArray(c.zones) && c.zones.length > 0 && c.zones.every((z) => own.has(z)), `${r}.zones`,
            "must be a non-empty subset of the item's own zones");
        }
      }
    }
  }
  if (info.origin !== undefined) {
    const ok = info.origin === true || (typeof info.origin === 'string' && HHMM.test(info.origin) && saysTime(info.text, info.origin));
    chk.require(ok, `${q}.origin`, 'must be true or an HH:MM that the item\'s own text states');
    if (chk.require(Array.isArray(info.zones) && info.zones.length === 1, `${q}.origin`, 'an origin mark needs exactly one zone')) {
      chk.require(!origins.has(info.zones[0]), `${q}.origin`, `zone "${info.zones[0]}" already has an origin mark`);
      origins.add(info.zones[0]);
    }
    chk.require(info.board_state !== 'none', `${q}.origin`, 'an item that lights nothing cannot place the hazard');
  }
  if (info.wind !== undefined) {
    const word = VOCAB.compass[info.wind?.from];
    if (chk.require(!!word, `${q}.wind.from`, `must be one of ${Object.keys(VOCAB.compass).join('|')}`)) {
      chk.require(new RegExp(`\\b${word}(erly)?\\s+winds?\\b`, 'i').test(info.text ?? ''), `${q}.wind`,
        `the item's text does not say "${info.wind.from}" winds — the board may only restate a stated direction`);
    }
  }
}

/**
 * Instrument readings: a drawn restatement of what an item says an instrument
 * (a river gauge, a dam, a fire's containment, the hydrants) read. Each
 * reading names a series the scenario declares in `instruments`, a state from
 * the shared vocabulary whose phrase the item's own text must contain, and
 * optionally the HH:MM the text gives it (`by: true` prints "by HH:MM") and a
 * value whose every number the text already prints. Within a series the
 * readings run forward in time, and a series is either timed throughout (drawn
 * on a clock axis) or untimed throughout (drawn in log order) — never a mix,
 * so the drawing never places a reading at a time the record does not give.
 */
function checkReadings(chk, info, q, s, series) {
  if (info.readings === undefined) return;
  if (!chk.require(Array.isArray(info.readings) && info.readings.length > 0, `${q}.readings`, 'must be a non-empty array of { series, state }')) return;
  const declared = s.instruments && typeof s.instruments === 'object' ? s.instruments : {};
  for (const [k, r] of info.readings.entries()) {
    const p = `${q}.readings[${k}]`;
    if (!chk.require(r && typeof r === 'object', p, 'must be an object')) continue;
    chk.require(typeof r.series === 'string' && Object.hasOwn(declared, r.series), `${p}.series`,
      `"${r.series}" is not declared in the scenario's instruments`);
    const st = READINGS[r.state];
    if (chk.require(!!st && r.state !== '_comment', `${p}.state`, `must be one of ${Object.keys(READINGS).filter((x) => x !== '_comment').join('|')}`)) {
      chk.require(new RegExp(st.says, 'i').test(info.text ?? ''), `${p}.state`,
        `the item's text does not say "${st.label}" — a drawn reading may only restate the slip`);
    }
    if (r.at !== undefined) {
      chk.require(HHMM.test(r.at ?? '') && saysTime(info.text, r.at), `${p}.at`, `"${r.at}" must be an HH:MM that the item's own text states`);
    }
    if (r.by !== undefined) chk.require(r.by === true && r.at !== undefined, `${p}.by`, 'only `true`, and only with an `at`');
    if (r.value !== undefined) {
      const nums = numbersIn(r.value);
      const said = new Set(numbersIn(info.text));
      chk.require(typeof r.value === 'string' && r.value.length <= 16 && nums.length > 0 && nums.every((n) => said.has(n)), `${p}.value`,
        'a value of at most 16 characters whose every number the item\'s text already prints');
    }
    if (typeof r.series !== 'string') continue;
    const prev = series.get(r.series);
    const timed = r.at !== undefined;
    if (prev) {
      chk.require(prev.timed === timed, `${p}.at`, `series "${r.series}" mixes timed and untimed readings`);
      if (timed && prev.at) chk.require(r.at >= prev.at, `${p}.at`, `series "${r.series}" runs backwards in time (${r.at} after ${prev.at})`);
    }
    series.set(r.series, { timed, at: timed ? r.at : prev?.at });
  }
}

/** Short series names for the instrument drawings. */
function checkInstruments(chk, s) {
  if (s.instruments === undefined) return;
  if (!chk.require(s.instruments && typeof s.instruments === 'object' && !Array.isArray(s.instruments), 'instruments', 'must be an object of id → label')) return;
  for (const [k, v] of Object.entries(s.instruments)) {
    chk.require(/^[a-z0-9-]+$/.test(k), `instruments.${k}`, 'id must be kebab-case');
    chk.require(typeof v === 'string' && v.trim().length > 0 && v.length <= 40, `instruments.${k}`, 'a label of 1–40 characters');
  }
}

/** Scenario-level labels for the warning-chain diagram: short names only. */
function checkChainLabels(chk, wc, s) {
  if (!chk.require(wc && typeof wc === 'object' && !Array.isArray(wc), 'warning_chain', 'must be an object')) return;
  for (const [k, v] of Object.entries(wc.labels ?? {})) {
    chk.require(CHAIN_LABEL_KEYS.has(k), `warning_chain.labels.${k}`, `key must be one of ${[...CHAIN_LABEL_KEYS].join('|')}`);
    // forecast / desk boxes are wide; a channel box holds about 11 characters.
    const max = k === 'forecast' || k === 'desk' ? 18 : 11;
    chk.require(typeof v === 'string' && v.trim().length > 0 && v.length <= max, `warning_chain.labels.${k}`, `a label of 1–${max} characters`);
  }
  const known = new Set((s.scoring?.at_risk_zones ?? []).map((z) => z.id));
  for (const [k, v] of Object.entries(wc.zones ?? {})) {
    chk.require(known.has(k), `warning_chain.zones.${k}`, 'must be a scoring.at_risk_zones id');
    chk.require(typeof v === 'string' && v.trim().length > 0 && v.length <= 14, `warning_chain.zones.${k}`, 'a short label of 1–14 characters');
  }
}

/** Every number a sentence prints ("16:30", "1,686", "9"), as written. */
const numbersIn = (text) => (typeof text === 'string' ? text.match(/\d+(?:[.,:]\d+)*/g) ?? [] : []);

/**
 * "What the record teaches": a lesson in the project's words, one sentence,
 * tied to ONE cited line of the scenario — an inquiry finding (`from.finding`,
 * its index) or a historical-path entry (`from.step`, its timestep id). The
 * lesson's citation must be that line's own source, and the lesson may not
 * print a number its line does not already print: a reading of the record
 * can sharpen it, never add to it.
 */
function checkTakeaways(chk, s, sourceIds) {
  if (!chk.require(Array.isArray(s.takeaways) && s.takeaways.length >= 1 && s.takeaways.length <= 4,
    'takeaways', 'must be an array of 1–4 lessons')) return;
  for (const [i, t] of s.takeaways.entries()) {
    const p = `takeaways[${i}]`;
    if (!chk.require(t && typeof t === 'object', p, 'must be an object')) continue;
    const ok = chk.require(typeof t.text === 'string' && t.text.trim().length >= 20 && t.text.length <= 280,
      `${p}.text`, 'one sentence of 20–280 characters');
    if (ok) chk.require(!PLACEHOLDER.test(t.text), `${p}.text`, 'placeholder text in a playable scenario');
    checkCitation(chk, t.citation, `${p}.citation`, sourceIds, true);

    // Which cited line the lesson is drawn from.
    const from = t.from ?? {};
    const hasF = from.finding !== undefined;
    const hasS = from.step !== undefined;
    if (!chk.require(hasF !== hasS, `${p}.from`, 'must name exactly one cited line: { finding: <index> } or { step: <timestep id> }')) continue;
    let line = null; // { sourceId, text }
    if (hasF) {
      const f = Number.isInteger(from.finding) ? s.inquiry_findings?.[from.finding] : undefined;
      if (chk.require(!!f, `${p}.from.finding`, `must be an index into inquiry_findings (0–${(s.inquiry_findings?.length ?? 1) - 1})`)) {
        line = { sourceId: f.citation?.sourceId, text: `${f.quote ?? ''} ${f.translation ?? ''}` };
      }
    } else {
      const h = (s.historical_path ?? []).find((x) => x.timestep_id === from.step);
      if (chk.require(!!h, `${p}.from.step`, 'must be a timestep id that has a historical_path entry')) {
        line = { sourceId: h.citation?.sourceId, text: h.action ?? '' };
      }
    }
    if (!line) continue;
    chk.require(t.citation?.sourceId === line.sourceId, `${p}.citation`,
      `must cite the source of the line it is drawn from ("${line.sourceId}")`);
    for (const n of numbersIn(t.text)) {
      chk.require(line.text.includes(n), `${p}.text`,
        `prints "${n}", which the line it is drawn from does not — a lesson may not add a figure`);
    }
  }
}

/**
 * "Terms of the desk": a civilian's gloss on a word the slips use. Each entry
 * is an official definition, quoted (`verbatim`) or tightly paraphrased
 * (`paraphrase`), with a citation like any other fact. `match` lists the
 * spellings that mark the term in the slips (whole words, case-sensitive);
 * at least one must actually appear on the desk, or the gloss explains
 * nothing the player will meet.
 */
function checkGlossary(chk, s, sourceIds) {
  if (!chk.require(Array.isArray(s.glossary) && s.glossary.length >= 1, 'glossary', 'must be a non-empty array')) return;
  const desk = (s.timesteps ?? []).flatMap((t) => (t.info_available ?? []).map((i) => i.text ?? ''));
  const esc = (x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const terms = new Set();
  for (const [i, g] of s.glossary.entries()) {
    const p = `glossary[${i}]`;
    if (!chk.require(g && typeof g === 'object', p, 'must be an object')) continue;
    if (chk.require(typeof g.term === 'string' && g.term.trim().length > 0 && g.term.length <= 48, `${p}.term`, 'a term of 1–48 characters')) {
      chk.require(!terms.has(g.term), `${p}.term`, `duplicate term "${g.term}"`);
      terms.add(g.term);
    }
    chk.require(g.kind === 'verbatim' || g.kind === 'paraphrase', `${p}.kind`, 'must be "verbatim" or "paraphrase"');
    if (chk.require(typeof g.definition === 'string' && g.definition.trim().length > 0 && g.definition.length <= 320,
      `${p}.definition`, 'a definition of 1–320 characters')) {
      chk.require(!PLACEHOLDER.test(g.definition), `${p}.definition`, 'placeholder definition in a playable scenario');
    }
    if (g.translation !== undefined) chk.require(typeof g.translation === 'string' && g.translation.length > 0, `${p}.translation`, 'must be a string when present');
    checkCitation(chk, g.citation, `${p}.citation`, sourceIds, true);
    if (chk.require(Array.isArray(g.match) && g.match.length > 0 && g.match.every((m) => typeof m === 'string' && m.length >= 2),
      `${p}.match`, 'must be a non-empty array of spellings (2+ characters)')) {
      const onDesk = g.match.some((m) => desk.some((text) => new RegExp(`\\b${esc(m)}\\b`).test(text)));
      chk.require(onDesk, `${p}.match`, 'none of these spellings appears in any slip — a gloss must explain a word the player meets');
    }
  }
}

/**
 * When the real first public warnings came before the one-day clock opens,
 * `historical_first_public_alert` (an HH:MM on this day) would flatter or
 * distort the officials' lead time. `alert_predates_clock` says so, and is
 * held to the takeaway discipline: it is drawn from ONE info item whose own
 * text names the earlier day (its date, "8 October", or its weekday,
 * "Saturday"); its citation is that item's source; its note prints no number
 * the item does not print; an optional `time` is one the item states. The UI
 * computes "N days before this clock" from `date` and prints `clock_alert` —
 * what the day's HH:MM figure actually is — beside it.
 */
function checkAlertPredates(chk, s, sourceIds) {
  const a = s.alert_predates_clock;
  const p = 'alert_predates_clock';
  if (!chk.require(a && typeof a === 'object' && !Array.isArray(a), p, 'must be an object')) return;
  const dateOk = chk.require(typeof a.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(a.date) && !Number.isNaN(Date.parse(`${a.date}T00:00:00Z`)),
    `${p}.date`, 'must be a real YYYY-MM-DD');
  if (dateOk) chk.require(a.date < s.date, `${p}.date`, `must be before the scenario day (${s.date}) — a warning on the clock needs no note`);
  if (chk.require(typeof a.note === 'string' && a.note.trim().length >= 20 && a.note.length <= 280, `${p}.note`, 'one sentence of 20–280 characters')) {
    chk.require(!PLACEHOLDER.test(a.note), `${p}.note`, 'placeholder text in a playable scenario');
  }
  chk.require(typeof a.clock_alert === 'string' && a.clock_alert.trim().length > 0 && a.clock_alert.length <= 60, `${p}.clock_alert`,
    `what the day's ${s.scoring?.historical_first_public_alert ?? 'HH:MM'} figure is, in 1–60 characters`);
  checkCitation(chk, a.citation, `${p}.citation`, sourceIds, true);

  const info = (s.timesteps ?? []).flatMap((t) => t.info_available ?? []).find((i) => i.id === a.from);
  if (!chk.require(!!info, `${p}.from`, 'must be the id of an info item that states the earlier warning')) return;
  chk.require(a.citation?.sourceId === info.citation?.sourceId, `${p}.citation`,
    `must cite the source of the item it is drawn from ("${info.citation?.sourceId}")`);
  if (dateOk) {
    const d = new Date(`${a.date}T00:00:00Z`);
    const day = d.getUTCDate();
    const month = MONTHS[d.getUTCMonth()];
    const names = [`${day} ${month}`, `${month} ${day}`, WEEKDAYS[d.getUTCDay()]];
    chk.require(names.some((n) => new RegExp(`\\b${n}\\b`).test(info.text ?? '')), `${p}.date`,
      `item ${info.id} does not name ${a.date} ("${names.join('" / "')}") — the date must be one the record states`);
  }
  if (a.time !== undefined) {
    chk.require(HHMM.test(a.time ?? '') && saysTime(info.text, a.time), `${p}.time`, `"${a.time}" must be an HH:MM that item ${info.id} states`);
  }
  if (typeof a.note === 'string') {
    const said = new Set(numbersIn(info.text)); // whole numbers as printed: "6" is not in "06:30"
    for (const n of numbersIn(a.note)) {
      chk.require(said.has(n),`${p}.note`, `prints "${n}", which item ${info.id} does not — the note may not add a figure`);
    }
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
  // The hazard picks the board's words (hazards.ts); a word the UI has no family for cannot ship.
  if (typeof s.hazard === 'string') {
    chk.require(HAZARD_FAMILIES.some(([, f]) => new RegExp(f.match, 'i').test(s.hazard)), 'hazard',
      `"${s.hazard}" names no hazard family in vocabulary.json (${HAZARD_FAMILIES.map(([k, f]) => `${k}: ${f.match}`).join('; ')})`);
  }

  if (s.briefing_media !== undefined) checkMedia(chk, s.briefing_media, 'briefing_media', s.id, s.date);
  if (s.debrief_media !== undefined) {
    if (chk.require(Array.isArray(s.debrief_media), 'debrief_media', 'must be an array of media attachments')) {
      s.debrief_media.forEach((m, i) => checkMedia(chk, m, `debrief_media[${i}]`, s.id, null));
    }
  }

  if (s.warning_chain !== undefined) checkChainLabels(chk, s.warning_chain, s);
  checkInstruments(chk, s);
  const series = new Map(); // instrument series → { timed, at } as the log reaches it

  chk.require(Array.isArray(s.timesteps) && s.timesteps.length >= 2, 'timesteps', 'a playable scenario needs at least 2 timesteps');
  const stepIds = new Set();
  const origins = new Set(); // zones that already carry an origin mark
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
      if (info.board_state !== undefined) {
        chk.require(BOARD_STATES.has(info.board_state), `${q}.board_state`, `must be one of ${[...BOARD_STATES].join('|')}`);
        chk.require(Array.isArray(info.zones) && info.zones.length > 0, `${q}.board_state`, 'only meaningful on an item with zones');
      }
      if (info.media !== undefined) checkMedia(chk, info.media, `${q}.media`, s.id, s.date);
      checkPresentation(chk, info, q, origins);
      checkReadings(chk, info, q, s, series);
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

  if (s.takeaways !== undefined) checkTakeaways(chk, s, sourceIds);
  if (s.glossary !== undefined) checkGlossary(chk, s, sourceIds);
  if (s.alert_predates_clock !== undefined) checkAlertPredates(chk, s, sourceIds);

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
const figures = playable.reduce((n, sc) => n
  + (sc.briefing_media ? 1 : 0)
  + (sc.debrief_media?.length ?? 0)
  + sc.timesteps.reduce((k, t) => k + t.info_available.filter((i) => i.media).length, 0), 0);
console.log(`scenarios: ${playable.length} playable, ${stubs.length} stub(s), ${figures} media attachment(s) checked → src/data/scenarios.json`);
