// Builds src/data/dispatches.json for the /dispatches page: real disaster
// footage and imagery as witnessed on Reddit, pinned to places and months so
// the page can play catastrophe back through time.
//
// Unlike build-data/build-atlas this script talks to the network — the
// Arctic Shift archive of Reddit (arctic-shift.photon-reddit.com), which
// serves the public record of each subreddit without authentication. It is
// slow by design (the archive rate-limits hard), so it is NOT part of
// `npm run build:data`; the snapshot it writes is committed, and refreshed
// by hand with `npm run build:dispatches`.
//
// Four passes:
//   1. History — monthly post counts per subreddit since 2012, one cheap
//      aggregate call each. This is the long arc: when did people start
//      posting disasters, and how hard has it accelerated.
//   2. Index — every post in the map window (2022 → now), compact fields
//      only, walked forward with a created_utc cursor.
//   3. Pin & file — each indexed post is matched against the gazetteer
//      (place) and the classifier (ontology family, same families as the
//      films). Conservative like the atlas: no named place, no pin.
//   4. Evidence — the most upvoted posts overall / per family / per place
//      are re-fetched in full for their preview images, so the page can
//      show actual footage thumbnails without hammering Reddit itself.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = 'https://arctic-shift.photon-reddit.com/api';

const HISTORY_AFTER = '2012-01-01';
const INDEX_AFTER = '2022-01-01';

/* ── The watched subreddits, filed into the film ontology ─────────────────
   `family: null` marks a general wire (r/DisasterUpdate) whose posts are
   filed one by one by the classifier below; single-hazard subreddits carry
   their family outright. The same eleven families as the films, so the two
   halves of the site speak one language.                                  */

const SUBS = [
  { name: 'DisasterUpdate',      family: null,       gloss: 'The general wire — every hazard, as it happens' },
  { name: 'NaturalDisasters',    family: null,       gloss: 'A second wire for the natural ones' },
  { name: 'tornado',             family: 'earth',    gloss: 'Chasers, sirens and wedges on the ground' },
  { name: 'TropicalWeather',     family: 'earth',    gloss: 'Hurricanes and typhoons, tracked landfall by landfall' },
  { name: 'hurricane',           family: 'earth',    gloss: 'The storms themselves' },
  { name: 'earthquakes',         family: 'earth',    gloss: 'Shake maps and shaking rooms' },
  { name: 'Volcanoes',           family: 'earth',    gloss: 'Eruptions, fissures and lava fields' },
  { name: 'Wildfire',            family: 'earth',    gloss: 'Fire lines and evacuation windows' },
  { name: 'flooding',            family: 'earth',    gloss: 'Water where the streets used to be' },
  { name: 'Tsunamis',            family: 'earth',    gloss: 'The wave, and the warnings' },
  { name: 'CatastrophicFailure', family: 'wreckage', gloss: 'Things we built, failing on camera' },
  { name: 'ContagionCuriosity',  family: 'plague',   gloss: 'Outbreaks, tracked while they are still small' },
  { name: 'H5N1_AvianFlu',       family: 'plague',   gloss: 'One virus, watched like a storm' },
  { name: 'pandemic',            family: 'plague',   gloss: 'The room where COVID was rehearsed' },
];

/* ── The classifier: a post title → an ontology family ────────────────────
   Adapted from scripts/taxonomy.mjs, which does the same for film synopses.
   Order matters: the specific causes outrank the broad ones, so "fire at
   the nuclear plant" files under Atomic, not Wreckage.                    */

const CLASSIFIER = [
  ['plague',   /virus|outbreak|pandemic|epidemic|\bflu\b|H5N1|bird flu|avian|measles|cholera|ebola|mpox|plague|infect|quarantine|vaccin/i],
  ['atomic',   /nuclear|radiat|radioactive|reactor|chern?obyl|fukushima|uranium|fallout/i],
  ['earth',    /tornado|twister|earthquake|\bquake\b|seismic|aftershock|volcan|erupt|\blava\b|pyroclastic|tsunami|hurricane|typhoon|cyclone|flood|flash.?flood|landslide|mudslide|wildfire|bushfire|forest fire|firestorm|\bstorm\b|hail|blizzard|lightning|derecho|monsoon|avalanche|sinkhole|drought|heat.?wave|storm surge|waterspout|\bsupercell\b|dust storm|haboob/i],
  ['climate',  /climate|global warming|sea level|glacier|ice sheet|permafrost|record (heat|temperature)|hottest/i],
  ['machines', /\bAI\b|algorithm|cyberattack|ransomware|grid failure|outage/i],
  ['wreckage', /crash|collision|derail|explosion|explod|blast|collaps|bridge|\bdam\b|capsiz|sink(s|ing)?\b|shipwreck|\bfire\b|burn(s|ed|ing)?\b|spill|leak|plant|factory|refinery|pipeline|scaffold|crane|implosion|malfunction|failure/i],
];

const classify = (title, fallback) => {
  for (const [fam, re] of CLASSIFIER) if (re.test(title)) return fam;
  return fallback ?? 'unsorted';
};

/* ── The gazetteer ────────────────────────────────────────────────────────
   The atlas gazetteer, re-tuned for the way witnesses write headlines: news
   titles name states and small towns ("Greenfield, IA") far more often than
   film synopses do, so every US state gets an entry — postal abbreviation
   included — and the international list leans toward the places disasters
   actually strike. `in` still names the containing place, so "Kerrville,
   Texas" pins once. Matching stays conservative: no name, no pin.        */

const PLACES = [
  // United States — cities and landmarks
  { id: 'nyc', label: 'New York', lat: 40.71, lon: -74.0, in: 'usa', re: /New York|\bManhattan\b|\bBrooklyn\b|\bNYC\b|\bQueens\b/ },
  { id: 'la', label: 'Los Angeles', lat: 34.05, lon: -118.24, in: 'california', re: /Los Angeles|\bL\.A\.|\bHollywood\b|\bMalibu\b|\bPalisades\b|\bAltadena\b|\bEaton\b Fire|San Fernando/ },
  { id: 'sf', label: 'San Francisco', lat: 37.77, lon: -122.42, in: 'california', re: /San Francisco|Golden Gate|Bay Area/ },
  { id: 'dc', label: 'Washington, D.C.', lat: 38.9, lon: -77.04, in: 'usa', re: /Washington,? D\.?C\.?|White House|\bPentagon\b/ },
  { id: 'chicago', label: 'Chicago', lat: 41.88, lon: -87.63, in: 'illinois', re: /\bChicago\b/ },
  { id: 'houston', label: 'Houston', lat: 29.76, lon: -95.37, in: 'texas', re: /\bHouston\b/ },
  { id: 'neworleans', label: 'New Orleans', lat: 29.95, lon: -90.07, in: 'louisiana', re: /New Orleans|\bKatrina\b/ },
  { id: 'miami', label: 'Miami', lat: 25.76, lon: -80.19, in: 'florida', re: /\bMiami\b/ },
  { id: 'tampa', label: 'Tampa', lat: 27.95, lon: -82.46, in: 'florida', re: /\bTampa\b|\bSt\.? Petersburg\b|\bSarasota\b/ },
  { id: 'fortmyers', label: 'Fort Myers', lat: 26.64, lon: -81.87, in: 'florida', re: /Fort Myers|\bNaples, FL\b|\bSanibel\b/ },
  { id: 'lasvegas', label: 'Las Vegas', lat: 36.17, lon: -115.14, in: 'nevada', re: /Las Vegas/ },
  { id: 'seattle', label: 'Seattle', lat: 47.61, lon: -122.33, in: 'washington', re: /\bSeattle\b/ },
  { id: 'boston', label: 'Boston', lat: 42.36, lon: -71.06, in: 'massachusetts', re: /\bBoston\b/ },
  { id: 'philadelphia', label: 'Philadelphia', lat: 39.95, lon: -75.17, in: 'pennsylvania', re: /\bPhiladelphia\b/ },
  { id: 'dallas', label: 'Dallas', lat: 32.78, lon: -96.8, in: 'texas', re: /\bDallas\b|Fort Worth|\bDFW\b/ },
  { id: 'denver', label: 'Denver', lat: 39.74, lon: -104.99, in: 'colorado', re: /\bDenver\b|\bBoulder, CO\b/ },
  { id: 'detroit', label: 'Detroit', lat: 42.33, lon: -83.05, in: 'michigan', re: /\bDetroit\b/ },
  { id: 'atlanta', label: 'Atlanta', lat: 33.75, lon: -84.39, in: 'georgia', re: /\bAtlanta\b/ },
  { id: 'stlouis', label: 'St. Louis', lat: 38.63, lon: -90.2, in: 'missouri', re: /St\.? Louis/ },
  { id: 'baltimore', label: 'Baltimore', lat: 39.29, lon: -76.61, in: 'maryland', re: /\bBaltimore\b|Key Bridge/ },
  { id: 'asheville', label: 'Asheville', lat: 35.6, lon: -82.55, in: 'northcarolina', re: /\bAsheville\b|\bSwannanoa\b/ },
  { id: 'kerrville', label: 'Kerrville, TX', lat: 30.05, lon: -99.14, in: 'texas', re: /\bKerrville\b|\bKerr County\b|Guadalupe River|Camp Mystic/ },
  { id: 'joplin', label: 'Joplin, MO', lat: 37.08, lon: -94.51, in: 'missouri', re: /\bJoplin\b/ },
  { id: 'moore', label: 'Moore, OK', lat: 35.34, lon: -97.49, in: 'oklahoma', re: /\bMoore,? OK\b|\bMoore,? Oklahoma\b/ },
  { id: 'mayfield', label: 'Mayfield, KY', lat: 36.74, lon: -88.64, in: 'kentucky', re: /\bMayfield\b/ },
  { id: 'greenfield', label: 'Greenfield, IA', lat: 41.31, lon: -94.46, in: 'iowa', re: /\bGreenfield\b/ },
  { id: 'rollingfork', label: 'Rolling Fork, MS', lat: 32.9, lon: -90.88, in: 'mississippi', re: /Rolling Fork/ },
  { id: 'lahaina', label: 'Lahaina, Maui', lat: 20.88, lon: -156.68, in: 'hawaii', re: /\bLahaina\b|\bMaui\b/ },
  { id: 'paradise', label: 'Paradise, CA', lat: 39.76, lon: -121.62, in: 'california', re: /\bParadise, CA\b|\bCamp Fire\b/ },
  { id: 'surfside', label: 'Surfside, FL', lat: 25.88, lon: -80.12, in: 'florida', re: /\bSurfside\b|Champlain Towers/ },
  { id: 'eastpalestine', label: 'East Palestine, OH', lat: 40.83, lon: -80.54, in: 'ohio', re: /East Palestine/ },
  { id: 'yellowstone', label: 'Yellowstone', lat: 44.43, lon: -110.59, in: 'usa', re: /\bYellowstone\b/ },
  // United States — the fifty states (postal codes matched as ", XX")
  { id: 'california', label: 'California', lat: 36.5, lon: -119.5, in: 'usa', re: /\bCalifornia\b|,\s?CA\b|\bSoCal\b|\bSan Diego\b|\bSacramento\b/ },
  { id: 'texas', label: 'Texas', lat: 31.3, lon: -99.2, in: 'usa', re: /\bTexas\b|,\s?TX\b|Texas Hill Country|\bSan Antonio\b|\bAustin\b|\bAmarillo\b|\bLubbock\b/ },
  { id: 'oklahoma', label: 'Oklahoma', lat: 35.5, lon: -97.5, in: 'usa', re: /\bOklahoma\b|,\s?OK\b|\bTulsa\b|\bNorman\b/ },
  { id: 'kansas', label: 'Kansas', lat: 38.5, lon: -98.3, in: 'usa', re: /\bKansas\b|,\s?KS\b|\bWichita\b/ },
  { id: 'nebraska', label: 'Nebraska', lat: 41.5, lon: -99.8, in: 'usa', re: /\bNebraska\b|,\s?NE\b|\bOmaha\b|\bLincoln, NE\b|\bElkhorn\b/ },
  { id: 'iowa', label: 'Iowa', lat: 42.0, lon: -93.5, in: 'usa', re: /\bIowa\b|,\s?IA\b|Des Moines/ },
  { id: 'missouri', label: 'Missouri', lat: 38.4, lon: -92.5, in: 'usa', re: /\bMissouri\b|,\s?MO\b/ },
  { id: 'arkansas', label: 'Arkansas', lat: 34.9, lon: -92.4, in: 'usa', re: /\bArkansas\b|,\s?AR\b|Little Rock/ },
  { id: 'louisiana', label: 'Louisiana', lat: 31.0, lon: -92.0, in: 'usa', re: /\bLouisiana\b|,\s?LA\b(?!\.)/ },
  { id: 'mississippi', label: 'Mississippi', lat: 32.7, lon: -89.7, in: 'usa', re: /\bMississippi\b|,\s?MS\b/ },
  { id: 'alabama', label: 'Alabama', lat: 32.8, lon: -86.8, in: 'usa', re: /\bAlabama\b|,\s?AL\b|\bBirmingham, AL\b|\bTuscaloosa\b/ },
  { id: 'georgia', label: 'Georgia', lat: 32.6, lon: -83.4, in: 'usa', re: /\bGeorgia\b|,\s?GA\b/ },
  { id: 'florida', label: 'Florida', lat: 28.6, lon: -81.5, in: 'usa', re: /\bFlorida\b|,\s?FL\b|\bOrlando\b|\bJacksonville\b|Florida Keys/ },
  { id: 'southcarolina', label: 'South Carolina', lat: 33.9, lon: -80.9, in: 'usa', re: /South Carolina|,\s?SC\b|\bCharleston\b/ },
  { id: 'northcarolina', label: 'North Carolina', lat: 35.5, lon: -79.4, in: 'usa', re: /North Carolina|,\s?NC\b|\bCharlotte\b|\bRaleigh\b|Outer Banks/ },
  { id: 'tennessee', label: 'Tennessee', lat: 35.8, lon: -86.4, in: 'usa', re: /\bTennessee\b|,\s?TN\b|\bNashville\b|\bMemphis\b|\bGatlinburg\b/ },
  { id: 'kentucky', label: 'Kentucky', lat: 37.5, lon: -85.3, in: 'usa', re: /\bKentucky\b|,\s?KY\b|\bLouisville\b/ },
  { id: 'virginia', label: 'Virginia', lat: 37.5, lon: -78.9, in: 'usa', re: /\bVirginia\b(?! Beach)|,\s?VA\b|Virginia Beach/ },
  { id: 'westvirginia', label: 'West Virginia', lat: 38.6, lon: -80.6, in: 'usa', re: /West Virginia|,\s?WV\b/ },
  { id: 'ohio', label: 'Ohio', lat: 40.2, lon: -82.7, in: 'usa', re: /\bOhio\b|,\s?OH\b|\bCleveland\b|\bColumbus, OH\b|\bCincinnati\b|\bDayton\b/ },
  { id: 'indiana', label: 'Indiana', lat: 39.9, lon: -86.3, in: 'usa', re: /\bIndiana\b|,\s?IN\b|\bIndianapolis\b/ },
  { id: 'illinois', label: 'Illinois', lat: 40.0, lon: -89.2, in: 'usa', re: /\bIllinois\b|,\s?IL\b/ },
  { id: 'michigan', label: 'Michigan', lat: 44.3, lon: -85.4, in: 'usa', re: /\bMichigan\b|,\s?MI\b/ },
  { id: 'wisconsin', label: 'Wisconsin', lat: 44.6, lon: -89.7, in: 'usa', re: /\bWisconsin\b|,\s?WI\b|\bMilwaukee\b/ },
  { id: 'minnesota', label: 'Minnesota', lat: 46.3, lon: -94.3, in: 'usa', re: /\bMinnesota\b|,\s?MN\b|\bMinneapolis\b/ },
  { id: 'northdakota', label: 'North Dakota', lat: 47.4, lon: -100.5, in: 'usa', re: /North Dakota|,\s?ND\b|\bFargo\b/ },
  { id: 'southdakota', label: 'South Dakota', lat: 44.4, lon: -100.2, in: 'usa', re: /South Dakota|,\s?SD\b/ },
  { id: 'montana', label: 'Montana', lat: 47.0, lon: -109.6, in: 'usa', re: /\bMontana\b|,\s?MT\b/ },
  { id: 'wyoming', label: 'Wyoming', lat: 43.0, lon: -107.5, in: 'usa', re: /\bWyoming\b|,\s?WY\b/ },
  { id: 'idaho', label: 'Idaho', lat: 44.3, lon: -114.6, in: 'usa', re: /\bIdaho\b|,\s?ID\b/ },
  { id: 'utah', label: 'Utah', lat: 39.3, lon: -111.7, in: 'usa', re: /\bUtah\b|,\s?UT\b|Salt Lake/ },
  { id: 'colorado', label: 'Colorado', lat: 39.0, lon: -105.5, in: 'usa', re: /\bColorado\b(?! River)|,\s?CO\b/ },
  { id: 'arizona', label: 'Arizona', lat: 34.3, lon: -111.7, in: 'usa', re: /\bArizona\b|,\s?AZ\b|\bPhoenix\b|\bTucson\b/ },
  { id: 'newmexico', label: 'New Mexico', lat: 34.4, lon: -106.1, in: 'usa', re: /New Mexico|,\s?NM\b|\bAlbuquerque\b|\bRuidoso\b/ },
  { id: 'nevada', label: 'Nevada', lat: 39.6, lon: -116.6, in: 'usa', re: /\bNevada\b|,\s?NV\b|\bReno\b/ },
  { id: 'oregon', label: 'Oregon', lat: 43.9, lon: -120.6, in: 'usa', re: /\bOregon\b|,\s?OR\b|\bPortland\b/ },
  { id: 'washington', label: 'Washington state', lat: 47.4, lon: -120.5, in: 'usa', re: /Washington [Ss]tate|,\s?WA\b|\bSpokane\b|\bTacoma\b/ },
  { id: 'alaska', label: 'Alaska', lat: 64.0, lon: -152.0, in: 'usa', re: /\bAlaska\b|,\s?AK\b|\bAnchorage\b|\bJuneau\b/ },
  { id: 'hawaii', label: 'Hawaii', lat: 20.8, lon: -156.3, re: /\bHawaii\b|,\s?HI\b|\bHonolulu\b|\bKilauea\b|\bOahu\b|Big Island/ },
  { id: 'pennsylvania', label: 'Pennsylvania', lat: 41.0, lon: -77.7, in: 'usa', re: /\bPennsylvania\b|,\s?PA\b|\bPittsburgh\b/ },
  { id: 'newjersey', label: 'New Jersey', lat: 40.1, lon: -74.6, in: 'usa', re: /New Jersey|,\s?NJ\b/ },
  { id: 'newyorkstate', label: 'New York State', lat: 42.9, lon: -75.6, in: 'usa', re: /,\s?NY\b|\bBuffalo\b|\bRochester\b/ },
  { id: 'newengland', label: 'New England', lat: 44.0, lon: -71.5, in: 'usa', re: /New England|\bVermont\b|,\s?VT\b|New Hampshire|,\s?NH\b|\bMaine\b|,\s?ME\b|\bConnecticut\b|,\s?CT\b|Rhode Island|,\s?RI\b/ },
  { id: 'massachusetts', label: 'Massachusetts', lat: 42.3, lon: -71.8, in: 'usa', re: /\bMassachusetts\b|,\s?MA\b|Cape Cod/ },
  { id: 'maryland', label: 'Maryland', lat: 39.0, lon: -76.7, in: 'usa', re: /\bMaryland\b|,\s?MD\b/ },
  { id: 'usa', label: 'United States', lat: 39.8, lon: -98.6, re: /United States|\bU\.S\.|\bUSA\b|\bMidwest\b|Tornado Alley|\bFEMA\b|\bNOAA\b|National Weather Service|\bNWS\b|Gulf Coast|East Coast|West Coast/ },
  // The Americas beyond
  { id: 'canada', label: 'Canada', lat: 56.0, lon: -106.0, re: /\bCanada\b|\bToronto\b|\bVancouver\b|\bQuebec\b|\bAlberta\b|\bOntario\b|\bManitoba\b|\bSaskatchewan\b|British Columbia|\bJasper\b|\bCalgary\b|\bYukon\b|Nova Scotia/ },
  { id: 'mexico', label: 'Mexico', lat: 23.6, lon: -102.5, re: /\bMexico\b(?! City)|Mexico City|\bMexican\b|\bAcapulco\b|\bOaxaca\b|\bGuerrero\b|\bJalisco\b/ },
  { id: 'cuba', label: 'Cuba', lat: 21.5, lon: -79.5, re: /\bCuba\b|\bHavana\b/ },
  { id: 'caribbean', label: 'The Caribbean', lat: 15.5, lon: -73.0, re: /\bCaribbean\b|\bJamaica\b|\bHaiti\b|Puerto Rico|\bBahamas\b|\bBarbados\b|\bGrenada\b|\bDominica\b|Dominican Republic|\bBermuda\b|Cayman|St\.? Vincent|Lesser Antilles/ },
  { id: 'centralamerica', label: 'Central America', lat: 14.6, lon: -87.7, re: /\bGuatemala\b|\bHonduras\b|\bNicaragua\b|El Salvador|Costa Rica|\bPanama\b|\bBelize\b/ },
  { id: 'colombia', label: 'Colombia', lat: 4.6, lon: -74.1, re: /\bColombia\b|\bBogot[áa]\b|\bMedell[íi]n\b/ },
  { id: 'venezuela', label: 'Venezuela', lat: 6.4, lon: -66.6, re: /\bVenezuela\b|\bCaracas\b/ },
  { id: 'ecuador', label: 'Ecuador', lat: -1.8, lon: -78.2, re: /\bEcuador\b|\bQuito\b|\bGalapagos\b/ },
  { id: 'peru', label: 'Peru', lat: -9.2, lon: -75.0, re: /\bPeru\b|\bLima\b|\bAndes\b/ },
  { id: 'bolivia', label: 'Bolivia', lat: -16.5, lon: -64.7, re: /\bBolivia\b|La Paz/ },
  { id: 'brazil', label: 'Brazil', lat: -10.0, lon: -52.0, re: /\bBrazil\b|Rio de Janeiro|S[ãa]o Paulo|Rio Grande do Sul|Porto Alegre|\bAmazon\b/ },
  { id: 'chile', label: 'Chile', lat: -33.4, lon: -70.7, re: /\bChile\b|\bChilean\b|\bSantiago\b|\bValpara[íi]so\b/ },
  { id: 'argentina', label: 'Argentina', lat: -34.6, lon: -64.3, re: /\bArgentina\b|Buenos Aires|\bPatagonia\b/ },
  // Europe
  { id: 'london', label: 'London', lat: 51.51, lon: -0.13, in: 'britain', re: /\bLondon\b/ },
  { id: 'britain', label: 'Britain', lat: 52.9, lon: -1.8, re: /\bBritain\b|\bEngland\b|\bBritish\b|United Kingdom|\bUK\b|\bWales\b|\bCornwall\b|\bYorkshire\b/ },
  { id: 'scotland', label: 'Scotland', lat: 56.8, lon: -4.2, re: /\bScotland\b|\bScottish\b|\bEdinburgh\b|\bGlasgow\b/ },
  { id: 'ireland', label: 'Ireland', lat: 53.3, lon: -8.0, re: /\bIreland\b|\bIrish\b|\bDublin\b/ },
  { id: 'paris', label: 'Paris', lat: 48.86, lon: 2.35, in: 'france', re: /\bParis\b/ },
  { id: 'france', label: 'France', lat: 46.6, lon: 2.4, re: /\bFrance\b|\bFrench\b|\bMarseille\b|\bNormandy\b|\bCorsica\b/ },
  { id: 'germany', label: 'Germany', lat: 51.1, lon: 10.4, re: /\bGermany\b|\bGerman\b|\bBerlin\b|\bMunich\b|\bHamburg\b|\bAhr\b [Vv]alley|\bRhineland\b/ },
  { id: 'netherlands', label: 'The Netherlands', lat: 52.2, lon: 5.5, re: /\bNetherlands\b|\bHolland\b|\bDutch\b|\bAmsterdam\b|\bRotterdam\b/ },
  { id: 'belgium', label: 'Belgium', lat: 50.6, lon: 4.6, re: /\bBelgium\b|\bBrussels\b/ },
  { id: 'alps', label: 'The Alps', lat: 46.6, lon: 8.6, re: /\bSwitzerland\b|\bSwiss\b|\bAlps\b|\balpine\b|\bAustria\b|\bVienna\b|\bTyrol\b|\bBlatten\b|\bZermatt\b/ },
  { id: 'spain', label: 'Spain', lat: 40.3, lon: -3.9, re: /\bSpain\b|\bSpanish\b|\bMadrid\b|\bBarcelona\b|\bValencia\b|\bAndalusia\b|\bCanary\b|La Palma|\bTenerife\b|\bMallorca\b/ },
  { id: 'portugal', label: 'Portugal', lat: 39.6, lon: -8.0, re: /\bPortugal\b|\bLisbon\b|\bMadeira\b|\bAzores\b/ },
  { id: 'italy', label: 'Italy', lat: 42.8, lon: 12.8, re: /\bItaly\b|\bItalian\b|\bMilan\b|\bRome\b|\bNaples\b|\bVenice\b|\bSicily\b|\bEtna\b|\bStromboli\b|Campi Flegrei|\bVesuvius\b|\bIschia\b|Emilia-Romagna/ },
  { id: 'greece', label: 'Greece', lat: 39.0, lon: 22.0, re: /\bGreece\b|\bGreek\b|\bAthens\b|\bSantorini\b|\bRhodes\b|\bCrete\b|\bEvia\b/ },
  { id: 'scandinavia', label: 'Scandinavia', lat: 62.0, lon: 12.0, re: /\bNorway\b|\bNorwegian\b|\bSweden\b|\bSwedish\b|\bDenmark\b|\bDanish\b|\bOslo\b|\bStockholm\b|\bCopenhagen\b|\bFinland\b|\bFinnish\b/ },
  { id: 'iceland', label: 'Iceland', lat: 64.9, lon: -18.6, re: /\bIceland\b|\bReykjav[íi]k\b|\bGrindav[íi]k\b|\bReykjanes\b|\bFagradalsfjall\b|\bSundhn[úu]k/ },
  { id: 'poland', label: 'Poland', lat: 52.1, lon: 19.4, re: /\bPoland\b|\bPolish\b|\bWarsaw\b/ },
  { id: 'czechia', label: 'Czechia', lat: 49.8, lon: 15.5, re: /\bPrague\b|\bCzech\b/ },
  { id: 'balkans', label: 'The Balkans', lat: 43.9, lon: 20.5, re: /\bSerbia\b|\bBelgrade\b|\bCroatia\b|\bZagreb\b|\bBosnia\b|\bAlbania\b|\bKosovo\b|North Macedonia|\bSlovenia\b|\bMontenegro\b|\bRomania\b|\bBucharest\b|\bBulgaria\b/ },
  { id: 'hungary', label: 'Hungary', lat: 47.2, lon: 19.5, re: /\bHungary\b|\bBudapest\b/ },
  { id: 'ukraine', label: 'Ukraine', lat: 49.0, lon: 31.4, re: /\bUkraine\b|\bUkrainian\b|\bKyiv\b|\bKiev\b|\bKharkiv\b|\bKherson\b|Nova Kakhovka/ },
  { id: 'chernobyl', label: 'Chernobyl', lat: 51.27, lon: 30.22, in: 'ukraine', re: /\bChern?obyl\b|\bPripyat\b/ },
  { id: 'russia', label: 'Russia', lat: 58.0, lon: 60.0, re: /\bRussia\b|\bRussian\b|\bMoscow\b|\bSiberia\b|\bKamchatka\b|\bVladivostok\b|\bSakhalin\b/ },
  { id: 'caucasus', label: 'The Caucasus', lat: 42.3, lon: 44.6, re: /\bGeorgia\b \(country\)|\bTbilisi\b|\bArmenia\b|\bYerevan\b|\bAzerbaijan\b|\bBaku\b|\bDagestan\b/ },
  // Africa & the Middle East
  { id: 'morocco', label: 'Morocco', lat: 31.6, lon: -7.1, re: /\bMorocco\b|\bMarrakesh\b|\bMarrakech\b|Atlas Mountains/ },
  { id: 'libya', label: 'Libya', lat: 32.0, lon: 20.1, re: /\bLibya\b|\bDerna\b/ },
  { id: 'egypt', label: 'Egypt', lat: 26.8, lon: 30.0, re: /\bEgypt\b|\bCairo\b/ },
  { id: 'algeria', label: 'Algeria & the Sahara', lat: 28.0, lon: 2.6, re: /\bAlgeria\b|\bTunisia\b|\bSahara\b|\bSahel\b|\bMali\b|\bNiger\b|\bChad\b/ },
  { id: 'israel', label: 'Israel & Palestine', lat: 31.5, lon: 34.9, re: /\bIsrael\b|\bJerusalem\b|Tel Aviv|\bGaza\b|West Bank/ },
  { id: 'lebanon', label: 'Lebanon', lat: 33.9, lon: 35.5, re: /\bLebanon\b|\bBeirut\b/ },
  { id: 'syria', label: 'Syria', lat: 35.0, lon: 38.5, re: /\bSyria\b|\bAleppo\b|\bDamascus\b/ },
  { id: 'turkey', label: 'Turkey', lat: 39.0, lon: 35.2, re: /\bTurkey\b|\bT[üu]rkiye\b|\bTurkish\b|\bIstanbul\b|\bAntakya\b|\bHatay\b|\bGaziantep\b|\bKahramanmara[şs]\b|\bIzmir\b|\bAnkara\b/ },
  { id: 'iran', label: 'Iran', lat: 32.4, lon: 53.7, re: /\bIran\b|\bTehran\b/ },
  { id: 'iraq', label: 'Iraq', lat: 33.2, lon: 43.7, re: /\bIraq\b|\bBaghdad\b|\bMosul\b/ },
  { id: 'arabia', label: 'Arabia & the Gulf', lat: 24.0, lon: 45.0, re: /Saudi Arabia|\bDubai\b|\bUAE\b|\bQatar\b|\bKuwait\b|\bOman\b|\bBahrain\b|\bYemen\b|\bMecca\b|\bJeddah\b/ },
  { id: 'westafrica', label: 'West Africa', lat: 9.1, lon: 2.3, re: /\bNigeria\b|\bLagos\b|\bGhana\b|\bAccra\b|\bSenegal\b|Sierra Leone|\bLiberia\b|\bGuinea\b|Ivory Coast|Burkina Faso|\bCameroon\b/ },
  { id: 'eastafrica', label: 'East Africa', lat: 0.2, lon: 37.9, re: /\bKenya\b|\bNairobi\b|\bEthiopia\b|\bSomalia\b|\bTanzania\b|\bKilimanjaro\b|\bUganda\b|\bRwanda\b|\bSudan\b|\bKhartoum\b|\bDjibouti\b|\bEritrea\b/ },
  { id: 'congo', label: 'The Congo', lat: -2.9, lon: 23.7, re: /\bCongo\b|\bKinshasa\b|\bGoma\b|\bNyiragongo\b/ },
  { id: 'southernafrica', label: 'Southern Africa', lat: -22.0, lon: 26.0, re: /South Africa|\bJohannesburg\b|Cape Town|\bDurban\b|\bMozambique\b|\bMalawi\b|\bZimbabwe\b|\bZambia\b|\bBotswana\b|\bNamibia\b|\bMadagascar\b|\bMayotte\b|\bR[ée]union\b/ },
  // Asia & Oceania
  { id: 'afghanistan', label: 'Afghanistan', lat: 33.9, lon: 67.7, re: /\bAfghanistan\b|\bKabul\b|\bHerat\b|\bKunduz\b/ },
  { id: 'pakistan', label: 'Pakistan', lat: 30.4, lon: 69.3, re: /\bPakistan\b|\bKarachi\b|\bLahore\b|\bIslamabad\b|\bSindh\b|\bBalochistan\b/ },
  { id: 'india', label: 'India', lat: 21.8, lon: 79.0, re: /\bIndia\b|\bIndian\b(?! Ocean)|\bMumbai\b|\bDelhi\b|\bKerala\b|\bChennai\b|\bKolkata\b|\bWayanad\b|\bUttarakhand\b|\bHimachal\b|\bSikkim\b|\bGujarat\b|\bBengaluru\b|\bHyderabad\b/ },
  { id: 'himalayas', label: 'The Himalayas', lat: 28.0, lon: 86.9, re: /\bHimalaya|\bEverest\b|\bNepal\b|\bKathmandu\b|\bTibet\b|\bBhutan\b|\bK2\b|\bAnnapurna\b/ },
  { id: 'bangladesh', label: 'Bangladesh', lat: 23.7, lon: 90.4, re: /\bBangladesh\b|\bDhaka\b/ },
  { id: 'srilanka', label: 'Sri Lanka', lat: 7.9, lon: 80.7, re: /Sri Lanka|\bColombo\b/ },
  { id: 'china', label: 'China', lat: 34.7, lon: 104.2, re: /\bChina\b|\bChinese\b|\bBeijing\b|\bShanghai\b|\bSichuan\b|\bGansu\b|\bYunnan\b|\bGuangzhou\b|\bShenzhen\b|\bWuhan\b|\bHenan\b|\bZhengzhou\b|\bChongqing\b|Three Gorges|\bTteton\b Dam|\bTibet\b Autonomous/ },
  { id: 'hongkong', label: 'Hong Kong', lat: 22.32, lon: 114.17, re: /Hong Kong|\bTai Po\b/ },
  { id: 'taiwan', label: 'Taiwan', lat: 23.8, lon: 121.0, re: /\bTaiwan\b|\bTaipei\b|\bHualien\b/ },
  { id: 'japan', label: 'Japan', lat: 36.6, lon: 138.2, re: /\bJapan\b|\bJapanese\b|\bTokyo\b|\bOsaka\b|\bFukushima\b|\bNoto\b|\bIshikawa\b|\bHokkaido\b|\bOkinawa\b|\bKyushu\b|\bSakurajima\b|Mt\.? Fuji/ },
  { id: 'korea', label: 'Korea', lat: 36.4, lon: 127.9, re: /\bKorea\b|\bKorean\b|\bSeoul\b|\bBusan\b|\bItaewon\b|\bMuan\b|\bJeju\b/ },
  { id: 'seasia', label: 'Southeast Asia', lat: 14.1, lon: 101.0, re: /\bThailand\b|\bBangkok\b|\bPhuket\b|\bVietnam\b|\bHanoi\b|\bDa Nang\b|\bCambodia\b|\bMyanmar\b|\bBurma\b|\bMandalay\b|\bLaos\b|\bMalaysia\b|Kuala Lumpur|\bBrunei\b/ },
  { id: 'philippines', label: 'The Philippines', lat: 12.9, lon: 122.8, re: /\bPhilippines\b|\bPhilippine\b|\bManila\b|\bFilipino\b|\bLuzon\b|\bMindanao\b|\bCebu\b|\bTaal\b|\bMayon\b|\bKanlaon\b/ },
  { id: 'indonesia', label: 'Indonesia', lat: -2.5, lon: 118.0, re: /\bIndonesia\b|\bJakarta\b|\bJava\b|\bSumatra\b|\bBali\b|\bSulawesi\b|\bLombok\b|\bMerapi\b|\bSemeru\b|\bKrakatau\b|\bKrakatoa\b|\bRuang\b|\bFlores\b|Lewotobi/ },
  { id: 'papuanewguinea', label: 'Papua New Guinea', lat: -6.3, lon: 145.0, re: /Papua New Guinea|\bPNG\b|\bEnga\b/ },
  { id: 'australia', label: 'Australia', lat: -25.3, lon: 134.8, re: /\bAustralia\b|\bAustralian\b|\bSydney\b|\bMelbourne\b|\bBrisbane\b|\bPerth\b|\bQueensland\b|New South Wales|\bNSW\b|\bOutback\b|\bTownsville\b|\bCairns\b/ },
  { id: 'nz', label: 'New Zealand', lat: -41.5, lon: 172.8, re: /New Zealand|\bAuckland\b|\bWellington\b|\bChristchurch\b|White Island|\bWhakaari\b/ },
  { id: 'pacificislands', label: 'The Pacific Islands', lat: -17.7, lon: 178.0, re: /\bFiji\b|\bTonga\b|\bVanuatu\b|\bSamoa\b|Solomon Islands|\bGuam\b|\bMicronesia\b|\bKiribati\b|New Caledonia|Hunga Tonga/ },
  // Oceans and the ends of the earth
  { id: 'atlantic', label: 'The Atlantic', lat: 35.0, lon: -45.0, re: /\bAtlantic\b|\bTitan\b submersible|\bTitanic\b/ },
  { id: 'pacific', label: 'The Pacific', lat: 12.0, lon: -165.0, re: /\bPacific\b(?! Islands| Northwest)|Ring of Fire/ },
  { id: 'indianocean', label: 'The Indian Ocean', lat: -14.0, lon: 78.0, re: /Indian Ocean|\bMaldives\b/ },
  { id: 'mediterranean', label: 'The Mediterranean', lat: 35.5, lon: 18.0, re: /\bMediterranean\b|\bCyprus\b|\bMalta\b/ },
  { id: 'arctic', label: 'The Arctic', lat: 76.0, lon: -35.0, re: /\bArctic\b|North Pole|\bGreenland\b|\bSvalbard\b/ },
  { id: 'antarctica', label: 'Antarctica', lat: -56.5, lon: -65.0, re: /\bAntarctic|South Pole|Thwaites/ },
];

/* ── Slow, patient HTTP ─────────────────────────────────────────────────── */

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let calls = 0;

async function get(url, tries = 10) {
  for (let i = 0; i < tries; i++) {
    try {
      calls += 1;
      const res = await fetch(url, { headers: { 'User-Agent': 'crises-cinema dispatches build (contact: github.com/samfrons/Crises-Cinema)' } });
      const body = await res.json();
      if (body.error) throw new Error(body.error);
      await sleep(2500);
      return body.data;
    } catch (e) {
      if (i === tries - 1) throw new Error(`${url} → ${e.message ?? e}`);
      // The archive says "Timeout. Maybe slow down a bit" when crowded;
      // obliging is the whole strategy.
      await sleep(Math.min(10000 * (i + 1), 60000));
    }
  }
}

/* A run takes half an hour of polite waiting, so each subreddit's fetches
   land in .cache/dispatches/ as they finish and a re-run after a crash
   picks up where it left off. Delete the directory for a fresh pull. */

const cacheDir = resolve(root, '.cache/dispatches');
mkdirSync(cacheDir, { recursive: true });

async function cached(key, fn) {
  const file = resolve(cacheDir, `${key}.json`);
  if (existsSync(file)) return JSON.parse(readFileSync(file, 'utf8'));
  const value = await fn();
  writeFileSync(file, JSON.stringify(value));
  return value;
}

/* ── Pass 1: history ────────────────────────────────────────────────────── */

const ym = (iso, epoch) => {
  // Aggregate buckets come back at the previous month's 23:00 in winter —
  // the archive bins in Central European time — so nudge by two hours
  // before reading off the month.
  const d = epoch ? new Date(epoch * 1000) : new Date(iso);
  return new Date(d.getTime() + 2 * 3600 * 1000).toISOString().slice(0, 7);
};

async function fetchHistory(sub) {
  // One aggregate over the full range is too expensive for the archive's
  // query timeout on busy subreddits; year slices go through.
  const lastYear = new Date().getUTCFullYear();
  const months = {};
  for (let y = Number(HISTORY_AFTER.slice(0, 4)); y <= lastYear; y++) {
    const before = y < lastYear ? `&before=${y + 1}-01-01` : '';
    // Cached per slice, not per subreddit, so a crash mid-sub loses one
    // year of progress instead of all of it.
    const d = await cached(`hist-${sub}-${y}`, () =>
      get(`${BASE}/posts/search/aggregate?subreddit=${sub}&aggregate=created_utc&frequency=month&after=${y}-01-01${before}`));
    for (const row of d ?? []) months[ym(row.created_utc)] = Number(row.count);
    process.stdout.write(`\r  history r/${sub}: through ${y}…  `);
  }
  process.stdout.write('\r');
  return months;
}

/* ── Pass 2: the index ──────────────────────────────────────────────────── */

const FIELDS = 'id,title,score,created_utc,subreddit,over_18';

async function fetchIndex(sub) {
  const posts = [];
  let cursor = INDEX_AFTER;
  for (let page = 0; page < 400; page++) {
    const d = await get(`${BASE}/posts/search?subreddit=${sub}&limit=auto&sort=asc&after=${cursor}&fields=${FIELDS}`);
    if (!d?.length) break;
    posts.push(...d);
    if (d.length < 100) break; // a short page is the last page
    cursor = d[d.length - 1].created_utc + 1;
    process.stdout.write(`\r  r/${sub}: ${posts.length} posts…   `);
  }
  process.stdout.write(`\r  r/${sub}: ${posts.length} posts      \n`);
  return posts;
}

/* ── Pass 3: pin and file ───────────────────────────────────────────────── */

function pin(title) {
  const hits = PLACES.filter((p) => p.re.test(title));
  const specific = hits.filter((p) => !hits.some((q) => q.in === p.id));
  // A headline that names two unrelated places ("aid from Japan reaches
  // Turkey") is about the second-guessing, not the map; keep the first,
  // most specific hit only.
  return specific[0]?.id ?? null;
}

/* ── Pass 4: the evidence ───────────────────────────────────────────────── */

const unescapeUrl = (u) => u.replaceAll('&amp;', '&');

function mediaOf(full) {
  const url = full.url ?? '';
  const kind =
    full.is_video || /v\.redd\.it|youtube\.com|youtu\.be|streamable\.com/.test(url) ||
    /video/.test(full.post_hint ?? '')
      ? 'video'
      : full.gallery_data
        ? 'gallery'
        : /i\.redd\.it|i\.imgur\.com/.test(url) || full.post_hint === 'image'
          ? 'image'
          : full.selftext?.length > 0 && url.includes(full.permalink ?? `/comments/${full.id}/`)
            ? 'text'
            : 'link';

  let thumb = null;
  let w = 0;
  let h = 0;
  const img = full.preview?.images?.[0];
  if (img) {
    // The mid-size rendition keeps the wall sharp without weighing a
    // megabyte per cell; fall back to the source when it is all there is.
    const fit = (img.resolutions ?? []).filter((r) => r.width >= 240).sort((a, b) => a.width - b.width)[0]
      ?? img.resolutions?.[img.resolutions.length - 1]
      ?? img.source;
    if (fit?.url) { thumb = unescapeUrl(fit.url); w = fit.width; h = fit.height; }
  }
  if (!thumb && /^https?:/.test(full.thumbnail ?? '') ) {
    thumb = unescapeUrl(full.thumbnail);
    w = full.thumbnail_width ?? 0;
    h = full.thumbnail_height ?? 0;
  }
  return { kind, thumb, w, h };
}

async function fetchEvidence(ids) {
  const out = [];
  for (let i = 0; i < ids.length; i += 40) {
    try {
      const d = await get(`${BASE}/posts/ids?ids=${ids.slice(i, i + 40).join(',')}`);
      out.push(...(d ?? []));
    } catch (e) {
      console.log(`\n  evidence batch at ${i}: FAILED (${e.message})`);
      failures.push(`evidence batch ${i}`);
    }
    process.stdout.write(`\r  evidence: ${out.length}/${ids.length}…  `);
  }
  process.stdout.write('\n');
  return out;
}

/* ── Run ────────────────────────────────────────────────────────────────── */

console.log(`dispatches: ${SUBS.length} subreddits, index window ${INDEX_AFTER} → now`);

// The archive has bad hours; one subreddit failing all its retries should
// cost that subreddit, not the run. Failures are named at the end so a
// re-run (which picks the gap up from cache) is an informed choice.
const failures = [];

const history = [];
for (const s of SUBS) {
  try {
    const months = await cached(`history-${s.name}`, () => fetchHistory(s.name));
    const total = Object.values(months).reduce((a, b) => a + b, 0);
    console.log(`  history r/${s.name}: ${total} posts since ${HISTORY_AFTER}`);
    history.push({ sub: s.name, months });
  } catch (e) {
    console.log(`  history r/${s.name}: FAILED (${e.message})`);
    failures.push(`history r/${s.name}`);
    history.push({ sub: s.name, months: {} });
  }
}

const indexed = [];
for (const s of SUBS) {
  let raw = [];
  try {
    raw = await cached(`index-${s.name}`, () => fetchIndex(s.name));
  } catch (e) {
    console.log(`  index r/${s.name}: FAILED (${e.message})`);
    failures.push(`index r/${s.name}`);
  }
  for (const p of raw) {
    if (p.over_18 || !p.title) continue;
    indexed.push({
      id: p.id,
      title: p.title,
      score: p.score ?? 0,
      created: p.created_utc,
      sub: s.name,
      family: classify(p.title, s.family),
      place: pin(p.title),
    });
  }
}

// One family per general-wire subreddit for the long-history chart: the one
// its own indexed posts land in most often.
const dominant = new Map();
for (const s of SUBS) {
  if (s.family) { dominant.set(s.name, s.family); continue; }
  const tally = {};
  for (const p of indexed) if (p.sub === s.name) tally[p.family] = (tally[p.family] ?? 0) + 1;
  dominant.set(s.name, Object.entries(tally).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'unsorted');
}

/* The wire: per-month counts by family, from the index. */
const wireMap = new Map();
for (const p of indexed) {
  const m = ym(null, p.created);
  if (!wireMap.has(m)) wireMap.set(m, {});
  const row = wireMap.get(m);
  row[p.family] = (row[p.family] ?? 0) + 1;
}
const wire = [...wireMap.entries()].sort((a, b) => a[0] < b[0] ? -1 : 1)
  .map(([m, families]) => ({ m, families }));

/* Places: totals, families, months, and each place's loudest witnesses. */
const placeMap = new Map();
for (const p of indexed) {
  if (!p.place) continue;
  if (!placeMap.has(p.place)) placeMap.set(p.place, { total: 0, families: {}, months: {}, posts: [] });
  const row = placeMap.get(p.place);
  row.total += 1;
  row.families[p.family] = (row.families[p.family] ?? 0) + 1;
  const m = ym(null, p.created);
  row.months[m] = (row.months[m] ?? 0) + 1;
  row.posts.push(p);
}

/* Pick the evidence: the top of every place, family and month, plus the
   overall front page — one pool, deduped. */
const byScore = (a, b) => b.score - a.score;
const pool = new Map();
const take = (arr, n) => { for (const p of [...arr].sort(byScore).slice(0, n)) pool.set(p.id, p); };

take(indexed, 160);
for (const [, row] of placeMap) take(row.posts, 3);
for (const famId of new Set(indexed.map((p) => p.family))) take(indexed.filter((p) => p.family === famId), 10);
for (const [m] of wireMap) take(indexed.filter((p) => ym(null, p.created) === m), 2);

console.log(`  index: ${indexed.length} posts, ${placeMap.size} places, pool of ${pool.size} for evidence`);

const fullById = new Map((await fetchEvidence([...pool.keys()])).map((f) => [f.id, f]));

const posts = [...pool.values()].map((p) => {
  const full = fullById.get(p.id);
  const media = full ? mediaOf(full) : { kind: 'link', thumb: null, w: 0, h: 0 };
  const removed = full?._meta?.removal_type != null;
  return {
    id: p.id,
    title: p.title,
    score: p.score,
    n: full?.num_comments ?? 0,
    created: p.created,
    sub: p.sub,
    family: p.family,
    place: p.place,
    ...media,
    removed,
  };
})
  // A removed post's media is gone from Reddit even when the archive kept
  // its metadata; the wall only shows what a reader can still open.
  .filter((p) => !p.removed)
  .sort(byScore);

const places = PLACES.filter((p) => placeMap.has(p.id)).map((p) => {
  const row = placeMap.get(p.id);
  return {
    id: p.id,
    label: p.label,
    lat: p.lat,
    lon: p.lon,
    total: row.total,
    families: row.families,
    months: row.months,
    top: [...row.posts].sort(byScore).slice(0, 12).map((x) => x.id),
  };
}).sort((a, b) => b.total - a.total);

/* Titles for the map dossier that the evidence pass did not fetch in full:
   keep a light lookup so every place can list its top posts. */
const known = new Set(posts.map((p) => p.id));
const extras = [];
for (const pl of places) {
  for (const id of pl.top) {
    if (known.has(id)) continue;
    const p = indexed.find((x) => x.id === id);
    if (p) { extras.push({ id: p.id, title: p.title, score: p.score, n: 0, created: p.created, sub: p.sub, family: p.family, place: p.place, kind: 'link', thumb: null, w: 0, h: 0 }); known.add(id); }
  }
}

const monthsAll = wire.map((w) => w.m);
const peak = [...wire].sort((a, b) =>
  Object.values(b.families).reduce((x, y) => x + y, 0) - Object.values(a.families).reduce((x, y) => x + y, 0))[0];

const out = {
  generated: new Date().toISOString().slice(0, 10),
  indexAfter: INDEX_AFTER,
  historyAfter: HISTORY_AFTER,
  totalIndexed: indexed.length,
  located: indexed.filter((p) => p.place).length,
  subs: SUBS.map((s) => ({
    name: s.name,
    gloss: s.gloss,
    family: dominant.get(s.name),
    mixed: s.family === null,
    total: history.find((h) => h.sub === s.name)?.months
      ? Object.values(history.find((h) => h.sub === s.name).months).reduce((a, b) => a + b, 0)
      : 0,
  })),
  history,
  wire,
  months: monthsAll,
  peakMonth: peak ? { m: peak.m, n: Object.values(peak.families).reduce((a, b) => a + b, 0) } : null,
  places,
  posts: [...posts, ...extras],
};

mkdirSync(resolve(root, 'src/data'), { recursive: true });
writeFileSync(resolve(root, 'src/data/dispatches.json'), JSON.stringify(out));

const kb = Math.round(JSON.stringify(out).length / 1024);
console.log(`dispatches: wrote src/data/dispatches.json (${kb} KB, ${calls} API calls)`);
if (failures.length) console.log(`  WITH GAPS — failed: ${failures.join(', ')}. Re-run to fill from cache.`);
console.log(`  ${out.totalIndexed} posts indexed, ${out.located} pinned to ${places.length} places, ${posts.length} with evidence`);
for (const p of places.slice(0, 10)) console.log(`  ${String(p.total).padStart(5)}  ${p.label}`);
