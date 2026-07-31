// Turns public/MasterMovies.json (776 messy records) into two build artefacts:
//
//   src/data/summary.json    decade/family aggregates + headline facts. Imported
//                            directly by the server component so the hero and the
//                            main chart render in static HTML with no client fetch.
//   public/data/films.json   slim film list, fetched async by the interactive
//                            views. Kept small by stripping shared URL prefixes.
//
// Run with: npm run build:data (also runs as part of npm run build).

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { classify, subtypeLabel, FAMILIES, FAMILY_ORDER, NOT_DISASTER_FILMS } from './taxonomy.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => JSON.parse(readFileSync(resolve(root, p), 'utf8'));

const THUMB_PREFIX = 'https://media.themoviedb.org/t/p/w94_and_h141_bestv2/';
const LINK_PREFIX = 'https://www.themoviedb.org/movie/';

const slug = (s) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');

/** Box office only exists in the older, smaller movies.json. Merge it in. */
function boxOfficeIndex() {
  const index = new Map();
  for (const m of read('public/movies.json').movies ?? []) {
    if (typeof m.boxOffice === 'number' && m.boxOffice > 0) {
      index.set(`${slug(m.title)}|${m.year}`, m.boxOffice);
    }
  }
  return index;
}

function normalise(raw, boxOffice) {
  const title = String(raw.Title ?? '').trim();     // "9", "2012" parsed as numbers
  const year = Number(raw.Year);
  if (!title || !Number.isFinite(year) || year < 1890 || year > 2026) return null;
  if (NOT_DISASTER_FILMS.has(`${title.toLowerCase()}|${year}`)) return null;

  const family = classify(raw);
  const rating = typeof raw.Rating === 'number' && raw.Rating > 0 && raw.Rating <= 10
    ? Math.round(raw.Rating * 10) / 10
    : null;
  const votes = typeof raw.NumberOfRatings === 'number' ? raw.NumberOfRatings : 0;

  const thumb = typeof raw.ThumbnailUrl === 'string' && raw.ThumbnailUrl.startsWith(THUMB_PREFIX)
    ? raw.ThumbnailUrl.slice(THUMB_PREFIX.length)
    : null;
  const tmdb = typeof raw.LinkUrl === 'string' && raw.LinkUrl.startsWith(LINK_PREFIX)
    ? raw.LinkUrl.slice(LINK_PREFIX.length)
    : null;

  // "United States of America" and "United States" are the same place.
  const country = String(raw.Country ?? '').split(',')[0].trim()
    .replace(/^United States of America$/, 'United States') || null;

  return {
    t: title,
    y: year,
    f: family,
    s: subtypeLabel(raw, family),
    r: rating,
    v: votes,
    p: typeof raw.PlotSummary === 'string' ? raw.PlotSummary.trim() : '',
    th: thumb,
    id: tmdb,
    d: typeof raw.Director === 'string' ? raw.Director.trim() : null,
    c: country && country !== 'Unknown' ? country : null,
    b: boxOffice ?? null,
  };
}

function dedupe(films) {
  // 7 title|year collisions in the source. Keep whichever record carries more.
  const best = new Map();
  const weight = (f) => (f.r ? 1 : 0) + (f.p ? 1 : 0) + (f.th ? 1 : 0) + (f.d ? 1 : 0) + f.v / 1e9;
  for (const f of films) {
    const key = `${slug(f.t)}|${f.y}`;
    const prev = best.get(key);
    if (!prev || weight(f) > weight(prev)) best.set(key, f);
  }
  return [...best.values()].sort((a, b) => a.y - b.y || a.t.localeCompare(b.t));
}

const money = (n) => {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${Math.round(n / 1e6)}M`;
  if (n >= 1e3) return `$${Math.round(n / 1e3)}K`;
  return `$${n}`;
};

/** A film is only a credible "best of decade" if enough people voted on it. */
const VOTE_FLOOR = 500;

/**
 * Two word-lists run against each film's own PlotSummary text. This is a
 * count of how the *descriptions* talk about stakes -- not a per-film verdict
 * on how the story actually ends, which the dataset has no field for and
 * this script does not claim to know. A summary can use both words, or
 * neither; the two counts are independent, not a split of 100%.
 */
const SURVIVAL_RE = /\bsurviv|\bescape|\brescue|\bshelter|\brefuge|\bsafety\b/i;
const ANNIHILATION_RE = /\bdestro|\bdestruction|\bannihilat|\bextinct|wipe(s|d)? out|\bapocalyp|\bdoom|obliterat|\bdevastat/i;

function plotLanguageByFamily(films) {
  const byFamily = new Map();
  for (const f of films) {
    if (!f.p) continue;
    if (!byFamily.has(f.f)) byFamily.set(f.f, { withPlot: 0, survival: 0, annihilation: 0 });
    const row = byFamily.get(f.f);
    row.withPlot += 1;
    if (SURVIVAL_RE.test(f.p)) row.survival += 1;
    if (ANNIHILATION_RE.test(f.p)) row.annihilation += 1;
  }
  return FAMILY_ORDER.filter((id) => byFamily.has(id)).map((id) => {
    const row = byFamily.get(id);
    return {
      family: id,
      withPlot: row.withPlot,
      survival: row.survival,
      annihilation: row.annihilation,
      survivalPct: Math.round((row.survival / row.withPlot) * 100),
      annihilationPct: Math.round((row.annihilation / row.withPlot) * 100),
    };
  });
}

/** US share of each decade's output, by count of films with a known country. */
function originByDecade(films) {
  const decades = new Map();
  for (const f of films) {
    if (!f.c) continue;
    const d = Math.floor(f.y / 10) * 10;
    if (!decades.has(d)) decades.set(d, { us: 0, other: 0 });
    const row = decades.get(d);
    if (f.c === 'United States') row.us += 1; else row.other += 1;
  }
  return [...decades.keys()].sort((a, b) => a - b).map((decade) => {
    const { us, other } = decades.get(decade);
    const total = us + other;
    return { decade, us, other, total, usShare: Math.round((us / total) * 100) };
  });
}

function summarise(films) {
  const decades = new Map();
  for (const f of films) {
    const d = Math.floor(f.y / 10) * 10;
    if (!decades.has(d)) decades.set(d, []);
    decades.get(d).push(f);
  }

  const byFamily = {};
  for (const id of FAMILY_ORDER) byFamily[id] = films.filter((f) => f.f === id).length;

  const decadeRows = [...decades.keys()].sort((a, b) => a - b).map((decade) => {
    const list = decades.get(decade);
    const counts = {};
    for (const id of FAMILY_ORDER) {
      const n = list.filter((f) => f.f === id).length;
      if (n) counts[id] = n;
    }
    const dominant = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

    const credible = list.filter((f) => f.r !== null && f.v >= VOTE_FLOOR);
    const pool = credible.length ? credible : list.filter((f) => f.r !== null);
    const topRated = [...pool].sort((a, b) => b.r - a.r)[0] ?? null;
    const mostSeen = [...list].sort((a, b) => b.v - a.v)[0] ?? null;
    const topGrossing = [...list].filter((f) => f.b).sort((a, b) => b.b - a.b)[0] ?? null;

    const rated = list.filter((f) => f.r !== null);
    return {
      decade,
      total: list.length,
      counts,
      dominant,
      meanRating: rated.length
        ? Math.round((rated.reduce((s, f) => s + f.r, 0) / rated.length) * 10) / 10
        : null,
      topRated: topRated && { t: topRated.t, y: topRated.y, r: topRated.r },
      mostSeen: mostSeen && { t: mostSeen.t, y: mostSeen.y, v: mostSeen.v },
      topGrossing: topGrossing && { t: topGrossing.t, y: topGrossing.y, b: money(topGrossing.b) },
    };
  });

  const byYear = {};
  for (const f of films) byYear[f.y] = (byYear[f.y] ?? 0) + 1;

  return {
    generated: new Date().toISOString().slice(0, 10),
    total: films.length,
    firstYear: films[0].y,
    lastYear: films[films.length - 1].y,
    byFamily,
    decades: decadeRows,
    byYear,
    peakYear: Object.entries(byYear).sort((a, b) => b[1] - a[1])[0],
    withRating: films.filter((f) => f.r !== null).length,
    withBoxOffice: films.filter((f) => f.b).length,
    countries: Object.entries(
      films.reduce((acc, f) => (f.c ? { ...acc, [f.c]: (acc[f.c] ?? 0) + 1 } : acc), {}),
    ).sort((a, b) => b[1] - a[1]).slice(0, 8),
    originByDecade: originByDecade(films),
    plotLanguage: plotLanguageByFamily(films),
  };
}

const bo = boxOfficeIndex();
const films = dedupe(
  read('public/MasterMovies.json')
    .map((raw) => normalise(raw, bo.get(`${slug(raw.Title)}|${Number(raw.Year)}`)))
    .filter(Boolean),
);

const summary = summarise(films);

mkdirSync(resolve(root, 'src/data'), { recursive: true });
mkdirSync(resolve(root, 'public/data'), { recursive: true });
writeFileSync(resolve(root, 'src/data/summary.json'), JSON.stringify(summary, null, 2));
writeFileSync(resolve(root, 'public/data/films.json'), JSON.stringify(films));

const kb = (p) => (readFileSync(resolve(root, p)).length / 1024).toFixed(0);
console.log(`films: ${films.length}  (${summary.firstYear}–${summary.lastYear})`);
console.log(`films.json ${kb('public/data/films.json')}KB · summary.json ${kb('src/data/summary.json')}KB`);
for (const id of FAMILY_ORDER) {
  const n = summary.byFamily[id];
  const pct = ((n / films.length) * 100).toFixed(1).padStart(4);
  console.log(`  ${String(n).padStart(3)}  ${pct}%  ${FAMILIES[id].label}`);
}
