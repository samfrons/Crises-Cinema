// Display side of the taxonomy: labels, ordering and the colour system.
//
// Classification itself lives in scripts/taxonomy.mjs and runs at build time.
// The family ids here must match that file — if you add a family there, add it
// here too, or it will fall through to the neutral "unsorted" swatch.
//
// ── The colour system ────────────────────────────────────────────────────────
// Eleven categories is more than any flat categorical palette can keep
// distinguishable, so colour is assigned in two levels: each of the four groups
// owns one hue, and its families are separated by lightness within that hue.
// A reader tells "our own machinery" (blues) from "something alive" (greens) by
// hue, and Atomic from Wreckage by how dark it is. Lightness survives colour
// vision deficiency far better than hue does, which is what makes eleven
// legible where eleven arbitrary hues would not be.
//
// Generated from OKLCH targets and validated against the cream page surface
// (#f1e8d5) with the dataviz skill's validator:
//   worst adjacent CVD ΔE 13.3 (protanopia, target ≥ 8)
//   worst adjacent normal-vision ΔE 15.7 (floor ≥ 15)
//   chroma ≥ 0.10 on all eleven
// Two deliberate deviations from the validator's defaults:
//   · Four steps sit below its 0.43 lightness band. That band is calibrated for
//     a near-white surface; on cream the darker steps carry *more* contrast,
//     which is what the band is a proxy for.
//   · Three light steps land at 2.3–2.8:1 against the surface, under the 3:1
//     bar. The skill allows this only with a relief channel, so the chart ships
//     direct labels, per-segment tooltips, 2px separators and a numbers table.

export type FamilyId =
  | 'earth' | 'climate' | 'cosmic'
  | 'wreckage' | 'atomic' | 'machines'
  | 'plague' | 'undead' | 'invaders'
  | 'divine' | 'afterfall' | 'unsorted';

export type GroupId = 'world' | 'ourselves' | 'alive' | 'beyond';

export interface Family {
  id: FamilyId;
  label: string;
  /** Uppercase abbreviation for direct labels inside chart segments. */
  short: string;
  group: GroupId;
  color: string;
  gloss: string;
}

/** Fixed order — drives stack order, legend order and colour assignment, so a
 *  family's colour never depends on how many families are on screen. */
export const FAMILIES: Family[] = [
  { id: 'earth',     label: 'Earth & Weather', short: 'EARTH',    group: 'world',     color: '#964700', gloss: 'Quakes, volcanoes, tsunamis, the sky turning on you.' },
  { id: 'climate',   label: 'Climate',         short: 'CLIMATE',  group: 'world',     color: '#ba7e15', gloss: 'Slow collapse: warming, drought, the emptying world.' },
  { id: 'cosmic',    label: 'Cosmic',          short: 'COSMIC',   group: 'world',     color: '#611800', gloss: 'Asteroids, comets, solar flares, the indifferent void.' },
  { id: 'wreckage',  label: 'Wreckage',        short: 'WRECKAGE', group: 'ourselves', color: '#1b2e87', gloss: 'Planes, ships, towers, dams — things we built, failing.' },
  { id: 'atomic',    label: 'Atomic',          short: 'ATOMIC',   group: 'ourselves', color: '#116aac', gloss: 'The bomb, the reactor, the fallout.' },
  { id: 'machines',  label: 'Machines',        short: 'MACHINES', group: 'ourselves', color: '#39a3d0', gloss: 'AI, robots, networks that stop taking orders.' },
  { id: 'plague',    label: 'Plague',          short: 'PLAGUE',   group: 'alive',     color: '#128f5a', gloss: 'Viruses, epidemics, engineered contagion.' },
  { id: 'undead',    label: 'The Undead',      short: 'UNDEAD',   group: 'alive',     color: '#185b23', gloss: 'Zombies, vampires, the risen.' },
  { id: 'invaders',  label: 'Invaders',        short: 'INVADERS', group: 'alive',     color: '#83a139', gloss: 'Aliens, kaiju, whatever is bigger than us.' },
  { id: 'divine',    label: 'Divine',          short: 'DIVINE',   group: 'beyond',    color: '#983481', gloss: 'Judgment, prophecy, the supernatural.' },
  { id: 'afterfall', label: 'After the Fall',  short: 'AFTER',    group: 'beyond',    color: '#531264', gloss: 'Ruins and dystopias, with no cause on record.' },
  { id: 'unsorted',  label: 'Unsorted',        short: 'UNSORTED', group: 'beyond',    color: '#8a7f6b', gloss: 'Films the dataset never pinned down.' },
];

export const GROUPS: { id: GroupId; label: string; gloss: string }[] = [
  { id: 'world',     label: 'Earth & sky',        gloss: 'The planet, the weather, the void above.' },
  { id: 'ourselves', label: 'Our own machinery',  gloss: 'The bomb, the network, the thing we built.' },
  { id: 'alive',     label: 'Something alive',    gloss: 'Viruses, the risen, visitors.' },
  { id: 'beyond',    label: 'Beyond explanation', gloss: 'Judgment, prophecy, ruins with no cause.' },
];

export const FAMILY_IDS = FAMILIES.map((f) => f.id);

const BY_ID = new Map(FAMILIES.map((f) => [f.id, f]));

export const family = (id: string): Family =>
  BY_ID.get(id as FamilyId) ?? BY_ID.get('unsorted')!;

export const familiesInGroup = (g: GroupId) => FAMILIES.filter((f) => f.group === g);

// ── Shapes of the build artefacts ───────────────────────────────────────────

export interface Film {
  t: string;            // title
  y: number;            // year
  f: FamilyId;          // family
  s: string;            // fine-grained subtype, for hover
  r: number | null;     // rating out of 10
  v: number;            // number of ratings
  p: string;            // plot summary
  th: string | null;    // poster path, relative to the TMDB image host
  id: string | null;    // TMDB movie id
  d: string | null;     // director
  c: string | null;     // country
  b: number | null;     // box office, when the dataset has it
}

export interface DecadeRow {
  decade: number;
  total: number;
  counts: Partial<Record<FamilyId, number>>;
  dominant: FamilyId | null;
  meanRating: number | null;
  topRated: { t: string; y: number; r: number } | null;
  mostSeen: { t: string; y: number; v: number } | null;
  topGrossing: { t: string; y: number; b: string } | null;
}

export interface OriginRow {
  decade: number;
  us: number;
  other: number;
  total: number;
  usShare: number;
}

export interface PlotLanguageRow {
  family: FamilyId;
  withPlot: number;
  survival: number;
  annihilation: number;
  survivalPct: number;
  annihilationPct: number;
}

export interface Summary {
  generated: string;
  total: number;
  firstYear: number;
  lastYear: number;
  byFamily: Record<FamilyId, number>;
  decades: DecadeRow[];
  byYear: Record<string, number>;
  peakYear: [string, number];
  withRating: number;
  withBoxOffice: number;
  countries: [string, number][];
  originByDecade: OriginRow[];
  plotLanguage: PlotLanguageRow[];
}

// ── Formatting ──────────────────────────────────────────────────────────────

export const posterUrl = (path: string, size = 'w185') =>
  `https://image.tmdb.org/t/p/${size}${path.startsWith('/') ? '' : '/'}${path}`;

export const tmdbUrl = (id: string) => `https://www.themoviedb.org/movie/${id}`;

export const decadeLabel = (d: number) => `${d}s`;

export function money(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)} billion`;
  if (n >= 1e6) return `$${Math.round(n / 1e6)} million`;
  if (n >= 1e3) return `$${Math.round(n / 1e3)}K`;
  return `$${n}`;
}

export const votes = (n: number) =>
  n >= 1000
    ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k ratings`
    : `${n} rating${n === 1 ? '' : 's'}`;

/** The source data leaves missing fields as empty strings as well as nulls. */
export const orDash = (v: string | null | undefined) => (v && v.trim() ? v : '—');

/**
 * Sixteen records carry a disaster type in the country column — "Natural
 * Disaster" on ten of them, "Man-made Disaster" on six — so Airport reported
 * its country of origin as "Man-made Disaster". Every other value in the column
 * is a real place, so suppressing this handful is enough.
 */
const NOT_A_COUNTRY = /disaster|apocalyp|pandemic|nuclear|zombie|unknown|^n\/a$/i;

export const country = (v: string | null | undefined) =>
  v && v.trim() && !NOT_A_COUNTRY.test(v) ? v : '—';
