// Builds src/data/reel.json — the manifest behind /reel, a scroll-through of
// public-domain film clips streamed from the Internet Archive.
//
// The running site never talks to archive.org: this script does, at curation
// time, and commits the result. Run with: npm run build:reel
//
// ── Clearance policy ─────────────────────────────────────────────────────────
// archive.org license metadata is user-supplied and can be flatly wrong (the
// search index happily returns a 1989 documentary tagged CC0). So no clip is
// admitted on a license tag alone. The test is conjunctive — every accepted
// clip must pass ALL of:
//
//   1. AGE      The film's original release year is before 1931, which makes it
//               unambiguously US public domain in 2026 (95 years from
//               publication). This is the basis for clearance; nothing later
//               ships from this script.
//   2. IDENTITY The archive item is actually that film: the item's own
//               year/date must sit within a year of the release year (a film
//               that premiered late 1922 may carry its 1923 general-release
//               date). Items with no date at all need an explicit, logged
//               waiver explaining how identity was established.
//   3. HYGIENE  No youtube-* rips, nothing from altcensored / fringe / TV-news
//               / trailer / social-media collections.
//   4. PLAYABLE A named h.264 .mp4 exists on the item.
//
// licenseurl / rights are recorded as *supporting* evidence only.
// Rejections — both films we could not clear and specific items we turned
// down — are written into the manifest so the page can print its own ledger.

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const PD_CUTOFF = 1931; // release year must be strictly below this

/** Collections that mark an item as a rip, a re-broadcast or a trailer dump. */
const BANNED_COLLECTIONS = [
  'altcensored', 'fringe', 'deemphasize', 'mirrortube', 'social-media-video',
  'social-media-video-unsorted', 'movie_trailers', 'movie_trailers_unsorted',
  'tvarchive', 'tvnews',
];

// ── The programme ────────────────────────────────────────────────────────────
// Hand-curated after searching archive.org for all 18 pre-1931 films in the
// dataset. `startAt` offsets were chosen from the items' frame thumbnails
// (their .thumbs/ jpgs are named by second) and verified visually against the
// playing video. `window` is the soft loop length in seconds while the clip
// plays unattended.

const PROGRAMME = [
  {
    kind: 'dataset',
    title: 'A Railway Collision', year: 1900, family: 'wreckage',
    identifier: 'a-railway-collision-1900-directed-by-walter-r.-booth',
    file: 'A Railway Collision 1900 Directed by Walter R. Booth .mp4',
    startAt: 0, window: 0, posterAt: 21,
    blurb:
      'Walter R. Booth wrecks two model trains on a mountain ledge — the oldest staged ' +
      'catastrophe in the dataset, forty-eight seconds of engineered calamity.',
    what: 'Model trains meet head-on beside a tunnel mouth; carriages tumble down the slope.',
    audioNote: 'Silent picture — no soundtrack exists.',
    corroboration:
      'Duplicate upload "silent-a-railway-collision" (curated silent_films collection, same 1900 date) corroborates identity.',
  },
  {
    kind: 'dataset',
    title: 'Searching Ruins on Broadway, Galveston, for Dead Bodies', year: 1900, family: 'earth',
    identifier: 'silent-searching-ruins-on-broadway-galveston-for-dead-bodies',
    file: 'Searching Ruins on Broadway, Galveston, for Dead Bodies.mp4',
    startAt: 0, window: 0, posterAt: 30,
    blurb:
      'Eight days after the deadliest hurricane in American history, an Edison crew set a ' +
      'tripod among the debris of Broadway. Disaster cinema before anyone thought to invent ' +
      'it: the camera simply arrived.',
    what: 'Work crews pick through the wreckage of the Galveston hurricane, September 1900.',
    audioNote: 'Silent actuality — no soundtrack exists.',
  },
  {
    kind: 'dataset',
    title: 'San Francisco: Aftermath of Earthquake', year: 1906, family: 'earth',
    identifier: 'AfterThetheSanFranciscoEarthquake1906',
    file: 'earthquake_512kb.mp4',
    startAt: 0, window: 0, posterAt: 60,
    dateWaiver:
      'Item carries no date field. Identity rests on content: every foot of it is 1906 ' +
      'San Francisco aftermath actuality, matching the dataset film. The uploader states it ' +
      'is a compilation of those reels with a music track added, and licenses that edit CC BY 3.0.',
    blurb:
      'The dataset’s first earthquake: actuality reels shot in the smouldering weeks ' +
      'after 18 April 1906, cut together from the footage that survived.',
    what: 'Pans across ruined San Francisco streets, toppled facades and burned-out blocks.',
    audioNote: 'Silent footage — the score on this transfer was added by the compiler.',
  },
  {
    kind: 'archive',
    title: 'San Francisco Earthquake Aftermath, Part 1', year: 1906, family: 'earth',
    identifier: 'SanFranc1906',
    file: 'SanFranc1906_512kb.mp4',
    startAt: 0, window: 90, posterAt: 300,
    blurb:
      'Not on the film list — raw reels from the Prelinger Archives. Refugees, tent ' +
      'kitchens and freestanding chimneys: the same catastrophe at street level, unedited.',
    what: 'Displaced residents and ruined buildings; the original print jumps and rolls.',
    audioNote: 'Silent actuality — no soundtrack exists.',
  },
  {
    kind: 'dataset',
    title: 'The Sinking of the Lusitania', year: 1918, family: 'wreckage',
    identifier: 'the-sinking-of-the-lusitania-1918',
    file: 'The_Sinking_of_the_Lusitania_(1918).mp4',
    startAt: 0, window: 120, posterAt: 420,
    blurb:
      'Winsor McCay spent nearly two years drawing the torpedoing of the Lusitania — some ' +
      '25,000 drawings. The first animated documentary, and still furious.',
    what: 'Animated re-enactment: the liner steams into frame, the torpedo strikes, the ship goes down by the bow.',
    audioNote: 'Silent picture — any sound on this transfer is an added score.',
    corroboration:
      'A second upload ("Sinking_of_the_Lusitania", also dated 1918) corroborates identity; it was rejected for carrying a spurious NC-ND tag.',
  },
  {
    kind: 'dataset',
    title: 'Sodom and Gomorrah', year: 1922, family: 'divine',
    identifier: 'silent-sodom-und-gomorrha',
    file: 'Sodom und Gomorrha.mp4',
    startAt: 5820, window: 75, posterAt: 5874,
    blurb:
      'Michael Curtiz, two decades before Casablanca, burns a biblical city with thousands ' +
      'of Viennese extras. The oldest divine judgment on the books.',
    what: 'Fire rains on the city; crowds flee through collapsing colonnades; the ruins smoke.',
    audioNote: 'Silent picture — any sound on this transfer is an added score.',
    corroboration:
      'Item date 1923-03-26 is the general release; the premiere was October 1922 (dataset year). ' +
      'Duplicate upload "sodom-und-gomorrha-lucy-doraine" (dated 1922, named for its star) corroborates identity.',
  },
  {
    kind: 'dataset',
    title: 'The White Sister', year: 1923, family: 'earth',
    identifier: 'ptp_the-white-sister_henry-king_dvd_x264_mkv_716x480_252423',
    file: 'The.White.Sister.1923.DVDRip.x264-HANDJOB.mp4',
    startAt: 7850, window: 75, posterAt: 7914,
    blurb:
      'Lillian Gish takes the veil; Vesuvius objects. A romantic melodrama that settles its ' +
      'third act with an eruption and a burst dam.',
    what: 'The climax: the volcano erupts, the dam gives way, and tinted crowds evacuate into the smoke.',
    audioNote: 'Silent picture — any sound on this transfer is an added score.',
  },
  {
    kind: 'dataset',
    title: 'The Johnstown Flood', year: 1926, family: 'earth',
    identifier: 'the-johnstown-flood-1926-by-irving-cummings',
    file: 'The.Johnstown.Flood.1926.1080p.BluRay.x264.AAC-[YTS.MX].mp4',
    startAt: 3480, window: 75, posterAt: 3480,
    blurb:
      'Fox’s dramatisation of the 1889 dam failure that killed 2,209 people. The ' +
      'dataset files it under Floods; Pennsylvania filed it under memory.',
    what: 'The South Fork dam gives way and the flood takes the valley below.',
    audioNote: 'Silent picture — any sound on this transfer is an added score.',
    corroboration:
      'A second 1926-dated transfer ("the-johnstown-flood", 66 min vs 68 min here) corroborates identity; ' +
      'it was passed over for a TCM broadcast bug burned into the frame.',
  },
  {
    kind: 'dataset',
    title: "Noah's Ark", year: 1928, family: 'divine',
    identifier: 'noahs-ark-1928_202401',
    file: "Noah's Ark (1928).mp4",
    startAt: 4790, window: 75, posterAt: 4794,
    blurb:
      'Warner Bros. answers the Great War with the Great Flood. The deluge was real enough ' +
      'to injure stuntmen; sound was arriving, and so was the water.',
    what: 'Lightning splits the rock; the storm builds toward the breaking of the flood.',
    audioNote: 'Part-talkie — synchronised score with talking sequences.',
  },
  {
    kind: 'dataset',
    title: 'Madam Satan', year: 1930, family: 'wreckage',
    identifier: 'madam-satan_1930',
    file: 'madam-satan_1930.ia.mp4',
    startAt: 6440, window: 75, posterAt: 6298,
    blurb:
      'Cecil B. DeMille throws a masquerade aboard a zeppelin, then hits it with a storm. ' +
      'The last film here to enter the public domain — 1 January 2026.',
    what: 'The costume ball in the dirigible; the storm; the guests take to parachutes.',
    audioNote: 'Sound film — original recorded dialogue and score.',
  },
];

// Films from the pre-1931 pool we could NOT clear, and items we turned down.
// Committed to the manifest so the page can show its working.

const UNCLEARED_FILMS = [
  { title: 'Oil Gush Fire in Bibiheybat', year: 1898, reason: 'No archive.org item found.' },
  { title: 'The Oil Gush in Balakhany', year: 1898, reason: 'No archive.org item found.' },
  { title: 'The Launch of H.M.S. Albion', year: 1898, reason: 'No archive.org item found (the surviving print is held by the BFI).' },
  { title: 'The Launch of HMS Albion at Blackwall', year: 1898, reason: 'No archive.org item found (the surviving print is held by the BFI).' },
  { title: 'Torment', year: 1924, reason: 'No archive.org item found.' },
  { title: 'The Last Days of Pompeii', year: 1926, reason: 'Only the 1913 Italian version is on archive.org — a different film than the dataset’s 1926 entry.' },
  { title: 'The Sea Beast', year: 1926, reason: 'Search returns only the unrelated 2022 animated feature, its trailers, and a scanned souvenir programme.' },
  { title: 'Tramp, Tramp, Tramp', year: 1926, reason: 'The only match ("tramp_tramp_tramp_1926") is a Fleischer sing-along cartoon of the marching song, not the Harry Langdon feature.' },
  { title: 'Volcano!', year: 1926, reason: 'No archive.org item found.' },
];

const REJECTED_ITEMS = [
  { identifier: 'johnstown-flood-1989-charles-guggenheim', reason: 'A 1989 documentary tagged CC0 — the tag is evidence the metadata is wrong, not that the film is free. Fails the age test by 58 years.' },
  { identifier: 'tramp_tramp_tramp_1926', reason: 'Identity failure: a Fleischer cartoon (c. 1924), not the 1926 Langdon feature the identifier implies.' },
  { identifier: 'madamSatan30', reason: 'A single scene ripped from YouTube (file is a youtube download); the full 1930 feature exists in a cleaner item.' },
  { identifier: 'the-johnstown-flood', reason: 'Same 1926 film, but the transfer is an off-air recording with a TCM logo burned in. Used as corroborating evidence only.' },
  { identifier: 'Sinking_of_the_Lusitania', reason: 'Same 1918 film, but tagged CC BY-NC-ND — a spurious restriction on a public-domain work. Preferred the PD-marked upload.' },
  { identifier: 'san-francisco-earthquake-1906-in-color', reason: 'Modern AI colorisation of 1906 footage — a new creative layer with unclear status. The plain footage ships instead.' },
  { identifier: 'noahsark1928', reason: 'Same 1928 film as the accepted item, but a single 3.2 GB MPEG4 with no streaming derivative.' },
  { identifier: 'madam-satan-1930_202601', reason: 'Same 1930 film, but a 2.4 GB transfer with no streamable derivative; the accepted item has an archive-generated h.264.' },
  { identifier: 'gli-ultimi-giorni-di-pompei-1913-en-st', reason: 'The 1913 Pompeii, not the dataset’s 1926 film. Pre-1931 itself, but the wrong picture.' },
  { identifier: 'GalvestonHurricaneAndTidalWaveOf1900', reason: 'Modern compilation carrying an NC-ND claim; the untouched Edison actuality ships instead.' },
];

// ── Fetch + verify ───────────────────────────────────────────────────────────

async function fetchJson(url, tries = 3) {
  for (let i = 1; i <= tries; i++) {
    try {
      const ctl = new AbortController();
      const t = setTimeout(() => ctl.abort(), 30_000);
      const res = await fetch(url, { signal: ctl.signal });
      clearTimeout(t);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (e) {
      if (i === tries) throw e;
      await new Promise((r) => setTimeout(r, 1500 * i));
    }
  }
}

const encodePath = (name) => name.split('/').map(encodeURIComponent).join('/');
const itemYear = (m) => {
  for (const v of [m.year, m.date]) {
    const hit = String(v ?? '').match(/\b(18|19|20)\d\d\b/);
    if (hit) return Number(hit[0]);
  }
  return null;
};

async function verify(entry) {
  const problems = [];
  const warnings = [];

  // 1. AGE — the basis for everything else.
  if (!(entry.year < PD_CUTOFF)) {
    problems.push(`release year ${entry.year} is not before ${PD_CUTOFF}`);
  }
  if (/^youtube-/i.test(entry.identifier)) problems.push('youtube-* identifier');

  const data = await fetchJson(`https://archive.org/metadata/${entry.identifier}`);
  const meta = data.metadata ?? {};
  const collections = [].concat(meta.collection ?? []);

  // 3. HYGIENE
  for (const c of collections) {
    if (BANNED_COLLECTIONS.includes(c) || c.startsWith('TV-')) {
      problems.push(`banned collection "${c}"`);
    }
  }

  // 2. IDENTITY
  const iy = itemYear(meta);
  if (iy === null) {
    if (entry.dateWaiver) warnings.push(`no item date — waiver: ${entry.dateWaiver}`);
    else problems.push('item has no year/date and no waiver was recorded');
  } else if (Math.abs(iy - entry.year) > 1) {
    problems.push(`item year ${iy} does not corroborate release year ${entry.year}`);
  }

  // 4. PLAYABLE
  const file = (data.files ?? []).find((f) => f.name === entry.file);
  if (!file) problems.push(`file not found on item: ${entry.file}`);

  // Supporting signals, recorded but never sufficient.
  const licenseUrl = meta.licenseurl ?? null;
  if (licenseUrl && /-nc|-nd/.test(licenseUrl)) {
    warnings.push(`restrictive license tag ${licenseUrl} on a PD-by-age work (recorded, not blocking)`);
  }

  if (problems.length) return { ok: false, problems, warnings };

  // Poster: the item's .thumbs/ frames are named by the second they were taken
  // at — pick the one nearest the curated posterAt.
  const thumbs = (data.files ?? [])
    .filter((f) => f.format === 'Thumbnail' && f.name.endsWith('.jpg'))
    .map((f) => ({ name: f.name, sec: Number((f.name.match(/_(\d+)\.jpg$/) ?? [])[1] ?? NaN) }))
    .filter((t) => Number.isFinite(t.sec));
  const want = entry.posterAt ?? entry.startAt;
  const poster = thumbs.length
    ? thumbs.reduce((a, b) => (Math.abs(b.sec - want) < Math.abs(a.sec - want) ? b : a))
    : null;
  if (!poster) warnings.push('no frame thumbnails on item — clip ships without a poster');

  const dl = `https://archive.org/download/${entry.identifier}`;
  return {
    ok: true,
    warnings,
    clip: {
      id: entry.identifier,
      kind: entry.kind,
      title: entry.title,
      year: entry.year,
      family: entry.family,
      blurb: entry.blurb,
      what: entry.what,
      audioNote: entry.audioNote,
      startAt: entry.startAt,
      window: entry.window,
      duration: file.length ? Math.round(Number(file.length)) : null,
      width: file.width ? Number(file.width) : null,
      height: file.height ? Number(file.height) : null,
      src: `${dl}/${encodePath(entry.file)}`,
      poster: poster ? `${dl}/${encodePath(poster.name)}` : null,
      source: {
        identifier: entry.identifier,
        itemUrl: `https://archive.org/details/${entry.identifier}`,
        file: entry.file,
        fileSizeMB: file.size ? Math.round(Number(file.size) / 1e6) : null,
        itemDate: meta.date ?? meta.year ?? null,
        licenseUrl,
        rights: meta.rights ?? null,
        possibleCopyrightStatus: meta['possible-copyright-status'] ?? null,
        collections,
        pdBasis:
          entry.year < PD_CUTOFF
            ? `Released ${entry.year}; US public domain — published before ${PD_CUTOFF}.`
            : 'NOT CLEARED',
        note: [entry.dateWaiver, entry.corroboration].filter(Boolean).join(' ') || null,
      },
    },
  };
}

// ── Run ──────────────────────────────────────────────────────────────────────

const clips = [];
const failures = [];

for (const entry of PROGRAMME) {
  process.stdout.write(`checking ${entry.identifier} … `);
  try {
    const result = await verify(entry);
    if (result.ok) {
      clips.push(result.clip);
      console.log(`ACCEPT  (${entry.year} · ${result.clip.duration ?? '?'}s · ${result.clip.source.fileSizeMB ?? '?'} MB)`);
      for (const w of result.warnings) console.log(`    note: ${w}`);
    } else {
      failures.push({ entry, problems: result.problems });
      console.log('REJECT');
      for (const p of result.problems) console.log(`    fail: ${p}`);
    }
  } catch (e) {
    failures.push({ entry, problems: [`fetch failed: ${e.message}`] });
    console.log(`ERROR — ${e.message}`);
  }
}

if (failures.length) {
  console.error(`\n${failures.length} programme entr${failures.length === 1 ? 'y' : 'ies'} failed verification — manifest NOT written.`);
  process.exit(1);
}

clips.sort((a, b) => a.year - b.year || a.title.localeCompare(b.title));

const manifest = {
  generated: new Date().toISOString().slice(0, 10),
  policy:
    'Conjunctive clearance: (1) released before 1931 — US public domain by age; ' +
    '(2) item date corroborates the release year; (3) no youtube rips or banned collections; ' +
    '(4) a playable h.264 file. License tags are supporting evidence only.',
  clips,
  rejected: {
    films: UNCLEARED_FILMS,
    items: REJECTED_ITEMS.map((r) => ({
      ...r,
      itemUrl: `https://archive.org/details/${r.identifier}`,
    })),
  },
};

mkdirSync(resolve(root, 'src/data'), { recursive: true });
writeFileSync(resolve(root, 'src/data/reel.json'), JSON.stringify(manifest, null, 2));

console.log(`\nreel.json: ${clips.length} clips accepted, ` +
  `${UNCLEARED_FILMS.length} films uncleared, ${REJECTED_ITEMS.length} items rejected.`);
for (const c of clips) console.log(`  ${c.year}  ${c.title}  →  ${c.source.identifier}`);
