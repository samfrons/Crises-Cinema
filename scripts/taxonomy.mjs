// Consolidates the raw dataset's 105 free-text DisasterType strings (plus 49
// MainCategory and 191 Subcategory values) into 11 families grouped under 4
// "blame" hue groups. Shared by the build script and mirrored for display in
// src/lib/taxonomy.ts.
//
// Matching runs in three tiers, because the source fields differ wildly in
// quality and specificity:
//
//   1. STRONG rules against the curated fields (DisasterType / MainCategory /
//      Subcategory) — these were hand-written and are mostly trustworthy.
//   2. STRONG rules against SpecificDisasterTypes — same rules, worse input: a
//      bad comma-split left fragments like "or possibly nuclear-related" as
//      standalone entries, so it is consulted second.
//   3. GENERIC rules for category-level words ("Man-Made", "Natural",
//      "Post-Apocalyptic") against everything.
//
// Tier 3 exists because those words are labels for whole branches of the source
// taxonomy, not descriptions of a disaster. Matching them at tier 1 put Titanic
// under "Earth & Weather" (its DisasterType reads "Natural Disaster - Collision
// with Iceberg") and 12 Monkeys under "Wreckage" (MainCategory "Man-Made").
// Deferring them lets a concrete signal in any field win first.

// Four groups the eleven families answer to. Each takes one hue in the colour
// system, its members separated by lightness — so a reader can tell "the world"
// from "our machinery" at a glance, and still separate the families within.
export const BLAME_GROUPS = [
  { id: 'world',     label: 'Earth & sky',        gloss: 'The planet, the weather, the void above.' },
  { id: 'ourselves', label: 'Our own machinery',  gloss: 'The bomb, the network, the thing we built.' },
  { id: 'alive',     label: 'Something alive',    gloss: 'Viruses, the risen, visitors.' },
  { id: 'beyond',    label: 'Beyond explanation', gloss: 'Judgment, prophecy, ruins with no cause.' },
];

// A named vehicle or structure is unambiguous enough to outrank a curated
// branch label in any field. Titanic's DisasterType reads "Natural Disaster"
// with Subcategory "Geological"; only "iceberg", over in SpecificDisasterTypes,
// describes what actually happens.
const UNAMBIGUOUS = [
  { id: 'wreckage', re: /titanic|iceberg|shipwreck|maritime|submarine|dirigible|airship|hindenburg|aviation|aircraft|airplane|plane crash|railway|train collision|troop train|high-rise|skyscraper|bridge collapse|tunnel collapse|dam failure|oil rig|oil platform|oil refinery/ },
  // Deep Impact carries the same bad "Geological" subcategory as Titanic. Only
  // the impact phrasings go here, not a bare "comet" — Night of the Comet is a
  // zombie film that happens to mention one.
  { id: 'cosmic', re: /asteroid impact|comet impact|meteor impact|asteroid\/comet|comet\/asteroid|planet-killing|planet killing|comet strike|asteroid collision|asteroid belt|meteor strike/ },
];

// Order is load-bearing: first match wins.
const STRONG = [
  // Zombies before plague: a zombie virus is a zombie film first.
  { id: 'undead', re: /zombie|undead|vampire|zombification|ghoul/ },

  // The bomb before wreckage and climate, so a reactor meltdown is an atom-age
  // film rather than an industrial accident, and "nuclear winter" isn't weather.
  { id: 'atomic', re: /nuclear|atomic|nukes|radioactive|fallout|chernobyl|mushroom cloud/ },

  // Biblical signals must beat Earth, or Noah's Ark lands under "floods".
  { id: 'divine', re: /biblical|noah|rapture|antichrist|satan|revelation|divine retribution|divine intervention/ },

  { id: 'plague', re: /pandemic|pandemc|pandeminc|epidemic|epedemic|virus|viral|infect|contagio|plague|disease|bioweapon|bioterror|outbreak|influenza|smallpox|ebola|cholera|bubonic|quarantine|germ warfare|parasit|bacteri|biotism|locusts/ },

  { id: 'invaders', re: /alien|extraterrestrial|kaiju|monster|creature|godzilla|dragon|titans|body snatcher|insect swarm|\bapes\b|crustacean|carnivorous plant|oceanic predator|invasive species/ },

  { id: 'machines', re: /\bai\b|artificial intelligence|robot|cyber|nanotech|automation|data hack|surveillance|machine dominance/ },

  { id: 'wreckage', re: /\bferry\b|amusement park|naval engineering|engineering failure/ },

  // \bmeteor\b, not /meteor/ — the latter matches "meteorological" and pulled
  // Twister into Cosmic.
  { id: 'cosmic', re: /asteroid|comet|\bmeteor\b|meteorite|meteoroid|meteor shower|meteor impact|solar flare|black hole|white hole|\bspace\b|spacecraft|space station|planetary|\bplanet\b|orbital|galactic|lunar|interstellar|wormhole|dark matter|celestial|geomagnetic/ },

  // Acute natural hazards. Polar shift and continental drift live here rather
  // than under Cosmic: on screen they are earthquake films.
  { id: 'earth', re: /earthquake|quake|volcan|tsunami|tornado|twister|hurricane|typhoon|cyclone|flood|avalanche|landslide|wildfire|bushfire|forest fire|storm|blizzard|\bsnow|lava|lahar|geolog|meteorolog|sinkhole|ash cloud|ash fall|ashfall|heat wave|weather|polar shift|magnetic field|continental drift|soil|freak wave|aftershock|seismic|hypercane|sandstorm|drought|rainfall|lightning|\bfog\b|antarctic|arctic|glacial|cave-in/ },

  // Slow environmental collapse, as distinct from an acute event above.
  { id: 'climate', re: /climate|global warming|ice age|pollution|ecolog|deforest|ocean acid|sea level|resource depletion|famine|biodiversity|habitat|melting|water scarcity|scarcity of water|smog|oil spill|toxic|crop failure|nuclear winter|petroleum spill/ },

  { id: 'wreckage', re: /\bplane\b|air disaster|airport|airline|\bship\b|\btrain\b|\bbus\b|truck|\bcar\b|traffic|vehicle|automotive|motorcycle|collision|crash|\bbridge\b|tunnel|\bdam\b|building|apartment|hotel|structural|infrastructure|construction|urban fire|industrial|mining|\bmine\b|chemical|explosion|\bbomb|terror|tist attack|hijack|sabotage|arson|\boil\b|power grid|power outage|blackout|architectur|\bfire\b|gas leak|energy production|design fault|mechanical failure|pilot error|road safety|driving|brake failure/ },

  // Supernatural and prophetic signals too weak to outrank a concrete hazard
  // above, but enough to classify a film on their own.
  { id: 'divine', re: /divine|prophec|prophes|prophet|myth|legend|deities|deity|demon|ghost|curse|religio|spiritual|possession|paranormal|occult|premonition|precognition|end times|armageddon/ },
];

// Tier 3. Branch labels from the source taxonomy, plus setting-only words:
// "Post-Apocalyptic" describes where a film is set, not what went wrong, so a
// film only lands in After the Fall when no cause was stated anywhere.
const GENERIC = [
  { id: 'plague', re: /biological/ },
  { id: 'machines', re: /technolog|technical|\bmachine/ },
  { id: 'divine', re: /supernatural/ },
  { id: 'cosmic', re: /cosmic|aerospace/ },
  { id: 'climate', re: /environmental|atmospheric/ },
  { id: 'earth', re: /natural/ },
  { id: 'wreckage', re: /man-made|man made|\bwar\b|military|missile|conflict|terror/ },
  { id: 'afterfall', re: /post-apocalyp|post apocalyp|postapocalyp|dystopi|societal collapse|social collapse|societal breakdown|social unrest|social division|social implosion|anarchy|economic collapse|wasteland|apocalyp|end of the world|extinction|totalitarian|cyberpunk|refugee|prophesized|survival|speculative|overpopulation|\bsocial\b|prison|riot/ },
];

// Which blame group each family answers to, plus its display copy.
export const FAMILIES = {
  earth:     { label: 'Earth & Weather', blame: 'world',     gloss: 'Quakes, volcanoes, tsunamis, the sky turning on you.' },
  cosmic:    { label: 'Cosmic',          blame: 'world',     gloss: 'Asteroids, comets, solar flares, the indifferent void.' },
  atomic:    { label: 'Atomic',          blame: 'ourselves', gloss: 'The bomb, the reactor, the fallout.' },
  wreckage:  { label: 'Wreckage',        blame: 'ourselves', gloss: 'Planes, ships, towers, dams — things we built, failing.' },
  machines:  { label: 'Machines',        blame: 'ourselves', gloss: 'AI, robots, networks that stop taking orders.' },
  climate:   { label: 'Climate',         blame: 'world',     gloss: 'Slow collapse: warming, drought, the emptying world.' },
  plague:    { label: 'Plague',          blame: 'alive',     gloss: 'Viruses, epidemics, engineered contagion.' },
  undead:    { label: 'The Undead',      blame: 'alive',     gloss: 'Zombies, vampires, the risen.' },
  invaders:  { label: 'Invaders',        blame: 'alive',     gloss: 'Aliens, kaiju, whatever is bigger than us.' },
  divine:    { label: 'Divine',          blame: 'beyond',    gloss: 'Judgment, prophecy, the supernatural.' },
  afterfall: { label: 'After the Fall',  blame: 'beyond',    gloss: 'Ruins and dystopias, with no cause on record.' },
  unsorted:  { label: 'Unsorted',        blame: 'beyond',    gloss: 'Films the dataset never pinned down.' },
};

// Fixed display order — used for stack order, legend order and colour slots, so
// a family's colour never depends on how many families are on screen.
export const FAMILY_ORDER = [
  'earth', 'climate', 'cosmic',
  'wreckage', 'atomic', 'machines',
  'plague', 'undead', 'invaders',
  'divine', 'afterfall', 'unsorted',
];

const clean = (v) => (typeof v === 'string' ? v : '').toLowerCase();

const curatedText = (m) =>
  [m.DisasterType, m.MainCategory, m.Subcategory].map(clean).join(' | ');
const specificText = (m) =>
  (Array.isArray(m.SpecificDisasterTypes) ? m.SpecificDisasterTypes : []).map(clean).join(' | ');

export function classify(movie) {
  const curated = curatedText(movie);
  const specific = specificText(movie);

  for (const rule of UNAMBIGUOUS) if (rule.re.test(`${curated} | ${specific}`)) return rule.id;
  for (const rule of STRONG) if (rule.re.test(curated)) return rule.id;
  for (const rule of STRONG) if (rule.re.test(specific)) return rule.id;
  const both = `${curated} | ${specific}`;
  for (const rule of GENERIC) if (rule.re.test(both)) return rule.id;
  return 'unsorted';
}

// The fine-grained label shown on hover. Prefers the most specific curated
// field that survives the junk filter, so a reader still sees "Volcanic
// Eruptions" rather than only "Earth & Weather".
const JUNK = /^(none|n\/a|unknown|other|\(none\)|\(blank\)|none specified|blank|null|multi-era|undisclosed)$/i;

function usableLabel(raw) {
  if (typeof raw !== 'string') return null;
  const s = raw.trim().replace(/[.\s]+$/, '');
  if (!s || JUNK.test(s)) return null;
  // Debris from the comma-split: sentence fragments, lowercase openers, length.
  if (s.length > 34) return null;
  if (/^(or|and|but|as|yet|with|though|perhaps|let|judging|not|sunk|drowned|with \d)\b/i.test(s)) return null;
  if (/^[a-z]/.test(s) && s.includes(' ')) return null;
  return s;
}

/**
 * Prefer a label that agrees with the family the film was filed under, so the
 * hover text never contradicts the colour (Mad Max: Fury Road is filed under
 * Atomic, and should read "Nuclear War", not "Wasteland").
 */
export function subtypeLabel(movie, familyId) {
  const candidates = [
    ...(Array.isArray(movie.SpecificDisasterTypes) ? movie.SpecificDisasterTypes : []),
    movie.Subcategory,
    movie.DisasterType,
    movie.MainCategory,
  ].map(usableLabel).filter(Boolean);

  const familyRules = [...UNAMBIGUOUS, ...STRONG, ...GENERIC].filter((r) => r.id === familyId);
  const agrees = candidates.find((c) => familyRules.some((r) => r.re.test(c.toLowerCase())));
  return agrees ?? candidates[0] ?? FAMILIES[familyId].label;
}

/**
 * Entries in the source that are not disaster films at all — the dataset was
 * assembled partly by title search, so a comedy about making a bad movie came
 * along for the ride. Excluded so they cannot surface as a decade headline.
 * Listed explicitly rather than filtered by heuristic; nothing else is dropped.
 */
export const NOT_DISASTER_FILMS = new Set([
  'the disaster artist|2017',  // comedy about the making of The Room
  'spy|2015',                  // spy spoof; no disaster
]);
