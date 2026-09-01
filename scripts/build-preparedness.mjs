// Builds the layer files for /preparedness: a country-by-country look at
// disaster-risk composite indices, epidemic-response self-assessments,
// humanitarian funding gaps, and (once dropped in by hand) loss data and
// displacement figures that no open API will hand over.
//
// Nine sources, nine very different postures:
//   INFORM Risk      reachable, but the "latest" workflow the API advertises
//                     (INFORM2025/2026 groups) is often an unpublished draft
//                     with no scores behind it -- the real numbers sit on
//                     the most recent workflow the API itself flags as
//                     data-saved. See pickWorkflow() below.
//   ND-GAIN           reachable, but only with a browser User-Agent (bare
//                     curl/fetch UAs get a 403) and only as a zip of ~500
//                     deflated CSVs -- unzipped by hand below with node's
//                     built-in zlib, no archiver dependency needed.
//   WHO SPAR          reachable, GHO OData, straightforward.
//   OCHA FTS          reachable at api.hpc.tools (the api.fts.unocha.org
//                     alias is blocked from here); funding-received has to
//                     be pulled per year from the flow-search endpoint
//                     separately from each plan's requirements.
//   World Bank pop    reachable, cached now for EM-DAT's future per-capita
//                     maths even though EM-DAT itself is stubbed today.
//   EM-DAT, IDMC,     registration-gated or key-gated. No scraping. Each
//   Sendai G, L&D     ships as a "not_loaded" stub with drop-in instructions
//                     for the site owner, and the loader is fully written
//                     and waiting for that file to appear.
//
// Every layer file is regenerated from scratch each run except the raw
// caches under data/preparedness/raw/, which persist so re-runs are instant
// and reviewable -- delete a raw file to force that one source to refetch.
//
// Run with: npm run build:preparedness (also runs build-preparedness-geometry
// first, per the package.json script -- this file does not touch world.json).

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateRawSync } from 'node:zlib';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const rawDir = resolve(root, 'data/preparedness/raw');
const outDir = resolve(root, 'public/data/preparedness');
mkdirSync(rawDir, { recursive: true });
mkdirSync(outDir, { recursive: true });

const TODAY = new Date().toISOString().slice(0, 10);
const round2 = (n) => (typeof n === 'number' && Number.isFinite(n) ? Math.round(n * 100) / 100 : null);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ── Cache-through fetch helpers ───────────────────────────────────────────
   Every raw response lands in data/preparedness/raw/ under its own name so
   a rerun is deterministic and a reviewer can diff exactly what a source
   handed back. Delete a file to force that fetch to happen again.        */

// The INFORM API in particular has bad moments (empty replies, 503s) under
// no discernible load pattern; a handful of gentle retries clears most of
// them, same spirit as build-dispatches's patience with Arctic Shift.
async function fetchWithRetry(url, opts = {}, tries = 5) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'crises-cinema preparedness build (contact: github.com/samfrons/Crises-Cinema)', ...opts.headers },
        signal: AbortSignal.timeout(opts.timeout ?? 45000),
      });
      if (!res.ok && res.status >= 500 && i < tries - 1) throw new Error(`${url} -> ${res.status}`);
      if (!res.ok) throw new Error(`${url} -> ${res.status}`);
      return res;
    } catch (e) {
      if (i === tries - 1) throw e;
      await sleep(1500 * (i + 1));
    }
  }
}

async function cachedText(url, file, opts = {}) {
  const path = resolve(rawDir, file);
  if (existsSync(path)) return readFileSync(path, 'utf8');
  const res = await fetchWithRetry(url, opts);
  const text = await res.text();
  writeFileSync(path, text);
  return text;
}

async function cachedJson(url, file, opts = {}) {
  return JSON.parse(await cachedText(url, file, opts));
}

async function cachedBinary(url, file, opts = {}) {
  const path = resolve(rawDir, file);
  if (existsSync(path)) return readFileSync(path);
  const res = await fetchWithRetry(url, { ...opts, timeout: opts.timeout ?? 60000 });
  const buf = Buffer.from(await res.arrayBuffer());
  writeFileSync(path, buf);
  return buf;
}

/* A "not loaded" stub layer, for a source this script cannot reach on its
   own. Shape matches the loaded shape minus `countries`, so the page's
   empty state has everything it needs to explain the gap to a reader. */
function stub({ id, label, hazardDimension, hazards, unit, scale, source, instructions }) {
  return { id, label, status: 'not_loaded', hazardDimension, ...(hazards ? { hazards } : {}), unit, scale, source, instructions };
}

console.log(`preparedness: build started ${TODAY}`);
const layers = []; // { id, file, status, label } for manifest.json
const meta = { loaded: [], stubbed: [], countryCounts: {} };

/* ══════════════════════════════════════════════════════════════════════════
   1. INFORM Risk (EC JRC DRMKC)
   ══════════════════════════════════════════════════════════════════════════
   The workflow-group listing advertises workflows years out from "now" that
   turn out to be empty shells -- FlagDataSaved stays null until JRC actually
   commits scores to one. So: ask for the group, keep only workflows the API
   itself marks data-saved, and take the newest of those by reference year
   (GNAYear). Try INFORM2026 first per the brief; it doesn't exist yet as of
   this build, so this falls through to INFORM2025 every time that's true. */

const INFORM_BASE = 'https://drmkc.jrc.ec.europa.eu/Inform-Index/API/InformAPI';

// The canonical hazard keys this layer can speak to, and which node in
// INFORM's process tree (Processes/GetByWorkflowId) supplies each one.
// Tsunami (HA.NAT.TS) is its own sibling of HA.NAT.EQ in that tree, not a
// sub-component of it -- INFORM does not group them, so per the brief we
// do not fold it into "earthquake"; it's simply not carried on the page.
const INFORM_HAZARDS = {
  earthquake: 'HA.NAT.EQ',
  flood: 'HA.NAT.FL',
  storm: 'HA.NAT.TC',
  drought: 'HA.NAT.DR',
  epidemic: 'HA.NAT.EPI',
  // HA.HUM is the whole Human Hazard branch (conflict probability + UCDP
  // current-intensity), not conflict intensity alone -- the closest thing
  // INFORM has to a single "conflict" figure. Documented in limitations.
  conflict: 'HA.HUM',
};

async function pickInformWorkflow() {
  for (const group of ['INFORM2026', 'INFORM2025']) {
    let list;
    try {
      list = await cachedJson(
        `${INFORM_BASE}/workflows/GetByWorkflowGroup/${group}`,
        `inform-workflows-${group}.json`,
      );
    } catch {
      continue;
    }
    const published = list.filter((w) => w.FlagDataSaved);
    if (!published.length) continue;
    published.sort((a, b) => b.GNAYear - a.GNAYear);
    return { group, workflow: published[0] };
  }
  return null;
}

async function buildInform() {
  const id = 'inform';
  const label = 'INFORM Risk';
  const source = {
    publisher: 'European Commission, Joint Research Centre (JRC) — INFORM initiative',
    url: 'https://drmkc.jrc.ec.europa.eu/inform-index',
    license: 'CC BY 4.0',
    asOf: null,
    retrieved: TODAY,
    limitations: [
      'A composite of ~50 indicators combined by geometric mean under fixed, expert-assigned weights — the ranking is sensitive to those weighting choices, which INFORM itself revisits and revises most years.',
      'Most component indicators (population, GDP, WASH access, governance scores) are themselves modeled or survey-based estimates one to three years old at publication, not real-time measurements.',
      'Hazard & Exposure sub-scores measure physical exposure (population in a hazard zone), not the probability an event occurs in any given year — a high score does not mean a disaster is imminent.',
      'The "Lack of Coping Capacity" figure folds together very different kinds of readiness (health infrastructure, governance, disaster risk reduction institutions) into one number, which can mask which one is actually weak.',
    ],
  };

  const picked = await pickInformWorkflow();
  if (!picked) {
    return stub({
      id, label, hazardDimension: true, hazards: Object.keys(INFORM_HAZARDS),
      unit: 'INFORM Risk score, 0–10', scale: { min: 0, max: 10, higherIs: 'worse' },
      source,
      instructions: 'No INFORM workflow group returned a published (FlagDataSaved) workflow. Check '
        + 'https://drmkc.jrc.ec.europa.eu/Inform-Index/API/InformAPI/workflows/GetByWorkflowGroup/INFORM2025 '
        + 'by hand, find the highest-GNAYear entry with a non-null FlagDataSaved, and rerun npm run build:preparedness.',
    });
  }
  const wf = picked.workflow;
  console.log(`  inform: using workflow ${wf.WorkflowId} "${wf.Name}" (${picked.group}, reference year ${wf.GNAYear})`);
  source.asOf = String(wf.GNAYear);

  async function scoresFor(indicatorId) {
    const rows = await cachedJson(
      `${INFORM_BASE}/Countries/Scores?workflowid=${wf.WorkflowId}&indicatorid=${indicatorId}`,
      `inform-scores-${wf.WorkflowId}-${indicatorId}.json`,
    );
    const byIso3 = new Map();
    for (const r of rows) byIso3.set(r.Iso3, r.IndicatorScore);
    return byIso3;
  }

  const overall = await scoresFor('INFORM');
  const ha = await scoresFor('HA');
  const vu = await scoresFor('VU');
  const cc = await scoresFor('CC');
  const hazardScores = {};
  for (const [hazard, indicatorId] of Object.entries(INFORM_HAZARDS)) {
    hazardScores[hazard] = await scoresFor(indicatorId);
  }

  const countries = {};
  for (const [iso3, score] of overall) {
    if (score == null || score < 0) continue; // INFORM uses -99-ish sentinels for "not computed"
    const byHazard = {};
    for (const hazard of Object.keys(INFORM_HAZARDS)) {
      const v = hazardScores[hazard].get(iso3);
      if (v != null && v >= 0) byHazard[hazard] = round2(v);
    }
    countries[iso3] = {
      score: round2(score),
      components: {
        'Hazard & Exposure': round2(ha.get(iso3)),
        'Vulnerability': round2(vu.get(iso3)),
        'Lack of Coping Capacity': round2(cc.get(iso3)),
      },
      ...(Object.keys(byHazard).length ? { byHazard } : {}),
    };
  }

  return {
    id, label, status: 'loaded', hazardDimension: true, hazards: Object.keys(INFORM_HAZARDS),
    unit: 'INFORM Risk score, 0–10', scale: { min: 0, max: 10, higherIs: 'worse' },
    source, countries,
  };
}

/* ══════════════════════════════════════════════════════════════════════════
   2. ND-GAIN (Notre Dame Global Adaptation Initiative)
   ══════════════════════════════════════════════════════════════════════════
   gain.nd.edu 403s any request without a browser-shaped User-Agent (the
   brief's own probe hit this); with one, the "Download Data" page's zip
   link is a real, public archive. It's ~500 deflated CSVs behind a plain
   ZIP central directory — small enough to walk by hand with node:zlib,
   which is a Node built-in, not a dependency.                            */

const NDGAIN_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15';

/** Minimal ZIP reader: walk the central directory, inflate on demand.
    Handles the two compression methods ND-GAIN's zip actually uses
    (0 = stored, 8 = deflate); anything else throws rather than silently
    returning wrong bytes. */
function readZipEntries(buf) {
  // Find the End Of Central Directory record by its signature, scanning
  // back from the end (there can be a variable-length comment after it).
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('not a zip (no EOCD record found)');
  const entryCount = buf.readUInt16LE(eocd + 10);
  let cdOffset = buf.readUInt32LE(eocd + 16);

  const entries = new Map(); // name -> lazily-inflated Buffer
  for (let i = 0; i < entryCount; i++) {
    if (buf.readUInt32LE(cdOffset) !== 0x02014b50) throw new Error(`bad central directory entry at ${cdOffset}`);
    const method = buf.readUInt16LE(cdOffset + 10);
    const compSize = buf.readUInt32LE(cdOffset + 20);
    const nameLen = buf.readUInt16LE(cdOffset + 28);
    const extraLen = buf.readUInt16LE(cdOffset + 30);
    const commentLen = buf.readUInt16LE(cdOffset + 32);
    const localOffset = buf.readUInt32LE(cdOffset + 42);
    const name = buf.toString('utf8', cdOffset + 46, cdOffset + 46 + nameLen);

    entries.set(name, () => {
      const lfNameLen = buf.readUInt16LE(localOffset + 26);
      const lfExtraLen = buf.readUInt16LE(localOffset + 28);
      const dataStart = localOffset + 30 + lfNameLen + lfExtraLen;
      const raw = buf.subarray(dataStart, dataStart + compSize);
      if (method === 0) return raw;
      if (method === 8) return inflateRawSync(raw);
      throw new Error(`${name}: unsupported zip compression method ${method}`);
    });
    cdOffset += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

/** ND-GAIN's CSVs are wide-by-year, quoted, comma-separated, no embedded
    commas inside fields — a straight split is safe and keeps this script
    dependency-free. Returns { iso3 -> { year -> value } }. */
function parseNdgainCsv(text) {
  const lines = text.trim().split('\n').map((l) => l.trim());
  const header = lines[0].split(',').map((h) => h.replace(/^"|"$/g, ''));
  const years = header.slice(2);
  const out = new Map();
  for (const line of lines.slice(1)) {
    const cells = line.split(',').map((c) => c.replace(/^"|"$/g, ''));
    const iso3 = cells[0];
    if (!iso3 || iso3.length !== 3) continue;
    const byYear = {};
    years.forEach((y, i) => {
      const v = Number(cells[2 + i]);
      if (Number.isFinite(v)) byYear[y] = v;
    });
    out.set(iso3, byYear);
  }
  return out;
}

/** Latest year that has a real (non-empty) value for this country. */
function latestValue(byYear) {
  const years = Object.keys(byYear).sort((a, b) => Number(b) - Number(a));
  return years.length ? { year: years[0], value: byYear[years[0]] } : null;
}

async function buildNdgain() {
  const id = 'ndgain';
  const label = 'ND-GAIN Country Index';
  const source = {
    publisher: 'University of Notre Dame — Notre Dame Global Adaptation Initiative (ND-GAIN)',
    url: 'https://gain.nd.edu/our-work/country-index/',
    license: 'ND-GAIN Terms of Use (gain.nd.edu) — the data is published for open reuse; the exact current license text could not be confirmed from an automated fetch of the site in this build, so verify citation requirements at the URL above before redistributing.',
    asOf: null,
    retrieved: TODAY,
    limitations: [
      'Readiness (one of the two halves of the composite) correlates strongly with GDP per capita, so wealthy countries score as "ready" largely because they are wealthy, independent of disaster-specific preparedness.',
      'The published index lags roughly two years behind the current date — the "latest" figure in any given year describes conditions from two years prior.',
      'Vulnerability and Readiness are each themselves composites of dozens of proxy indicators (e.g. "political stability" for governance); the single overall score obscures large country-to-country differences in which underlying proxy is driving it.',
    ],
    instructions: null,
  };
  const notLoadedInstructions = 'Automated fetch of the ND-GAIN country-index zip failed (gain.nd.edu blocks '
    + 'non-browser User-Agents, and its download link can move between editions). Open '
    + 'https://gain.nd.edu/our-work/country-index/download-data/ in a browser, download the current zip, and '
    + 'save it as data/preparedness/raw/ndgain.zip, then rerun npm run build:preparedness — the loader will '
    + 'extract gain/gain.csv, readiness/readiness.csv and vulnerability/vulnerability.csv from it directly.';

  try {
    let zipBuf;
    const zipPath = resolve(rawDir, 'ndgain.zip');
    if (existsSync(zipPath)) {
      zipBuf = readFileSync(zipPath);
    } else {
      const page = await cachedText(
        'https://gain.nd.edu/our-work/country-index/download-data/',
        'ndgain-download-page.html',
        { headers: { 'User-Agent': NDGAIN_UA } },
      );
      const m = page.match(/href="(\/assets\/\d+\/ndgain_countryindex_\d+\.zip)"/);
      if (!m) throw new Error('could not find the country-index zip link on the download page');
      zipBuf = await cachedBinary(`https://gain.nd.edu${m[1]}`, 'ndgain.zip', { headers: { 'User-Agent': NDGAIN_UA } });
    }

    const entries = readZipEntries(zipBuf);
    const findEntry = (suffix) => {
      const name = [...entries.keys()].find((n) => n.endsWith(suffix) && !n.includes('__MACOSX'));
      if (!name) throw new Error(`zip did not contain a file ending in ${suffix}`);
      return entries.get(name)().toString('utf8');
    };
    const gain = parseNdgainCsv(findEntry('gain/gain.csv'));
    const readiness = parseNdgainCsv(findEntry('readiness/readiness.csv'));
    const vulnerability = parseNdgainCsv(findEntry('vulnerability/vulnerability.csv'));

    let asOfYear = null;
    const countries = {};
    for (const [iso3, byYear] of gain) {
      const latest = latestValue(byYear);
      if (!latest) continue;
      if (!asOfYear || Number(latest.year) > Number(asOfYear)) asOfYear = latest.year;
      const r = latestValue(readiness.get(iso3) ?? {});
      const v = latestValue(vulnerability.get(iso3) ?? {});
      countries[iso3] = {
        score: round2(latest.value),
        // ND-GAIN's own readiness.csv/vulnerability.csv are 0–1 fractions
        // while gain.csv (the composite) is 0–100 — rescaled by 100 here so
        // every number in `components` reads on the same 0–100 unit as the
        // overall score and the layer's declared scale.
        components: {
          Readiness: r ? round2(r.value * 100) : null,
          Vulnerability: v ? round2(v.value * 100) : null,
        },
      };
    }
    source.asOf = asOfYear;

    return {
      id, label, status: 'loaded', hazardDimension: false,
      unit: 'ND-GAIN score, 0–100', scale: { min: 0, max: 100, higherIs: 'better' },
      source, countries,
    };
  } catch (e) {
    console.log(`  ndgain: not loaded (${e.message})`);
    delete source.instructions;
    return stub({
      id, label, hazardDimension: false,
      unit: 'ND-GAIN score, 0–100', scale: { min: 0, max: 100, higherIs: 'better' },
      source, instructions: notLoadedInstructions,
    });
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   3. EM-DAT (CRED / UCLouvain) — registration-gated, no scraping directly.
   ══════════════════════════════════════════════════════════════════════════
   CRED will not hand over a bulk export without a free account, but they
   license per-country, per-hazard-type EM-DAT death series to Our World in
   Data, which republishes them openly as a processed CSV mirror — same
   underlying EM-DAT records, citation intact, no registration wall. That's
   the automatic path below. A registered EM-DAT export dropped in at
   data/preparedness/raw/emdat.csv is still read first when present: it
   carries affected-persons and damage figures OWID's mirror does not, so
   it remains the higher-fidelity, canonical upgrade path.               */

const EMDAT_INSTRUCTIONS = 'This layer is currently filled from Our World in Data\'s mirror of EM-DAT (see below) '
  + 'rather than a registered EM-DAT export, so it carries deaths only — no affected-persons or damage figures, '
  + 'which OWID\'s processed mirror does not carry per-country/per-type. For the canonical, fuller EM-DAT figures: '
  + 'register a free account at https://public.emdat.be, run a query for all disaster types from 2000 onward, '
  + 'export, and if the export is .xlsx convert it to .csv (e.g. open in a spreadsheet app and "Save As CSV" — '
  + 'this script parses CSV only, to stay dependency-free; it does not read .xlsx). Save the file as '
  + 'data/preparedness/raw/emdat.csv, keeping EM-DAT\'s own column headers, then rerun npm run build:preparedness '
  + '— a file at that path always takes priority over the OWID mirror. '
  + 'IMPORTANT — EM-DAT is licensed CC BY-NC-ND: non-commercial, no derivatives. This layer must not be sold, '
  + 'and any figures shown from it should be presented as EM-DAT\'s own numbers, not adapted or recombined into '
  + 'a derivative statistic (see data/preparedness/README.md).';

// Our World in Data's EM-DAT mirror, per hazard type, as annual death
// counts per country (grapher slug "deaths-from-natural-disasters-by-type",
// which 301-redirects from its old "natural-disasters-deaths" chart URL).
// Column -> canonical hazard. OWID also carries volcanic activity,
// landslide, extreme temperature and a mixed/other bucket with no canonical
// key here — dropped rather than stretched onto the wrong hazard, same
// treatment as tsunami in the INFORM layer.
const OWID_EMDAT_URL = 'https://ourworldindata.org/grapher/deaths-from-natural-disasters-by-type.csv?useColumnShortNames=true';
const OWID_EMDAT_META_URL = 'https://ourworldindata.org/grapher/deaths-from-natural-disasters-by-type.metadata.json';
const OWID_HAZARD_COLUMNS = {
  earthquake: 'total_dead_earthquake_yearly',
  flood: 'total_dead_flood_yearly',
  storm: 'total_dead_extreme_weather_yearly', // OWID's own column title for this is "Deaths - Storms"
  wildfire: 'total_dead_wildfire_yearly',
  drought: 'total_dead_drought_yearly',
};
const OWID_TOTAL_COLUMN = 'total_dead_all_disasters_yearly';

const EMDAT_HAZARD_MAP = [
  [/earthquake|tsunami/i, 'earthquake'],
  [/flood/i, 'flood'],
  [/storm/i, 'storm'],
  [/wildfire/i, 'wildfire'],
  [/drought/i, 'drought'],
  [/epidemic/i, 'epidemic'],
  [/industrial accident/i, 'industrial'],
];

/** Small, honest CSV parser: handles quoted fields with embedded commas
    and doubled quotes, which EM-DAT's own export uses. No dependency. */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') inQuotes = false;
      else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some((f) => f !== '')) rows.push(row);
      row = [];
    } else field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  if (!rows.length) return [];
  const header = rows[0];
  return rows.slice(1).map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ''])));
}

// Real, observed maximum of a set of scores — the UI treats a null scale
// max as "not loaded", so every loaded layer built from an open-ended
// count (deaths/100k, displacement totals, ...) sets its scale.max to
// whatever the data itself topped out at, not a guessed ceiling.
const scaleMax = (values) => (values.length ? round2(Math.max(...values)) : null);

async function buildEmdatFromDropIn(population) {
  const csvPath = resolve(rawDir, 'emdat.csv');
  if (!existsSync(csvPath)) return null;
  const rows = parseCsv(readFileSync(csvPath, 'utf8'));
  if (!rows.length) return { error: 'the dropped-in file parsed to zero rows — check it is EM-DAT\'s CSV export, not the xlsx.' };

  // EM-DAT's own export column names vary slightly by vintage; take
  // whichever of the known aliases is present rather than hardcoding one.
  const col = (row, names) => names.map((n) => row[n]).find((v) => v !== undefined && v !== '');
  const ISO3_COLS = ['ISO', 'ISO3', "Country ISO"];
  const YEAR_COLS = ['Start Year', 'Year'];
  const TYPE_COLS = ['Disaster Type', 'Disaster type'];
  const DEATHS_COLS = ['Total Deaths', 'Total deaths'];
  const AFFECTED_COLS = ['Total Affected', 'Total affected'];
  const DAMAGE_COLS = ["Total Damage, Adjusted ('000 US$)", 'Total Damage (\'000 US$)'];

  let minYear = null;
  let maxYear = null;
  const byCountry = new Map();
  for (const row of rows) {
    const iso3 = col(row, ISO3_COLS);
    const year = Number(col(row, YEAR_COLS));
    if (!iso3 || !Number.isFinite(year) || year < 2000) continue;
    minYear = minYear ? Math.min(minYear, year) : year;
    maxYear = maxYear ? Math.max(maxYear, year) : year;
    if (!byCountry.has(iso3)) byCountry.set(iso3, { deaths: 0, affected: 0, damageUsd: 0, byHazard: {} });
    const acc = byCountry.get(iso3);
    const deaths = Number(col(row, DEATHS_COLS)) || 0;
    const affected = Number(col(row, AFFECTED_COLS)) || 0;
    const damageThousandsUsd = Number(col(row, DAMAGE_COLS)) || 0;
    acc.deaths += deaths;
    acc.affected += affected;
    acc.damageUsd += damageThousandsUsd * 1000;

    const type = col(row, TYPE_COLS) ?? '';
    const hazard = EMDAT_HAZARD_MAP.find(([re]) => re.test(type))?.[1];
    if (hazard) acc.byHazard[hazard] = (acc.byHazard[hazard] ?? 0) + deaths;
  }
  if (!byCountry.size) return { error: 'the dropped-in file parsed but produced no usable per-country rows.' };

  const countries = {};
  const scores = [];
  for (const [iso3, acc] of byCountry) {
    const pop = population.get(iso3);
    const per100k = pop ? (acc.deaths / pop) * 100000 : null;
    if (per100k != null) scores.push(per100k);
    countries[iso3] = {
      score: per100k != null ? round2(per100k) : null,
      components: {
        'Total deaths (period)': acc.deaths,
        'Total affected (period)': acc.affected,
        'Total damage, USD (period)': Math.round(acc.damageUsd),
      },
      ...(Object.keys(acc.byHazard).length ? { byHazard: acc.byHazard } : {}),
    };
  }

  return {
    countries, asOf: `${minYear}–${maxYear}`, scaleMax: scaleMax(scores),
    hazards: Object.values(EMDAT_HAZARD_MAP.reduce((m, [, k]) => ({ ...m, [k]: k }), {})),
    publisher: 'CRED / UCLouvain — EM-DAT: The International Disaster Database (registered export)',
    unit: 'Deaths per 100,000 population, 2000–latest (score, scale capped at the observed maximum); components are period totals',
  };
}

/** The OWID mirror only carries deaths, by hazard type, per country per
    year — no affected-persons or damage figures (those aren't in OWID's
    processed columns), so this path's `components` is thinner than the
    registered-export path's. */
async function buildEmdatFromOwid(population) {
  let meta;
  let csvText;
  try {
    meta = await cachedJson(OWID_EMDAT_META_URL, 'owid-emdat-deaths-by-type.metadata.json');
    csvText = await cachedText(OWID_EMDAT_URL, 'owid-emdat-deaths-by-type.csv');
  } catch (e) {
    return { error: `OWID mirror fetch failed (${e.message})` };
  }
  const rows = parseCsv(csvText);
  if (!rows.length) return { error: 'OWID mirror returned an empty CSV' };

  let minYear = null;
  let maxYear = null;
  const byCountry = new Map();
  for (const row of rows) {
    const iso3 = row.code;
    const year = Number(row.year);
    if (!iso3 || iso3.length !== 3 || !Number.isFinite(year) || year < 2000) continue;
    minYear = minYear ? Math.min(minYear, year) : year;
    maxYear = maxYear ? Math.max(maxYear, year) : year;
    if (!byCountry.has(iso3)) byCountry.set(iso3, { totalDeaths: 0, byHazard: {} });
    const acc = byCountry.get(iso3);
    acc.totalDeaths += Number(row[OWID_TOTAL_COLUMN]) || 0;
    for (const [hazard, colName] of Object.entries(OWID_HAZARD_COLUMNS)) {
      const v = Number(row[colName]) || 0;
      if (v) acc.byHazard[hazard] = (acc.byHazard[hazard] ?? 0) + v;
    }
  }
  if (!byCountry.size) return { error: 'OWID mirror parsed but produced no usable per-country rows' };

  const countries = {};
  const scores = [];
  for (const [iso3, acc] of byCountry) {
    const pop = population.get(iso3);
    const per100k = pop ? (acc.totalDeaths / pop) * 100000 : null;
    if (per100k != null) scores.push(per100k);
    countries[iso3] = {
      score: per100k != null ? round2(per100k) : null,
      components: { 'Total deaths (period)': acc.totalDeaths },
      ...(Object.keys(acc.byHazard).length ? { byHazard: acc.byHazard } : {}),
    };
  }

  const citation = meta?.columns?.[Object.keys(meta.columns)[0]]?.citationLong ?? null;
  return {
    countries, asOf: `${minYear}–${maxYear}`, scaleMax: scaleMax(scores),
    hazards: Object.keys(OWID_HAZARD_COLUMNS),
    publisher: 'EM-DAT, CRED / UCLouvain — via Our World in Data (processed mirror)',
    unit: 'Deaths per 100,000 population, 2000–latest (score, scale capped at the observed maximum); components are deaths only — OWID\'s mirror does not carry affected-persons or damage figures',
    citation,
  };
}

async function buildEmdat(population) {
  const id = 'emdat';
  const label = 'EM-DAT (Emergency Events Database)';
  const baseSource = {
    url: 'https://www.emdat.be',
    license: 'CC BY-NC-ND (non-commercial, no derivatives — see data/preparedness/README.md for what this means for this site)',
    retrieved: TODAY,
    limitations: [
      'Small and slow-onset disasters are systematically under-recorded, especially in lower-income and lower-capacity states where local reporting infrastructure is thinner — the database reflects what got reported, not every event that occurred.',
      'Entry into the database requires a minimum severity threshold (deaths, people affected, declared emergency, or international appeal) — chronic, below-threshold hazard exposure never appears.',
      'A single named event (e.g. one cyclone) can cross several countries and years; this build\'s per-country, 2000-onward aggregation is EM-DAT\'s own (or, via the OWID mirror, OWID\'s reprocessing of EM-DAT\'s own) country attribution, not independently verified.',
      'The scale\'s maximum is the highest score actually observed in this run, not a fixed ceiling — it will shift release to release as new data comes in.',
    ],
  };
  const allHazards = Object.values(EMDAT_HAZARD_MAP.reduce((m, [, k]) => ({ ...m, [k]: k }), {}));

  const dropIn = await buildEmdatFromDropIn(population);
  if (dropIn && !dropIn.error) {
    const source = {
      ...baseSource,
      publisher: dropIn.publisher,
      asOf: dropIn.asOf,
      limitations: [
        ...baseSource.limitations,
        'Economic damage figures are missing for most recorded events (EM-DAT itself estimates coverage well under half); totals here are a floor, not a true sum.',
      ],
    };
    return {
      id, label, status: 'loaded', hazardDimension: true, hazards: dropIn.hazards,
      unit: dropIn.unit, scale: { min: 0, max: dropIn.scaleMax, higherIs: 'worse', transform: 'log' },
      source, countries: dropIn.countries,
    };
  }
  if (dropIn?.error) console.log(`  emdat: dropped-in file present but unusable (${dropIn.error}) — trying the OWID mirror instead`);

  const owid = await buildEmdatFromOwid(population);
  if (!owid.error) {
    const source = {
      ...baseSource,
      publisher: owid.publisher,
      asOf: owid.asOf,
      limitations: [
        ...baseSource.limitations,
        'Retrieved via Our World in Data\'s processed mirror of EM-DAT, not a direct EM-DAT export — OWID\'s own reprocessing (unit conversion, entity naming) sits between this figure and EM-DAT\'s raw record. Drop in a registered EM-DAT export (see instructions) for the canonical figures, including affected-persons and damage totals this mirror does not carry.',
      ],
    };
    return {
      id, label, status: 'loaded', hazardDimension: true, hazards: owid.hazards,
      unit: owid.unit, scale: { min: 0, max: owid.scaleMax, higherIs: 'worse', transform: 'log' },
      source, countries: owid.countries,
    };
  }
  console.log(`  emdat: OWID mirror also failed (${owid.error})`);

  return stub({
    id, label, hazardDimension: true, hazards: allHazards,
    unit: 'Deaths per 100,000 population, 2000–latest', scale: { min: 0, max: null, higherIs: 'worse' },
    source: { ...baseSource, publisher: 'CRED / UCLouvain — EM-DAT: The International Disaster Database', asOf: null },
    instructions: EMDAT_INSTRUCTIONS,
  });
}

/* ══════════════════════════════════════════════════════════════════════════
   4. IDMC GIDD — no client key needed after all: IDMC republishes its own
      disaster-displacement event table openly on HDX.
   ══════════════════════════════════════════════════════════════════════════
   helix-tools-api.idmcdb.org (the live GIDD API) still 403s without a
   client key this build doesn't have — but IDMC's HDX page
   ("idmc-internal-displacements-new-displacements-associated-with-disasters",
   found by searching HDX's package_search for "idmc") turns out to be
   genuinely event-level: one row per disaster event with its own iso3,
   year, hazard_type_name and new_displacement count. That's better than
   the aggregate the brief expected — hazardDimension can stay true.      */

const IDMC_HDX_PACKAGE = 'idmc-internal-displacements-new-displacements-associated-with-disasters';
const IDMC_HAZARD_MAP = [
  [/^Earthquake$/i, 'earthquake'], [/^Flood$/i, 'flood'], [/^Storm$/i, 'storm'],
  [/^Wildfire$/i, 'wildfire'], [/^Drought$/i, 'drought'],
  // Present in the data but with no canonical key here, so dropped rather
  // than stretched: Volcanic activity, Mass Movement, Extreme Temperature,
  // Erosion, Wave action, Sea level Rise, Mixed disasters.
];

async function buildIdmcFromDropIn() {
  const csvPath = resolve(rawDir, 'idmc-gidd.csv');
  if (!existsSync(csvPath)) return null;
  const rows = parseCsv(readFileSync(csvPath, 'utf8'));
  const col = (row, names) => names.map((n) => row[n]).find((v) => v !== undefined && v !== '');
  const ISO3_COLS = ['ISO3', 'Iso3'];
  const YEAR_COLS = ['Year'];
  const HAZARD_COLS = ['Hazard Category', 'Hazard Type'];
  const VALUE_COLS = ['Disaster Internal Displacements', 'Disaster New Displacements'];
  const HAZARD_MAP = [
    [/earthquake|tsunami/i, 'earthquake'], [/flood/i, 'flood'], [/storm|cyclone|typhoon|hurricane/i, 'storm'],
    [/wildfire|fire/i, 'wildfire'], [/drought/i, 'drought'],
  ];

  let minYear = null;
  let maxYear = null;
  const byCountry = new Map();
  for (const row of rows) {
    const iso3 = col(row, ISO3_COLS);
    const year = Number(col(row, YEAR_COLS));
    const value = Number(col(row, VALUE_COLS)) || 0;
    if (!iso3 || !Number.isFinite(year) || year < 2008) continue;
    minYear = minYear ? Math.min(minYear, year) : year;
    maxYear = maxYear ? Math.max(maxYear, year) : year;
    if (!byCountry.has(iso3)) byCountry.set(iso3, { total: 0, byHazard: {} });
    const acc = byCountry.get(iso3);
    acc.total += value;
    const hazard = HAZARD_MAP.find(([re]) => re.test(col(row, HAZARD_COLS) ?? ''))?.[1];
    if (hazard) acc.byHazard[hazard] = (acc.byHazard[hazard] ?? 0) + value;
  }
  if (!byCountry.size) return { error: 'the dropped-in file parsed to zero usable rows.' };

  const countries = {};
  const scores = [];
  for (const [iso3, acc] of byCountry) {
    scores.push(acc.total);
    countries[iso3] = { score: acc.total, ...(Object.keys(acc.byHazard).length ? { byHazard: acc.byHazard } : {}) };
  }
  return { countries, asOf: `${minYear}–${maxYear}`, scaleMax: scaleMax(scores) };
}

async function buildIdmcFromHdx() {
  let pkg;
  try {
    pkg = await cachedJson(
      `https://data.humdata.org/api/3/action/package_show?id=${IDMC_HDX_PACKAGE}`,
      'idmc-hdx-package.json',
    );
  } catch (e) {
    return { error: `HDX package lookup failed (${e.message})` };
  }
  const resource = pkg.result?.resources?.find((r) => /\.csv$/i.test(r.url ?? ''));
  if (!resource) return { error: 'HDX package has no CSV resource' };

  let csvText;
  try {
    csvText = await cachedText(resource.url, 'idmc-disasters.csv', { timeout: 60000 });
  } catch (e) {
    return { error: `HDX CSV download failed (${e.message})` };
  }
  const rows = parseCsv(csvText);
  if (!rows.length) return { error: 'HDX CSV parsed to zero rows' };

  let minYear = null;
  let maxYear = null;
  const byCountry = new Map();
  for (const row of rows) {
    const iso3 = row.iso3;
    const year = Number(row.year);
    const value = Number(row.new_displacement) || 0;
    if (!iso3 || iso3.length !== 3 || !Number.isFinite(year) || year < 2008) continue;
    minYear = minYear ? Math.min(minYear, year) : year;
    maxYear = maxYear ? Math.max(maxYear, year) : year;
    if (!byCountry.has(iso3)) byCountry.set(iso3, { total: 0, byHazard: {} });
    const acc = byCountry.get(iso3);
    acc.total += value;
    const hazard = IDMC_HAZARD_MAP.find(([re]) => re.test(row.hazard_type_name ?? ''))?.[1];
    if (hazard) acc.byHazard[hazard] = (acc.byHazard[hazard] ?? 0) + value;
  }
  if (!byCountry.size) return { error: 'HDX CSV parsed but produced no usable per-country rows' };

  const countries = {};
  const scores = [];
  for (const [iso3, acc] of byCountry) {
    scores.push(acc.total);
    countries[iso3] = { score: acc.total, ...(Object.keys(acc.byHazard).length ? { byHazard: acc.byHazard } : {}) };
  }
  return {
    countries, asOf: `${minYear}–${maxYear}`, scaleMax: scaleMax(scores),
    lastModified: resource.last_modified ? String(resource.last_modified).slice(0, 10) : null,
  };
}

async function buildIdmc() {
  const id = 'idmc';
  const label = 'IDMC — Global Internal Displacement (disasters)';
  const hazards = ['earthquake', 'flood', 'storm', 'wildfire', 'drought'];
  const unit = 'New disaster displacements, 2008–latest (sum, scale capped at the observed maximum)';
  const baseLimitations = [
    'Disaster displacement figures are modeled estimates built from media, government, and cluster reports of varying quality by country, not a census.',
    'Numbers are a "flow" (new displacements during a year) — the same person displaced twice in one year by two events is counted twice, and the figure says nothing about how many people remain displaced (the "stock").',
    'Small-scale or slow-onset displacement (e.g. gradual drought-driven movement) is under-captured relative to sudden, visible events like storms and floods.',
    'This layer is disaster displacement only, not conflict displacement — IDMC tracks both, but the source table behind this layer (its disaster-events export) does not carry a conflict figure to show as a comparison component.',
    'The scale\'s maximum is the highest total actually observed in this run, not a fixed ceiling.',
  ];
  const baseSource = {
    publisher: 'Internal Displacement Monitoring Centre (IDMC) — Global Internal Displacement Database (GIDD)',
    url: 'https://www.internal-displacement.org/database/displacement-data',
    license: 'CC BY-IGO',
    retrieved: TODAY,
  };
  const instructions = 'The live IDMC GIDD API (helix-tools-api.idmcdb.org) still requires a client key this '
    + 'build does not have. This layer is instead filled automatically from IDMC\'s own event-level disaster-'
    + 'displacement table published on HDX (package "' + IDMC_HDX_PACKAGE + '"). If HDX ever moves or renames '
    + 'that package, either request an API key at https://www.internal-displacement.org (Data → API access) and '
    + 'wire it into this script, or re-search https://data.humdata.org for the current package id and update '
    + 'IDMC_HDX_PACKAGE in scripts/build-preparedness.mjs. A file dropped in at data/preparedness/raw/idmc-gidd.csv '
    + 'always takes priority over the HDX pull, if you have a different export you\'d rather use.';

  const dropIn = await buildIdmcFromDropIn();
  if (dropIn && !dropIn.error) {
    return {
      id, label, status: 'loaded', hazardDimension: true, hazards, unit,
      scale: { min: 0, max: dropIn.scaleMax, higherIs: 'worse', transform: 'log' },
      source: { ...baseSource, asOf: dropIn.asOf, limitations: baseLimitations },
      countries: dropIn.countries,
    };
  }
  if (dropIn?.error) console.log(`  idmc: dropped-in file present but unusable (${dropIn.error}) — trying HDX instead`);

  const hdx = await buildIdmcFromHdx();
  if (!hdx.error) {
    return {
      id, label, status: 'loaded', hazardDimension: true, hazards, unit,
      scale: { min: 0, max: hdx.scaleMax, higherIs: 'worse', transform: 'log' },
      source: {
        ...baseSource, asOf: hdx.asOf,
        limitations: [
          ...baseLimitations,
          `HDX lists this resource's own last-modified date as ${hdx.lastModified ?? 'unknown'} — IDMC revises past years as better information arrives, so re-running this build later can change earlier-year totals, not just add new ones.`,
        ],
      },
      countries: hdx.countries,
    };
  }
  console.log(`  idmc: HDX fetch failed (${hdx.error})`);

  return stub({
    id, label, hazardDimension: true, hazards, unit,
    scale: { min: 0, max: null, higherIs: 'worse' },
    source: { ...baseSource, asOf: null, limitations: baseLimitations },
    instructions,
  });
}

/* ══════════════════════════════════════════════════════════════════════════
   5. WHO SPAR (IHR core capacities self-assessment)
   ══════════════════════════════════════════════════════════════════════════
   GHO OData. SDGIHR2021 carries both the overall average (Dim2 = "_TOTL")
   and, unsuffixed, each of the 15 second-edition capacity scores (C01–C15)
   for the same country/year — a single filtered pull gets everything.    */

const SPAR_CAPACITY_LABELS = {
  C01: 'Legal & policy frameworks',
  C02: 'IHR coordination & focal point',
  C03: 'Financing',
  C04: 'Laboratory',
  C05: 'Surveillance',
  C06: 'Human resources',
  C07: 'Health emergency management',
  C08: 'Health service provision',
  C09: 'Infection prevention & control',
  C10: 'Risk communication & community engagement',
  C11: 'Points of entry & border health',
  C12: 'Zoonotic disease events',
  C13: 'Food safety',
  C14: 'Chemical events',
  C15: 'Radiation emergencies',
};

async function buildSpar() {
  const id = 'spar';
  const label = 'WHO SPAR (IHR core capacities)';
  const source = {
    publisher: 'World Health Organization — States Parties Self-Assessment Annual Reporting (SPAR), International Health Regulations (2005)',
    url: 'https://www.who.int/data/gho/data/themes/topics/international-health-regulations-monitoring-framework',
    license: 'CC BY-NC-SA 3.0 IGO',
    asOf: null,
    retrieved: TODAY,
    limitations: [
      'Every score is self-reported by the country\'s own government, with no independent verification — this is a self-assessment, not an audit.',
      'The COVID-19 pandemic is the standing case study for this limitation: countries that scored strongly on pre-2020 pandemic-preparedness self-assessments (SPAR and the related Global Health Security Index) did not consistently show better COVID-19 outcomes, and several of the top-ranked states had some of the worst recorded outcomes — a widely-noted mismatch between self-assessed capacity and demonstrated performance.',
      'This is an epidemic/health-emergency capacity measure specifically (it has no hazard dimension for earthquakes, floods, storms, etc.) — treat it as one input among several, not a general disaster-preparedness score.',
      'Reporting is patchy year to year; a country missing from a given year has not necessarily lost capacity, it may simply not have submitted that year\'s self-assessment.',
    ],
  };

  let year = 2025;
  let rows = null;
  for (; year >= 2019; year--) {
    let payload;
    try {
      payload = await cachedJson(
        `https://ghoapi.azureedge.net/api/SDGIHR2021?$filter=TimeDim eq ${year} and SpatialDimType eq 'COUNTRY'`,
        `spar-${year}.json`,
      );
    } catch {
      continue;
    }
    if (payload.value?.length) { rows = payload.value; break; }
  }
  if (!rows) {
    return stub({
      id, label, hazardDimension: false, unit: 'SPAR average capacity score, 0–100', scale: { min: 0, max: 100, higherIs: 'better' },
      source, instructions: 'The GHO OData SDGIHR2021 indicator returned no country rows for any year 2019–2025. '
        + 'Check https://ghoapi.azureedge.net/api/SDGIHR2021 by hand and adjust the year range in buildSpar() in '
        + 'scripts/build-preparedness.mjs, then rerun npm run build:preparedness.',
    });
  }
  source.asOf = String(year);

  const countries = {};
  for (const r of rows) {
    const iso3 = r.SpatialDim;
    if (r.Dim2 === 'IHRSPARINDICATORSCORE_TOTL') {
      countries[iso3] ??= { score: null, components: {} };
      countries[iso3].score = round2(r.NumericValue);
    } else {
      const m = r.Dim2?.match(/^IHRSPARINDICATORSCORE_(C\d\d)$/);
      if (!m || !SPAR_CAPACITY_LABELS[m[1]]) continue;
      countries[iso3] ??= { score: null, components: {} };
      countries[iso3].components[SPAR_CAPACITY_LABELS[m[1]]] = round2(r.NumericValue);
    }
  }
  for (const iso3 of Object.keys(countries)) {
    if (countries[iso3].score == null) delete countries[iso3];
    else if (!Object.keys(countries[iso3].components).length) delete countries[iso3].components;
  }

  return { id, label, status: 'loaded', hazardDimension: false, unit: 'SPAR average capacity score, 0–100', scale: { min: 0, max: 100, higherIs: 'better' }, source, countries };
}

/* ══════════════════════════════════════════════════════════════════════════
   6. Sendai Framework Target G (multi-hazard early warning coverage)
   ══════════════════════════════════════════════════════════════════════════
   Still not_loaded, on real evidence gathered twice now:
     - The UN SDG API's full series list (unstats.un.org/sdgapi) carries no
       MHEWS/early-warning series under any plausible code — checked again
       this pass against a much wider net (every SG_*, EN_*, VC_* series,
       plus a text search for "warning"/"EWS"/"MHEWS"/"multi-hazard"), not
       just the earlier narrow one. The SDG framework tracks Sendai Target E
       (national/local DRR strategies, series SG_DSR_*) but Target G has no
       SDG-mirrored series at all.
     - sendaimonitor.undrr.org's dashboard API is not usable without a real
       browser session either way: several guessed REST paths (/api,
       /api/graphql, several guessed shapes) return HTTP 403 behind a
       Cloudflare "Managed Challenge" (a JS/cookie challenge, not a data
       response), and the one real endpoint found (/api/dashboard) returns
       HTTP 401 — it exists, but needs session auth this script doesn't have.
     - HDX carries no UNDRR/Sendai Target G or early-warning dataset either.
   Evidence cached at data/preparedness/raw/sdg-series-list.json (full
   series list) and sendai-challenge-page.html (the /api/dashboard response). */

async function buildSendai() {
  const id = 'sendai';
  const label = 'Sendai Framework Target G — MHEWS coverage';
  const source = {
    publisher: 'UN Office for Disaster Risk Reduction (UNDRR) — Sendai Framework Monitor',
    url: 'https://sendaimonitor.undrr.org',
    license: 'Not yet determined — see instructions',
    asOf: null,
    retrieved: TODAY,
    limitations: [
      'Target G data is self-reported by national disaster management authorities into the Sendai Monitor, with no independent audit.',
      '"Multi-hazard early warning system coverage" is reported close to binary (covered / not covered) per country in most editions, which erases large differences in how many hazards, how much lead time, or how much of the population an early-warning system actually reaches.',
      'Reporting is voluntary and incomplete — many UN member states have submitted no Target G figure in some monitoring cycles, so absence from the dataset means "not reported," not "zero coverage."',
    ],
  };

  await cachedJson('https://unstats.un.org/sdgapi/v1/sdg/Series/List', 'sdg-series-list.json').catch(() => null);
  // The bare root ("/") is just the site's client-rendered SPA shell and
  // returns 200 with no data either way — the actual evidence is that its
  // /api/* endpoints (where any dashboard data would have to come from)
  // 403 behind a Cloudflare Managed Challenge for every path tried.
  try {
    const res = await fetch('https://sendaimonitor.undrr.org/api/dashboard', {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      signal: AbortSignal.timeout(20000),
    });
    writeFileSync(resolve(rawDir, 'sendai-challenge-page.html'), await res.text());
    console.log(`  sendai: sendaimonitor.undrr.org/api/dashboard -> HTTP ${res.status} (response cached as evidence)`);
  } catch (e) {
    console.log(`  sendai: sendaimonitor.undrr.org/api/dashboard fetch errored (${e.message})`);
  }

  return stub({
    id, label, hazardDimension: false, unit: 'MHEWS coverage indicator (Target G-1), 0–1', scale: { min: 0, max: 1, higherIs: 'better' },
    source, instructions: 'No open, machine-readable source for Sendai Target G was found. The UN SDG API '
      + '(unstats.un.org/sdgapi) tracks Sendai Target E (DRR strategies) but carries no Target G / multi-hazard '
      + 'early-warning series at all — confirmed twice, most recently against every SG_/EN_/VC_ series in the '
      + 'full list (cached at data/preparedness/raw/sdg-series-list.json). sendaimonitor.undrr.org\'s own '
      + 'dashboard API is unreachable by script either way — guessed REST paths return HTTP 403 behind a '
      + 'Cloudflare Managed Challenge, and its real /api/dashboard endpoint returns HTTP 401, requiring a '
      + 'session login this script does not have (cached at data/preparedness/raw/sendai-challenge-page.html). '
      + 'Export Target G country data by hand from https://sendaimonitor.undrr.org in a browser '
      + '(Data → Target G), save it as data/preparedness/raw/sendai-target-g.csv with at minimum columns '
      + 'iso3,score, and wire a small parser into buildSendai() in scripts/build-preparedness.mjs, then rerun '
      + 'npm run build:preparedness.',
  });
}

/* ══════════════════════════════════════════════════════════════════════════
   7. OCHA FTS — humanitarian appeals, required vs funded, by year
   ══════════════════════════════════════════════════════════════════════════
   api.fts.unocha.org is blocked from this environment's proxy; the same
   service answers at api.hpc.tools. Two calls per year: the plan list
   (which carries each plan's own revised requirement) and a flow-search
   grouped by destination plan (which carries what was actually funded) —
   FTS does not put both numbers on one endpoint.                         */

const HPC_BASE = 'https://api.hpc.tools';
const FUNDING_YEARS = Array.from({ length: 17 }, (_, i) => 2010 + i); // 2010–2026

async function buildFunding() {
  const source = {
    publisher: 'UN OCHA — Financial Tracking Service (FTS)',
    url: 'https://fts.unocha.org',
    license: 'CC BY (per FTS\'s stated terms of use — reverify at fts.unocha.org/content/about-fts before reuse if this matters for redistribution)',
    asOf: null,
    retrieved: TODAY,
    limitations: [
      'Funding figures are reported voluntarily by donors and recipient agencies, not independently audited by OCHA — over- or under-reporting by any one reporting organization affects the total with no external check.',
      'The same dollar can appear more than once if it passes through several agencies before reaching its final recipient and each hop reports it (a widely-acknowledged double-counting risk in flow data of this kind) — coverage figures here occasionally exceed 100% as a result, most visibly in the earliest years of this series.',
      'A plan\'s "requirement" is the appeal\'s own ask, revised over the year — it is a planning figure set by humanitarian agencies, not an independent estimate of true need.',
      'Only funding for plans that fall inside the U.N.-coordinated appeal system is captured; humanitarian spending outside a tracked plan (a large share of total global humanitarian spending) is invisible to this series.',
    ],
  };

  const appeals = [];
  for (const year of FUNDING_YEARS) {
    let plans;
    let flow;
    try {
      plans = (await cachedJson(`${HPC_BASE}/v1/public/plan/year/${year}`, `fts-plans-${year}.json`)).data;
      await sleep(300);
      flow = await cachedJson(`${HPC_BASE}/v1/public/fts/flow?year=${year}&groupby=plan`, `fts-flow-${year}.json`);
      await sleep(300);
    } catch (e) {
      console.log(`  funding ${year}: FAILED (${e.message}) — skipped`);
      continue;
    }
    const requiredUsd = plans.reduce((sum, p) => sum + (Number(p.revisedRequirements) || 0), 0);
    const fundedObjs = flow?.data?.report2?.fundingTotals?.objects?.[0]?.singleFundingObjects ?? [];
    const fundedUsd = fundedObjs.reduce((sum, o) => sum + (Number(o.totalFunding) || 0), 0);
    if (!requiredUsd && !fundedUsd) continue;
    appeals.push({
      year,
      requiredUsd: Math.round(requiredUsd),
      fundedUsd: Math.round(fundedUsd),
      coverage: requiredUsd ? round2(fundedUsd / requiredUsd) : null,
    });
  }
  appeals.sort((a, b) => a.year - b.year);
  if (appeals.length) source.asOf = `${appeals[0].year}–${appeals[appeals.length - 1].year}`;

  // Real attempts, each cached as evidence, before falling back to the
  // drop-in-file stub: unfccc.int sits behind Imperva/Incapsula bot
  // protection (a 200 that resolves to a 212-byte JS-redirect shell, no
  // content), frld.org sits behind a Cloudflare challenge, and fund.frld.org
  // is rejected outright by this environment's egress proxy. None of the
  // three hands back HTML with a parseable number in it.
  const ldEvidence = [];
  for (const [name, url] of [
    ['unfccc', 'https://unfccc.int/loss-and-damage-fund'],
    ['frld', 'https://www.frld.org'],
  ]) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15' },
        signal: AbortSignal.timeout(20000),
      });
      const text = await res.text();
      writeFileSync(resolve(rawDir, `frld-${name}-page.html`), text);
      const hasPledgeFigure = /\$\s?[\d,.]+\s?(billion|million)/i.test(text) && text.length > 2000;
      ldEvidence.push(`${url} -> HTTP ${res.status}, ${text.length} bytes${hasPledgeFigure ? ', contains a dollar figure' : ', no parseable pledge figure'}`);
    } catch (e) {
      ldEvidence.push(`${url} -> fetch failed (${e.message})`);
    }
  }
  console.log(`  lossAndDamage: ${ldEvidence.join(' | ')}`);

  const lossAndDamage = {
    status: 'not_loaded',
    instructions: 'No machine-readable pledge figure for the Loss and Damage Fund (FRLD) was found. Evidence '
      + `from this run: ${ldEvidence.join('; ')}. unfccc.int/loss-and-damage-fund sits behind Imperva/Incapsula `
      + 'bot protection (its 200 response is a small Incapsula challenge iframe, no page content); '
      + 'frld.org sits behind a Cloudflare Managed Challenge; fund.frld.org is blocked outright by this build '
      + 'environment\'s egress proxy. Raw responses cached at data/preparedness/raw/frld-unfccc-page.html and '
      + 'frld-frld-page.html. This script will not hand-enter a pledge figure from memory or a news article — '
      + 'assemble a CSV yourself from official FRLD/COP communications with columns '
      + 'contributor,pledgedUsd,announcedDate,sourceUrl (one row per pledge, cite the exact page each figure '
      + 'came from) and save it as data/preparedness/raw/frld-pledges.csv, then rerun npm run build:preparedness.',
  };
  const ldPath = resolve(rawDir, 'frld-pledges.csv');
  if (existsSync(ldPath)) {
    const rows = parseCsv(readFileSync(ldPath, 'utf8'));
    const pledgedUsd = rows.reduce((sum, r) => sum + (Number(r.pledgedUsd) || 0), 0);
    if (pledgedUsd > 0) {
      lossAndDamage.status = 'loaded';
      lossAndDamage.pledgedUsd = Math.round(pledgedUsd);
      lossAndDamage.source = {
        publisher: 'Fund for responding to Loss and Damage (FRLD) — pledges as compiled by the site owner from official announcements',
        url: 'https://fund.frld.org',
        license: 'n/a (compiled from public pledge announcements)',
        asOf: TODAY,
        retrieved: TODAY,
        limitations: ['Pledged amounts are frequently multi-year and conditional; this total is a sum of announced pledges, not funds actually disbursed.'],
      };
      delete lossAndDamage.instructions;
    }
  }

  return {
    id: 'funding', status: appeals.length ? 'loaded' : 'not_loaded', source, appeals, lossAndDamage,
  };
}

/* ══════════════════════════════════════════════════════════════════════════
   8. World Bank population — cached now so EM-DAT's drop-in path works
      offline even though EM-DAT itself is a stub today.
   ══════════════════════════════════════════════════════════════════════════ */

async function fetchPopulation() {
  const population = new Map();
  for (const date of [2023, 2022, 2021]) {
    let payload;
    try {
      payload = await cachedJson(
        `https://api.worldbank.org/v2/country/all/indicator/SP.POP.TOTL?format=json&per_page=20000&date=${date}`,
        `worldbank-population-${date}.json`,
      );
    } catch (e) {
      console.log(`  population ${date}: FAILED (${e.message})`);
      continue;
    }
    const rows = payload[1] ?? [];
    for (const r of rows) {
      if (r.value != null && !population.has(r.countryiso3code)) population.set(r.countryiso3code, r.value);
    }
  }
  console.log(`  population: ${population.size} countries cached (World Bank SP.POP.TOTL)`);
  return population;
}

/* ══════════════════════════════════════════════════════════════════════════
   Run everything, write everything.
   ══════════════════════════════════════════════════════════════════════════ */

function record(layer, filename) {
  writeFileSync(resolve(outDir, filename), JSON.stringify(layer));
  const kb = (readFileSync(resolve(outDir, filename)).length / 1024).toFixed(1);
  layers.push({ id: layer.id, file: filename, status: layer.status, label: layer.label });
  if (layer.status === 'loaded') {
    meta.loaded.push(layer.id);
    meta.countryCounts[layer.id] = Object.keys(layer.countries ?? {}).length;
    console.log(`  ${layer.id}: LOADED — ${meta.countryCounts[layer.id]} countries, ${kb}KB → public/data/preparedness/${filename}`);
  } else {
    meta.stubbed.push(layer.id);
    console.log(`  ${layer.id}: not_loaded — ${kb}KB stub → public/data/preparedness/${filename}`);
  }
}

const population = await fetchPopulation();

record(await buildInform(), 'inform.json');
record(await buildNdgain(), 'ndgain.json');
record(await buildEmdat(population), 'emdat.json');
record(await buildIdmc(), 'idmc.json');
record(await buildSpar(), 'spar.json');
record(await buildSendai(), 'sendai.json');

const funding = await buildFunding();
writeFileSync(resolve(outDir, 'funding.json'), JSON.stringify(funding));
{
  const kb = (readFileSync(resolve(outDir, 'funding.json')).length / 1024).toFixed(1);
  layers.push({ id: 'funding', file: 'funding.json', status: funding.status, label: 'OCHA FTS — humanitarian appeals' });
  if (funding.status === 'loaded') meta.loaded.push('funding'); else meta.stubbed.push('funding');
  console.log(`  funding: ${funding.status.toUpperCase()} — ${funding.appeals.length} years, ${kb}KB → public/data/preparedness/funding.json`);
}

const manifest = { generated: TODAY, layers };
writeFileSync(resolve(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));

const appealYears = funding.appeals.length
  ? [funding.appeals[0].year, funding.appeals[funding.appeals.length - 1].year]
  : null;
const countryCount = Math.max(0, ...Object.values(meta.countryCounts));
const metaOut = {
  generated: TODAY,
  layersLoaded: meta.loaded,
  layersStubbed: meta.stubbed,
  countryCount,
  appealYears,
};
mkdirSync(resolve(root, 'src/data'), { recursive: true });
writeFileSync(resolve(root, 'src/data/preparedness-meta.json'), JSON.stringify(metaOut, null, 2));

console.log(`\npreparedness: ${meta.loaded.length} layers loaded (${meta.loaded.join(', ') || 'none'}), `
  + `${meta.stubbed.length} stubbed (${meta.stubbed.join(', ') || 'none'})`);
console.log(`preparedness: wrote manifest.json and src/data/preparedness-meta.json`);
