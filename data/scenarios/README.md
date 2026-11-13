# Control Room scenarios

One JSON file per scenario. Every file is validated by `scripts/build-scenarios.mjs`
(run automatically as part of `npm run build:data`); a playable scenario with an
unsourced fact **fails the build**.

## The one rule

**Nothing in a playable scenario is invented.** Every piece of information shown
to the player, every historical action, every inquiry quote and the death toll
carries a citation that resolves to an entry in `sources[]`. Where the record is
silent — above all, what *would* have happened had officials chosen differently —
the field says so explicitly (`"known": false`) and the UI renders
"THE RECORD IS SILENT". The game clock therefore follows the real timeline no
matter what the player chooses: choices are scored against the record, never
simulated into a counterfactual world.

The only interpretive layer is `scoring` and the per-option `effects` block
(warning scope, false-alarm weight). These are game design, not history, and the
UI labels them as such in the debrief.

## Schema (per scenario)

```jsonc
{
  "id": "valencia-dana-2024",          // kebab-case, matches filename
  "status": "playable" | "stub",       // stubs may carry "SOURCE NEEDED" and are
                                       // excluded from play; playables may not
  "title": "…",
  "date": "2024-10-29",
  "location": "…",
  "hazard": "flash flood | dam failure | tropical cyclone | wildfire | …",
                                       // also picks the board's vocabulary (below);
                                       // must name a family in vocabulary.json
  "clock": { "timezone": "CET", "start": "07:36", "end": "20:11" },
  "record_caveat": "…",                // honest note on the state of the record
  "briefing_media": { …media },        // optional, one figure; only what existed
                                       //   before the clock starts

  "timesteps": [{
    "id": "t1",
    "time": "07:36",                   // HH:MM on the scenario clock, for ordering
    "time_label": "07:36",             // what the player sees ("early afternoon" ok)
    "approx": false,                   // true when the source gives no exact time
    "info_available": [{               // ONLY what officials had at this moment
      "id": "t1-i1",
      "kind": "forecast | gauge | message | media | field_report",
      "text": "…",
      "citation": { "sourceId": "aemet-2024", "detail": "…" },
      "zones": ["poyo-horta-sud"],     // optional: at-risk zones this item lights
      "board_state": "impact",         // optional: none | watch | signal | impact
                                       //   (omitted → the hazard's default for kind)
      "media": { …media }              // optional figure printed under the slip
    }],
    "options": [{                      // 2–4; option WORDING is game design,
      "id": "t1-a1",                   // consequence CONTENT is not
      "label": "…",
      "detail": "…",
      "effects": {                     // interpretive scoring layer
        "warning_scope": "none | targeted | province",
        "zones": ["poyo-horta-sud"],
        "protective": true,
        "false_alarm_weight": 0        // 0–2: cost if the signal did not yet warrant it
      },
      "consequence": {
        "known": true,                 // true ⇒ text + citation REQUIRED
        "text": "…",                   // what actually followed (historical option),
        "citation": { … }              //   or a cited counterfactual finding
      }                                // known:false ⇒ UI says the record is silent
    }],
    "historical_option_id": "t1-a3",   // may be null + explained in record_caveat
    "historical_citation": { … }       // required when historical_option_id set
  }],

  "historical_path": [{                // the debrief's THEY DID column
    "timestep_id": "t1",
    "action": "…",
    "citation": { … }
  }],

  "inquiry_findings": [{               // THE INQUIRY SAID column
    "kind": "verbatim | paraphrase",   // verbatim = short quote, quoted exactly
    "quote": "…",
    "translation": "…",                // optional
    "citation": { … }
  }],

  "debrief_media": [{ …media }],       // optional: figures from AFTER the last
                                       //   decision — shown only in the debrief

  "outcome": {
    "deaths": { "min": 227, "max": 229, "contested": true, "note": "…" },
    "citation": { … }
  },

  "scoring": {                         // interpretive layer — labelled so in UI
    "impact": { "time": "19:00", "label": "…", "citation": { … } },
    "at_risk_zones": [{ "id": "poyo-horta-sud", "label": "…" }],
    "historical_first_public_alert": "20:11",
    "benchmark": [{ …call }],          // REQUIRED: the earliest defensible call
                                       //   (game design) — see "The reckoning"
    "minutes_matter": [{ …quote }]     // optional: cited context, never a conversion
  },

  "sources": [{
    "id": "aemet-2024",
    "label": "full bibliographic description",
    "url": null,                       // never invent URLs; add real ones later
    "note": "…"
  }]
}
```

## Media attachments

A figure is an image or a short video, printed in the log as a plate with its
caption, credit and licence. It is held to the same standard as a citation:

```jsonc
{
  "file": "maui-viirs-active-fire-2023-08-08.jpg", // bare kebab-case name under
                                       //   public/control-room/<scenario-id>/
  "type": "image" | "video",
  "caption": "…",                      // stands on its own: date + what it shows;
                                       //   it is also the image's alt text
  "credit": "NASA EOSDIS GIBS …",
  "license": "CC0 1.0 (…)",            // a real licence, never "TBD"/"unknown"
  "licenseUrl": "https://…",           // optional; the licence link (else sourcePage)
  "sourcePage": "https://…",           // where the file came from
  "width": 1200, "height": 600,        // pixels — the page reserves the space
  "poster": "clip-poster.jpg"          // video only, optional, same folder
  // extra research fields (bytes, takenOn, licenseVerifiedOn, durationSeconds,
  // suggestedTimestep…) may ride along; the UI ignores them
}
```

For a playable scenario the build **fails** if a required field is missing, the
licence is a placeholder, a URL is not http(s), the file (or poster) does not
exist under `public/control-room/<scenario-id>/`, or the extension does not match
the type. Files are served byte-for-byte as vetted — do not recompress them, and
do not route them through an image optimiser.

**Time discipline.** The player must never see tomorrow's imagery today. When
`takenOn` starts with a date, a figure in the play log (`briefing_media` or an
info item's `media`) taken after the scenario's `date` fails the build; it
belongs in `debrief_media`. Within the day, place a figure no earlier than the
decision point by which it existed (a satellite pass at 13:30 is not on the
desk at 09:30) — the build cannot check clock times, so the reviewer must.

## The ops board and hazard vocabulary

Each zoned info item lights its zones on a hand-drawn schematic board
(`src/app/control-room/OpsMap.tsx`, one drawing per scenario id; a scenario
without one simply shows no board). Zone state escalates only:
`quiet → watch → signal → impact`. What those states are *called*, and which
item kind lights which state by default, comes from the scenario's `hazard`
(`src/app/control-room/hazards.ts`):

| family (`hazard` contains…) | watch | signal | impact | kind defaults |
|---|---|---|---|---|
| fire (fire, bushfire, wildland) | red flag | fire reported | burning | forecast → watch, gauge (sensor) → signal, field_report → signal |
| storm (cyclone, hurricane, typhoon) | warning in force | winds measured | storm ashore | forecast → watch, gauge (observation) → signal; field_report lights nothing by default |
| water (flood, dam, levee, rain, river, surge) | red warning | gauge alert | flooding | forecast → watch, gauge → signal, field_report → impact |

The families, their match patterns and their state words live in
`vocabulary.json` (`hazards`), shared by `hazards.ts` and the validator. The
first family whose pattern the `hazard` contains wins, in the order above — so
"hurricane / levee failure" is a storm, "dam failure / flash flood" is water.
The build **fails** a playable scenario whose `hazard` names no family.

The storm words are the ones both storm records print. *Warning in force*: NHC's
Hurricane Warning "including the city of New Orleans", IMD's cyclone warning
bulletins for the Odisha coast. *Winds measured*: an instrument has the storm's
winds as it closes (Southwest Pass's sustained winds in NHC Advisory 24; the
Visakhapatnam radar's 60 m/s at 19:40). *Storm ashore* is lit only by an item
whose `board_state` says `"impact"`, where the cited text says the storm is on
that zone — a forecast of landfall is not a landfall, and neither storm
scenario's clock reaches one. A storm scenario never says "gauge alert" or
"red warning".

An item's `board_state` overrides the default: set `"impact"` only where the
cited text itself says the zone is burning / flooding, and `"none"` where a
zoned item is not a report of the hazard (a downed pole is not a fire). This is
the interpretive layer, like `zones`; it never changes what an item says.

## Pictograms, the warning chain and the board marks

Presentational fields, all optional. They may only **restate** what the item's
own cited text says, never add to it; the build checks every one, and where a
field carries a time or a direction it checks that the text states it in so
many words. The vocabulary is `src/app/control-room/vocabulary.json`, shared
by the UI and the validator.

```jsonc
// on an info item
"icon": "wea",            // slip pictogram, one of vocabulary.json `icons`:
                          //   siren wea downed-line roadblock shelter aircraft
                          //   boat dam river-gauge rain flood wind fire
                          //   contained hydrant committee press social satellite
                          //   (no natural icon → omit; the kind glyph stands alone)
"chain": [{               // warning-chain links this item shows
  "link": "phone",        //   forecast | siren | phone | broadcast | social
  "state": "cut",         //   used | cut | unused | pending  (forecast: used only)
  "at": "17:43",          //   optional; must appear verbatim in the item's text
  "zones": ["…"]          //   optional; a subset of the item's own zones
}],                       //   (default: the item's zones, or all zones)
"origin": "06:34",        // the record first places the hazard in this item's
                          //   ONE zone: an HH:MM the text states, or true
                          //   ("by this decision point"). One per zone.
"wind": { "from": "E" },  // compass point; the text must say "east winds"
"readings": [{            // an instrument reading, drawn on the slip
  "series": "poyo",       //   a key of the scenario's `instruments`
  "state": "surged",      //   one of vocabulary.json `readings`; the text must
                          //   say its phrase ("surged", "falling", "may fail"…)
  "at": "18:43",          //   optional; must appear verbatim in the text
  "by": true,             //   optional, with `at`: printed "by 18:43"
  "value": "1,686 m³/s"   //   optional, ≤ 16 chars; every number in it must
}]                        //   be one the text prints

// at scenario level: the instrument series, by short name (≤ 40 chars)
"instruments": { "poyo": "Rambla del Poyo · flow, as CHJ sent it" }

// at scenario level: short names for the chain diagram
"warning_chain": {
  "labels": { "forecast": "NWS Honolulu", "desk": "Maui EOC", "phone": "WEA", … },
                          // forecast/desk ≤ 18 chars; siren/phone/broadcast/social ≤ 11
  "zones": { "<at_risk zone id>": "Front St" }   // ≤ 14 chars
}
```

The build **fails** on an icon, link, state or label key outside the
vocabulary; an `at` or `origin` time the text does not state; chain `zones`
outside the item's zones; a cut/unused/pending forecast link; an origin on an
item with other than one zone, a second origin in a zone, or an origin on a
`board_state: "none"` item; a `wind` direction the text does not state as
"<direction> wind(s)"; an over-long label; a reading on an undeclared series,
in a state its text does not say, at a time its text does not state, or with
a number its text does not print; a series that runs backwards in time or
mixes timed and untimed readings (a timed series is drawn on a clock axis, an
untimed one in log order). Each gate has a fault-injection
case in `tests/scenarios-contract.test.mjs`.

The chain lights only from items the player has already been shown, the same
discipline as the board. A link the record has not mentioned stays a faint
hairline, meaning "not on the record yet", never "broken". Severed is drawn
only where a cited item says the channel was cut or not used.

### The headline (picture mode's lower third)

Picture mode (the Control Room's LOG · PICTURE switch) prints each slip as a
located beat on the board with one line under it: `HH:MM · <headline> [n]`.
The full text is one press away, and the screen reader always hears the
full text. The headline is the item's own words, never a summary:

```jsonc
"text": "Water is failing on the fire ground. At 16:10 a ladder company …",
"headline": "Water is failing on the fire ground."
```

**Required on every info item of a playable scenario.** The build **fails**
on a missing or empty headline; one that is not a contiguous fragment of the
item's own `text`, character for character (case and punctuation exact, so
no trimming a quote mark off one end and not the other, no capitalising a
mid-sentence start); one longer than 90 characters (vocabulary.json
`headline.max`); one with leading or trailing whitespace; and a "SOURCE
NEEDED" placeholder. Choose the strongest fragment as the text has it,
starting mid-sentence if need be. Each gate has a fault-injection case in
`tests/scenarios-contract.test.mjs`.

## Warnings that came before the clock

A scenario's clock is one day and cannot cross midnight, but some days' real
public warnings came earlier: Odisha's cyclone watch began four days before
the clock opens; New Orleans' voluntary evacuation was called the day before.
Forced onto the clock, `scoring.historical_first_public_alert` would then
present the day's first bulletin as the officials' lead time — flattering or
distorting it. The optional `alert_predates_clock` says so instead:

```jsonc
"alert_predates_clock": {
  "date": "2013-10-08",                // YYYY-MM-DD, before the scenario `date`
  "time": "21:30",                     // optional; an HH:MM the item states
  "from": "t1-i4",                     // the info item the note is drawn from
  "note": "IMD's Bhubaneswar warning centre issued cyclone watch bulletins from 8 October, …",
                                       // one sentence, 20–280 chars
  "clock_alert": "this day's first listed IMD bulletin",
                                       // what the day's HH:MM figure is (≤ 60 chars)
  "citation": { "sourceId": "imd-report", "detail": "Section 8.2 …" }
}
```

It is held to the takeaway discipline. The build **fails** it without a note, a
`clock_alert` or a citation; with a citation to a source not in `sources[]` or
to a different source from its `from` item; with a `from` that is no info item;
with a date on or after the scenario day, or one the item does not name (its
day and month, "8 October", or its weekday, "Saturday"); with a `time` the
item does not state; with a placeholder; or with a note that prints a number
the item does not print. When present, the debrief's lead-time line reads
"officials, on this clock only", a slip under the four scores states
how many days earlier the public warning came (computed from `date`) with the
cited note, and the reckoning's record lane gains a mark pointing off the
plate's left edge ("FROM 8 OCT · 4 DAYS EARLIER"). Used by
`odisha-phailin-2013` and `katrina-2005`.

## The reckoning (the debrief's centerpiece)

The debrief opens on three lanes on the day's clock — YOU, THE RECORD, THE
EARLIEST DEFENSIBLE — each measured in minutes to `scoring.impact.time`. Every
figure is arithmetic on a cited clock time already in the file, or a value an
option already carries (scope, zones, false-alarm weight). The panel never
prints lives saved or a simulated toll: the record is silent on paths not
taken, and the panel says so.

**`scoring.benchmark`** (required for a playable) is a GAME-DESIGN benchmark:
the earliest call this desk's own record could justify, a hypothesis and not a
verdict. It is an array of calls, at most one per at-risk zone:

```jsonc
"benchmark": [{
  "time": "12:20",          // a decision time on the clock
  "from": "t2-i1",          // the ONE slip the call rests on
  "option": "t2-a2",        // the option at that decision point it corresponds to
  "zones": ["poyo-horta-sud"],
  "basis": "At 12:20 the basin authority tells … has passed its alert threshold.",
  "citation": { "sourceId": "chj-record", "detail": "…" }
}]
```

The build refuses a call whose `time` is not a decision time, or is earlier
than the decision point where its slip reaches the desk (the desk cannot act
on information not yet on it); whose `basis` prints an HH:MM later than the
call, or any number the slip does not print, or a placeholder; whose `option`
is not at that decision point, issues no warning, or does not reach every zone
of the call; whose `zones` are not at-risk zones the slip itself concerns, or
are already claimed by another call; or whose citation is not the slip's own
source. A zone no call covers prints "no call set". The benchmark is set on
the day's clock only; where `alert_predates_clock` is present the panel says
the benchmark cannot see before the clock. Where the record's first warning is
at or before the benchmark (Phailin), the record's tile is printed in reverse
and stamped "Met the mark": the success case.

Authored benchmarks, and why:

| Scenario | Time | Slip | Basis |
|---|---|---|---|
| valencia-dana-2024 | 12:20 | t2-i1 (Poyo zone), t2-i2 (Magro zone) | CHJ: Poyo flow past its alert threshold; Utiel already under water. The 07:36 red warning is a forecast for the coastal north, and the game already prices a 07:36 province alert as a weak-signal call (false-alarm weight 1). |
| lahaina-2023 | 14:55 | t4-i2 (Lahainaluna) | Callers report the fire flaring up again, "spreading fast". No single slip places the afternoon fire on Front Street or Upcountry before impact, so those zones have no call. |
| katrina-2005 | 07:00 | t1-i1 (all zones) | NHC Special Advisory 22: Hurricane Warning including New Orleans, preparations "rushed to completion". The 56-hour finding is before this clock; the panel says so. |
| odisha-phailin-2013 | 06:30 | t1-i2 (all zones) | IMD's surge forecast for Ganjam, Khurda, Puri and Jagatsinghpur. The record's first alert on this clock equals it, and its warnings began four days earlier. |

**`scoring.minutes_matter`** (optional, 1–3) is cited context on why minutes
matter, from other places and days: verbatim `quote`, `about` (no figures of
its own), optional `caveat` (no number the quote does not print), `publisher`,
`license` (or that it is unconfirmed), `as_of` (YYYY-MM-DD read at source) and
a `citation` into `sources[]`. Only claims graded A in
`data/preparedness/essay-research.md` belong here. The UI frames the block as
"context, not a calculation" and never converts a run's minutes into lives.

## Lessons and terms (the debrief's takeaways, the briefing's glossary)

Two optional, cited fields carry the game's teaching. Both are held to the same
citation rule as everything else, and the build gates each one.

```jsonc
"takeaways": [{                        // 1–4; "What the record teaches"
  "text": "Activation is a decision, not a drift: … only at 16:30.",
                                       // ONE sentence, 20–280 chars, our words
  "from": { "finding": 1 },            // the cited line it is drawn from:
                                       //   an inquiry_findings index, or
                                       //   { "step": "t4" } — a historical_path entry
  "citation": { "sourceId": "fsri-p2", "detail": "Finding 49 …" }
}],
"glossary": [{                         // "Terms of the desk"
  "term": "Red Flag Warning",          // 1–48 chars, unique
  "match": ["Red Flag Warning"],       // spellings marked in the slips (whole
                                       //   word, case-sensitive; first use only)
  "kind": "verbatim" | "paraphrase",   // an official definition, quoted or
                                       //   tightly paraphrased — never from memory
  "definition": "A term used by fire-weather forecasters …",   // ≤ 320 chars
  "translation": "…",                  // optional; the project's translation
  "citation": { "sourceId": "nws-glossary", "detail": "Entry 'Red Flag Warning' …" }
}]
```

The build **fails** a takeaway that has no citation, cites a source not in
`sources[]`, names no line (or a finding / step that does not exist), cites a
different source from the line it is drawn from, or **prints a number the line
does not print** — a lesson may sharpen the record, never add to it. It fails a
glossary entry with no citation, an unknown source, no `kind`, a definition over
320 characters, a placeholder, or `match` spellings that appear in no slip (a
gloss must explain a word the player actually meets).

A takeaway is the project's reading, and the UI says so ("each in our words,
tied to the cited line it is drawn from"). A definition is added only when the
official page could be fetched and its wording checked: give the definition's
own source a full bibliographic label and say in its `note` that it is used only
for the glossary (and, where the current wording post-dates the day, why it
still applies). Terms left unglossed for want of a verified source: EOC,
ES-Alert, EAS (as of November 2026: the FEMA, FCC consumer-guide and Spanish
Interior Ministry pages refused automated fetches).

## Player telemetry (prototype: localStorage; later: backend)

`src/app/control-room/telemetry.ts` logs anonymously — no PII, no identifiers
beyond a random per-browser UUID:

```jsonc
{
  "v": 1,
  "player": "uuid",                    // crypto.randomUUID(), local only
  "sessions": [{
    "sessionId": "uuid",
    "scenarioId": "valencia-dana-2024",
    "startedAt": 1730000000000,        // epoch ms, real wall clock
    "completedAt": 1730000600000,
    "events": [{
      "timestepId": "t1",
      "optionId": "t1-a3",
      "presentedAt": 1730000010000,    // when options appeared
      "chosenAt": 1730000034000,       // when clicked
      "hesitationMs": 24000,
      "warningScope": "none",          // denormalised for aggregate queries
      "divergedFromHistory": false
    }],
    "score": { "leadTimeMinutes": -71, "coverage": 0.5, "falseAlarmWeight": 0, "divergence": 2 }
  }]
}
```

The intended backend is a single `POST /api/telemetry` accepting one completed
session object (same shape, minus `player`), written append-only. Aggregations
this schema supports: hesitation-time distributions per timestep,
over-/under-warning rate (warningScope chosen vs. signal level), and divergence
from the historical path per decision point.

## Terrain (the diorama's ground)

Each playable scenario ships real elevation: a 16-bit greyscale heightmap
`public/control-room/terrain/<scenario-id>.png` plus a meta
`<scenario-id>.json` (bbox, grid size, min/max elevation, metres per pixel,
decode formula, and the source's publisher, URL, attribution and retrieval
date). Lahaina has a second frame, `lahaina-2023-upcountry`, because West Maui
and Upcountry will not fit one frame at useful resolution. The elevation is
AWS Terrain Tiles (see `SOURCES.md`) resampled, never edited. Refresh with
`npm run build:terrain` (network, run by hand, commit the output; the raw
tile cache `data/terrain-raw/` is gitignored). Every playable scenario needs a
frame entry in `scripts/build-terrain.mjs`; the script (and `npm test`) fails
without one, so a scenario cannot ship without ground.
