// Builds src/data/atlas.json for the /atlas page: where each film's story is
// SET, as named by its own title and synopsis — not where it was produced
// (that is the Country field, already reported elsewhere on the site).
//
// Two passes over public/data/films.json (so run after build-data.mjs):
//
//   1. A curated gazetteer of ~130 named places is matched against each
//      film's title + synopsis. A match pins the film to that place. When a
//      synopsis names both a city and the country that contains it
//      ("Tokyo, Japan"), only the city is kept.
//   2. Films whose story leaves the ground entirely are classified into six
//      space realms (orbit → the Moon → inner planets → Mars → the rocks →
//      deep space) for the off-world chart.
//
// Matching is deliberately conservative: a film with no recognisable place
// name stays off the map, and the page says how many films that is.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const films = JSON.parse(readFileSync(resolve(root, 'public/data/films.json'), 'utf8'));

/* ── The gazetteer ──────────────────────────────────────────────────────────
   `in` names the containing place, so "Tokyo, Japan" pins once, not twice.
   Regexes are word-bounded and case-sensitive where a lowercase collision
   exists (e.g. "nice", "mobile" — neither is listed for exactly that
   reason). Places whose only mention would be ambiguous are left out.     */

const PLACES = [
  // United States — cities and landmarks
  { id: 'nyc', label: 'New York', lat: 40.71, lon: -74.0, in: 'usa', re: /\bNew York|\bManhattan\b|\bBrooklyn\b|\bNYC\b|Coney Island|Empire State|Statue of Liberty/ },
  { id: 'la', label: 'Los Angeles', lat: 34.05, lon: -118.24, in: 'usa', re: /Los Angeles|\bL\.A\.|\bHollywood\b|\bMalibu\b|San Fernando/ },
  { id: 'sf', label: 'San Francisco', lat: 37.77, lon: -122.42, in: 'usa', re: /San Francisco|Golden Gate|\bAlcatraz\b/ },
  { id: 'dc', label: 'Washington, D.C.', lat: 38.9, lon: -77.04, in: 'usa', re: /Washington(,? D\.?C\.?)?\b|White House|\bPentagon\b/ },
  { id: 'chicago', label: 'Chicago', lat: 41.88, lon: -87.63, in: 'usa', re: /\bChicago\b/ },
  { id: 'houston', label: 'Houston', lat: 29.76, lon: -95.37, in: 'usa', re: /\bHouston\b|\bNASA\b|Cape Canaveral|Kennedy Space Center/ },
  { id: 'neworleans', label: 'New Orleans', lat: 29.95, lon: -90.07, in: 'usa', re: /New Orleans|\bKatrina\b/ },
  { id: 'miami', label: 'Miami', lat: 25.76, lon: -80.19, in: 'florida', re: /\bMiami\b/ },
  { id: 'lasvegas', label: 'Las Vegas', lat: 36.17, lon: -115.14, in: 'usa', re: /Las Vegas/ },
  { id: 'seattle', label: 'Seattle', lat: 47.61, lon: -122.33, in: 'usa', re: /\bSeattle\b/ },
  { id: 'boston', label: 'Boston', lat: 42.36, lon: -71.06, in: 'usa', re: /\bBoston\b/ },
  { id: 'philadelphia', label: 'Philadelphia', lat: 39.95, lon: -75.17, in: 'usa', re: /\bPhiladelphia\b/ },
  { id: 'dallas', label: 'Dallas', lat: 32.78, lon: -96.8, in: 'texas', re: /\bDallas\b/ },
  { id: 'denver', label: 'Denver', lat: 39.74, lon: -104.99, in: 'colorado', re: /\bDenver\b/ },
  { id: 'detroit', label: 'Detroit', lat: 42.33, lon: -83.05, in: 'usa', re: /\bDetroit\b/ },
  { id: 'atlanta', label: 'Atlanta', lat: 33.75, lon: -84.39, in: 'usa', re: /\bAtlanta\b/ },
  { id: 'stlouis', label: 'St. Louis', lat: 38.63, lon: -90.2, in: 'usa', re: /St\.? Louis/ },
  { id: 'pittsburgh', label: 'Pittsburgh', lat: 40.44, lon: -79.99, in: 'usa', re: /\bPittsburgh\b/ },
  { id: 'johnstown', label: 'Johnstown, PA', lat: 40.33, lon: -78.92, in: 'usa', re: /\bJohnstown\b/ },
  { id: 'galveston', label: 'Galveston', lat: 29.3, lon: -94.8, in: 'texas', re: /\bGalveston\b/ },
  { id: 'lakehurst', label: 'Lakehurst, NJ', lat: 40.01, lon: -74.31, in: 'usa', re: /\bHindenburg\b|\bLakehurst\b/ },
  { id: 'yellowstone', label: 'Yellowstone', lat: 44.43, lon: -110.59, in: 'usa', re: /\bYellowstone\b/ },
  { id: 'niagara', label: 'Niagara Falls', lat: 43.08, lon: -79.07, in: 'usa', re: /\bNiagara\b/ },
  { id: 'mtsthelens', label: 'Mount St. Helens', lat: 46.19, lon: -122.19, in: 'usa', re: /St\.? Helens/ },
  // United States — states and regions
  { id: 'california', label: 'California', lat: 36.5, lon: -119.5, in: 'usa', re: /\bCalifornia\b|San Andreas/ },
  { id: 'texas', label: 'Texas', lat: 31.3, lon: -99.2, in: 'usa', re: /\bTexas\b/ },
  { id: 'oklahoma', label: 'Oklahoma', lat: 35.5, lon: -97.5, in: 'usa', re: /\bOklahoma\b/ },
  { id: 'kansas', label: 'Kansas', lat: 38.5, lon: -98.3, in: 'usa', re: /\bKansas\b/ },
  { id: 'ohio', label: 'Ohio', lat: 40.2, lon: -82.7, in: 'usa', re: /\bOhio\b/ },
  { id: 'colorado', label: 'Colorado', lat: 39.0, lon: -105.5, in: 'usa', re: /\bColorado\b/ },
  { id: 'florida', label: 'Florida', lat: 28.6, lon: -81.5, in: 'usa', re: /\bFlorida\b/ },
  { id: 'louisiana', label: 'Louisiana', lat: 31.0, lon: -92.0, in: 'usa', re: /\bLouisiana\b/ },
  { id: 'alaska', label: 'Alaska', lat: 64.0, lon: -152.0, in: 'usa', re: /\bAlaska\b/ },
  { id: 'hawaii', label: 'Hawaii', lat: 20.8, lon: -156.3, re: /\bHawaii\b|\bHonolulu\b|\bKilauea\b/ },
  { id: 'usa', label: 'United States', lat: 39.8, lon: -98.6, re: /United States|(?<!South |Latin |Central )\bAmerica\b|\bU\.S\.|\bUSA\b|\bMidwest\b/ },
  // Americas beyond the U.S.
  { id: 'canada', label: 'Canada', lat: 56.0, lon: -106.0, re: /\bCanada\b|\bToronto\b|\bVancouver\b|\bQuebec\b/ },
  { id: 'mexico', label: 'Mexico', lat: 23.6, lon: -102.5, re: /\bMexico\b|\bMexican\b/ },
  { id: 'cuba', label: 'Cuba', lat: 21.5, lon: -79.5, re: /\bCuba\b|\bHavana\b/ },
  { id: 'caribbean', label: 'The Caribbean', lat: 15.5, lon: -73.0, re: /\bCaribbean\b|\bJamaica\b|\bHaiti\b|Puerto Rico/ },
  { id: 'brazil', label: 'Brazil', lat: -10.0, lon: -52.0, re: /\bBrazil\b|Rio de Janeiro|S[ãa]o Paulo/ },
  { id: 'peru', label: 'Peru', lat: -9.2, lon: -75.0, re: /\bPeru\b|\bAndes\b/ },
  { id: 'chile', label: 'Chile', lat: -33.4, lon: -70.7, re: /\bChile\b|\bChilean\b/ },
  { id: 'martinique', label: 'Martinique', lat: 14.64, lon: -61.02, re: /\bMartinique\b|Saint-Pierre|Mont Pel[ée]e/ },
  // Europe
  { id: 'london', label: 'London', lat: 51.51, lon: -0.13, in: 'britain', re: /\bLondon\b|\bThames\b/ },
  { id: 'britain', label: 'Britain', lat: 52.9, lon: -1.8, re: /\bBritain\b|\bEngland\b|\bBritish\b|United Kingdom|\bWales\b|\bCornwall\b/ },
  { id: 'scotland', label: 'Scotland', lat: 56.8, lon: -4.2, re: /\bScotland\b|\bScottish\b|\bEdinburgh\b|\bGlasgow\b/ },
  { id: 'ireland', label: 'Ireland', lat: 53.3, lon: -8.0, re: /\bIreland\b|\bIrish\b|\bDublin\b/ },
  { id: 'paris', label: 'Paris', lat: 48.86, lon: 2.35, in: 'france', re: /\bParis\b|Eiffel/ },
  { id: 'france', label: 'France', lat: 46.6, lon: 2.4, re: /\bFrance\b|\bFrench\b|\bMarseille\b/ },
  { id: 'berlin', label: 'Berlin', lat: 52.52, lon: 13.4, in: 'germany', re: /\bBerlin\b/ },
  { id: 'germany', label: 'Germany', lat: 51.1, lon: 10.4, re: /\bGermany\b|\bGerman\b|\bMunich\b|\bHamburg\b/ },
  { id: 'netherlands', label: 'The Netherlands', lat: 52.2, lon: 5.5, re: /\bNetherlands\b|\bHolland\b|\bDutch\b|\bAmsterdam\b/ },
  { id: 'belgium', label: 'Belgium', lat: 50.6, lon: 4.6, re: /\bBelgium\b|\bBrussels\b/ },
  { id: 'switzerland', label: 'The Alps', lat: 46.6, lon: 8.6, re: /\bSwitzerland\b|\bSwiss\b|\bAlps\b|\balpine\b|\bAustria\b|\bVienna\b/ },
  { id: 'spain', label: 'Spain', lat: 40.3, lon: -3.9, re: /\bSpain\b|\bSpanish\b|\bMadrid\b|\bBarcelona\b/ },
  { id: 'portugal', label: 'Portugal', lat: 39.6, lon: -8.0, re: /\bPortugal\b|\bLisbon\b/ },
  { id: 'rome', label: 'Rome', lat: 41.9, lon: 12.5, in: 'italy', re: /\bRome\b|\bRoman\b/ },
  { id: 'pompeii', label: 'Pompeii', lat: 40.75, lon: 14.49, in: 'italy', re: /\bPompeii\b|\bVesuvius\b|\bHerculaneum\b/ },
  { id: 'naples', label: 'Naples', lat: 40.85, lon: 14.27, in: 'italy', re: /\bNaples\b/ },
  { id: 'venice', label: 'Venice', lat: 45.44, lon: 12.34, in: 'italy', re: /\bVenice\b/ },
  { id: 'sicily', label: 'Sicily', lat: 37.6, lon: 14.0, in: 'italy', re: /\bSicily\b|\bEtna\b|\bStromboli\b/ },
  { id: 'italy', label: 'Italy', lat: 42.8, lon: 12.8, re: /\bItaly\b|\bItalian\b|\bMilan\b/ },
  { id: 'greece', label: 'Greece', lat: 39.0, lon: 22.0, re: /\bGreece\b|\bGreek\b|\bAthens\b|\bSantorini\b/ },
  { id: 'scandinavia', label: 'Scandinavia', lat: 62.0, lon: 12.0, re: /\bNorway\b|\bNorwegian\b|\bSweden\b|\bSwedish\b|\bDenmark\b|\bDanish\b|\bOslo\b|\bStockholm\b|\bCopenhagen\b|\bFinland\b|\bFinnish\b/ },
  { id: 'iceland', label: 'Iceland', lat: 64.9, lon: -18.6, re: /\bIceland\b|\bReykjav[íi]k\b|\bEyjafjallaj/ },
  { id: 'poland', label: 'Poland', lat: 52.1, lon: 19.4, re: /\bPoland\b|\bPolish\b|\bWarsaw\b/ },
  { id: 'prague', label: 'Prague', lat: 50.08, lon: 14.44, re: /\bPrague\b|\bCzech\b/ },
  { id: 'moscow', label: 'Moscow', lat: 55.76, lon: 37.62, in: 'russia', re: /\bMoscow\b/ },
  { id: 'russia', label: 'Russia', lat: 58.0, lon: 60.0, re: /\bRussia\b|\bRussian\b|\bSiberia\b|Soviet Union|\bSoviet\b|\bUSSR\b/ },
  { id: 'chernobyl', label: 'Chernobyl', lat: 51.27, lon: 30.22, re: /\bChernobyl\b|\bPripyat\b/ },
  { id: 'baku', label: 'Baku', lat: 40.41, lon: 49.87, re: /\bBaku\b|\bBibi.?[Hh]eybat\b|\bBalakhany\b|\bAzerbaijan\b/ },
  // Africa & the Middle East
  { id: 'egypt', label: 'Egypt', lat: 26.8, lon: 30.0, re: /\bEgypt\b|\bCairo\b|\bpyramids\b/ },
  { id: 'israel', label: 'Jerusalem', lat: 31.77, lon: 35.21, re: /\bIsrael\b|\bJerusalem\b|Tel Aviv/ },
  { id: 'turkey', label: 'Istanbul', lat: 41.01, lon: 28.98, re: /\bIstanbul\b|\bTurkey\b|\bTurkish\b/ },
  { id: 'iran', label: 'Iran', lat: 32.4, lon: 53.7, re: /\bIran\b|\bTehran\b|\bPersia\b/ },
  { id: 'iraq', label: 'Iraq', lat: 33.2, lon: 43.7, re: /\bIraq\b|\bBaghdad\b|\bBabylon\b/ },
  { id: 'arabia', label: 'Arabia', lat: 24.0, lon: 45.0, re: /Saudi Arabia|\bDubai\b|\bArabian\b/ },
  { id: 'sahara', label: 'The Sahara', lat: 23.0, lon: 8.0, re: /\bSahara\b|\bMorocco\b|\bAlgeria\b|\bLibya\b/ },
  { id: 'westafrica', label: 'West Africa', lat: 9.1, lon: 2.3, re: /\bNigeria\b|\bLagos\b|\bGhana\b|\bSenegal\b/ },
  { id: 'eastafrica', label: 'East Africa', lat: 0.2, lon: 37.9, re: /\bKenya\b|\bNairobi\b|\bEthiopia\b|\bSomalia\b|\bTanzania\b|\bKilimanjaro\b|\bUganda\b/ },
  { id: 'congo', label: 'The Congo', lat: -2.9, lon: 23.7, re: /\bCongo\b/ },
  { id: 'southafrica', label: 'South Africa', lat: -29.0, lon: 25.0, re: /South Africa|\bJohannesburg\b|Cape Town/ },
  // Asia & Oceania
  { id: 'india', label: 'India', lat: 21.8, lon: 79.0, re: /\bIndia\b|\bIndian\b(?! Ocean)|\bMumbai\b|\bBombay\b|\bDelhi\b|\bBhopal\b/ },
  { id: 'himalayas', label: 'The Himalayas', lat: 28.0, lon: 86.9, re: /\bHimalaya|\bEverest\b|\bNepal\b|\bTibet\b|\bK2\b/ },
  { id: 'china', label: 'China', lat: 34.7, lon: 104.2, re: /\bChina\b|\bChinese\b|\bBeijing\b|\bShanghai\b/ },
  { id: 'hongkong', label: 'Hong Kong', lat: 22.32, lon: 114.17, re: /Hong Kong/ },
  { id: 'taiwan', label: 'Taiwan', lat: 23.8, lon: 121.0, re: /\bTaiwan\b|\bTaipei\b/ },
  { id: 'tokyo', label: 'Tokyo', lat: 35.68, lon: 139.69, in: 'japan', re: /\bTokyo\b/ },
  { id: 'japan', label: 'Japan', lat: 36.6, lon: 138.2, re: /\bJapan\b|\bJapanese\b|\bOsaka\b|\bFukushima\b|\bMt\.? Fuji\b|\bHokkaido\b/ },
  { id: 'korea', label: 'Korea', lat: 36.4, lon: 127.9, re: /\bKorea\b|\bKorean\b|\bSeoul\b|\bBusan\b/ },
  { id: 'seasia', label: 'Southeast Asia', lat: 14.1, lon: 101.0, re: /\bThailand\b|\bBangkok\b|\bVietnam\b|\bCambodia\b|\bBurma\b|\bMyanmar\b|\bLaos\b/ },
  { id: 'philippines', label: 'The Philippines', lat: 12.9, lon: 122.8, re: /\bPhilippines\b|\bManila\b|\bFilipino\b/ },
  { id: 'indonesia', label: 'Indonesia', lat: -2.5, lon: 118.0, re: /\bIndonesia\b|\bJakarta\b|\bJava\b|\bSumatra\b|\bBali\b/ },
  { id: 'krakatoa', label: 'Krakatoa', lat: -6.1, lon: 105.42, in: 'indonesia', re: /\bKrakatoa\b|\bKrakatau\b/ },
  { id: 'singapore', label: 'Singapore', lat: 1.35, lon: 103.82, re: /\bSingapore\b/ },
  { id: 'australia', label: 'Australia', lat: -25.3, lon: 134.8, re: /\bAustralia\b|\bAustralian\b|\bSydney\b|\bMelbourne\b|\bOutback\b|\bQueensland\b/ },
  { id: 'nz', label: 'New Zealand', lat: -41.5, lon: 172.8, re: /New Zealand|\bAuckland\b|\bWellington\b|\bM[āa]ori\b/ },
  // Oceans and the ends of the earth
  { id: 'atlantic', label: 'The North Atlantic', lat: 41.7, lon: -49.9, re: /\bAtlantic\b|\bTitanic\b|\bLusitania\b|\bPoseidon\b/ },
  { id: 'pacific', label: 'The Pacific', lat: 12.0, lon: -165.0, re: /\bPacific\b/ },
  { id: 'bermuda', label: 'The Bermuda Triangle', lat: 26.8, lon: -68.0, re: /\bBermuda\b/ },
  { id: 'indianocean', label: 'The Indian Ocean', lat: -14.0, lon: 78.0, re: /Indian Ocean/ },
  { id: 'arctic', label: 'The Arctic', lat: 76.0, lon: -35.0, re: /\bArctic\b|North Pole|\bGreenland\b/ },
  { id: 'antarctica', label: 'Antarctica', lat: -56.5, lon: -65.0, re: /\bAntarctic|South Pole/ },
];

/* ── Space: is the story off the ground, and how far out? ─────────────────
   A film has to place its characters in space, not merely be menaced from
   it — an asteroid barrelling toward Kansas is a Kansas film. Realms are
   tested nearest-to-farthest and the farthest match wins, because a crew
   that leaves orbit for Mars is a Mars story.                             */

const IN_SPACE = new RegExp(
  [
    'astronauts?', 'cosmonauts?', 'space (station|shuttle|craft|ship|mission|colony|program|travel)',
    'spacecraft', 'spaceship', 'moon ?base', 'lunar (base|colony|mission|module|surface)',
    'outer space', 'into space', 'in space', 'wormhole', 'interstellar',
    'on the moon', 'to the moon', 'on mars', 'to mars', 'to venus', 'off-?world',
    'starship', 'another planet', 'distant planet', 'alien planet',
  ].join('|'),
  'i',
);

const REALMS = [
  { id: 'orbit', label: 'Earth orbit', blurb: 'Stations, shuttles and the view back home', dist: 1, re: /space (station|shuttle)|in orbit|orbit of earth|earth'?s orbit|satellite|re-?entry|challenger/i },
  { id: 'moon', label: 'The Moon', blurb: 'Moonbases and the long fall back', dist: 2, re: /\bmoon\b|\blunar\b|apollo/i },
  { id: 'inner', label: 'The inner system', blurb: 'Venus, Mercury and the Sun', dist: 3, re: /\bvenus\b|\bmercury\b|\bthe sun\b|solar mission/i },
  { id: 'mars', label: 'Mars', blurb: 'The red planet, first stop for ambition', dist: 4, re: /\bmars\b|\bmartian/i },
  { id: 'rocks', label: 'The rocks', blurb: 'Asteroids and comets, visited in person', dist: 5, re: /land (on|upon) (the |an? )?(asteroid|comet)|drill.{0,40}(asteroid|comet)|(asteroid|comet).{0,40}drill/i },
  { id: 'deep', label: 'Deep space', blurb: 'Other stars, other worlds, no way home', dist: 6, re: /interstellar|wormhole|galaxy|another planet|distant planet|alien planet|rogue planet|new home for humanity|light-?years/i },
];

// Hand corrections where a synopsis defeats the regexes: films that talk
// like space films but stay on the ground, and one that hides its realm.
const NOT_SPACE = new Set([
  'rapture-palooza|2013',        // "on a mission to defeat the Antichrist"
  'judgment! xx angel rabbie (天罰エンジェルラビィ☆)|2004',
  'planet earth|1974',           // an astronaut, but he never leaves the ground
]);
const FORCE_REALM = new Map([
  ['armageddon|1998', 'rocks'],  // the drilling crew lands on the asteroid
  ['planet of the apes|1968', 'deep'],   // it says "a planet"; we say no more
  ['beneath the planet of the apes|1970', 'deep'],
  ['titan a.e.|2000', 'deep'],   // Earth is gone; everything after is far
  ['pandorum|2009', 'deep'],     // a sleeper ship bound for another world
  ['the midnight sky|2020', 'deep'],  // homebound from a moon of Jupiter
]);

// Synopses sometimes name a place the film is not set in — an exhibition it
// premiered at, the nationality of a torpedo. Struck by hand, per film.
const NOT_AT = new Map([
  ['the oil gush in balakhany (balaxanıda neft fontanı)|1898', ['paris']],
  ['the red tent (красная палатка)|1969', ['italy']],   // the airship Italia, lost in the Arctic
  ['the sinking of the lusitania|1918', ['germany']],   // a German torpedo, an Atlantic grave
]);

const keyOf = (f) => `${f.t.toLowerCase()}|${f.y}`;

/* ── Pass the films through ───────────────────────────────────────────── */

const slim = (f) => ({ t: f.t, y: f.y, f: f.f, r: f.r, th: f.th, id: f.id });

const placeFilms = new Map();   // place id -> films
const spaceFilms = new Map();   // realm id -> films
let locatedCount = 0;

for (const film of films) {
  const text = `${film.t}. ${film.p}`;

  // Space first: an off-world film shouldn't also pin to Houston just
  // because mission control gets a scene... unless the synopsis really
  // names it, which is exactly the charm — so we allow both.
  let realm = null;
  if (!NOT_SPACE.has(keyOf(film)) && IN_SPACE.test(text)) {
    if (FORCE_REALM.has(keyOf(film))) {
      realm = FORCE_REALM.get(keyOf(film));
    } else {
      for (const r of REALMS) if (r.re.test(text)) realm = r.id; // farthest wins
      realm = realm ?? 'orbit';
    }
    if (!spaceFilms.has(realm)) spaceFilms.set(realm, []);
    spaceFilms.get(realm).push(slim(film));
  }

  // A hit is kept unless a more specific hit sits inside it ("Tokyo, Japan"
  // pins Tokyo only). One level is enough for this gazetteer.
  const struck = NOT_AT.get(keyOf(film)) ?? [];
  const hits = PLACES.filter((p) => p.re.test(text) && !struck.includes(p.id));
  const specific = hits.filter((p) => !hits.some((q) => q.in === p.id));

  if (specific.length || realm) locatedCount += 1;
  for (const p of specific) {
    if (!placeFilms.has(p.id)) placeFilms.set(p.id, []);
    placeFilms.get(p.id).push(slim(film));
  }
}

const byCount = (a, b) => b.films.length - a.films.length;

const places = PLACES.filter((p) => placeFilms.has(p.id)).map((p) => ({
  id: p.id,
  label: p.label,
  lat: p.lat,
  lon: p.lon,
  films: placeFilms.get(p.id).sort((a, b) => a.y - b.y),
})).sort(byCount);

const realms = REALMS.filter((r) => spaceFilms.has(r.id)).map((r) => ({
  id: r.id,
  label: r.label,
  blurb: r.blurb,
  dist: r.dist,
  films: spaceFilms.get(r.id).sort((a, b) => a.y - b.y),
}));

const land = JSON.parse(readFileSync(resolve(root, 'data/land-dots.json'), 'utf8'));

const pinned = new Set();
for (const p of places) for (const f of p.films) pinned.add(`${f.t}|${f.y}`);
const inSpace = new Set();
for (const r of realms) for (const f of r.films) inSpace.add(`${f.t}|${f.y}`);

const atlas = {
  generated: new Date().toISOString().slice(0, 10),
  total: films.length,
  located: locatedCount,
  pinnedFilms: pinned.size,
  spaceTotal: inSpace.size,
  places,
  realms,
  land,
};

mkdirSync(resolve(root, 'src/data'), { recursive: true });
writeFileSync(resolve(root, 'src/data/atlas.json'), JSON.stringify(atlas));

console.log(`atlas: ${places.length} places, ${pinned.size} films pinned, ${inSpace.size} in space, ${films.length - locatedCount} unlocated`);
for (const p of places.slice(0, 12)) console.log(`  ${String(p.films.length).padStart(3)}  ${p.label}`);
console.log('space:');
for (const r of realms) console.log(`  ${String(r.films.length).padStart(3)}  ${r.label}: ${r.films.map((f) => f.t).slice(0, 6).join(', ')}`);
