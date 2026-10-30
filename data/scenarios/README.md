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
  "hazard": "flash flood | dam failure | tropical cyclone | …",
  "clock": { "timezone": "CET", "start": "07:36", "end": "20:11" },
  "record_caveat": "…",                // honest note on the state of the record

  "timesteps": [{
    "id": "t1",
    "time": "07:36",                   // HH:MM on the scenario clock, for ordering
    "time_label": "07:36",             // what the player sees ("early afternoon" ok)
    "approx": false,                   // true when the source gives no exact time
    "info_available": [{               // ONLY what officials had at this moment
      "id": "t1-i1",
      "kind": "forecast | gauge | message | media | field_report",
      "text": "…",
      "citation": { "sourceId": "aemet-2024", "detail": "…" }
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

  "outcome": {
    "deaths": { "min": 227, "max": 229, "contested": true, "note": "…" },
    "citation": { … }
  },

  "scoring": {                         // interpretive layer — labelled so in UI
    "impact": { "time": "19:00", "label": "…", "citation": { … } },
    "at_risk_zones": [{ "id": "poyo-horta-sud", "label": "…" }],
    "historical_first_public_alert": "20:11"
  },

  "sources": [{
    "id": "aemet-2024",
    "label": "full bibliographic description",
    "url": null,                       // never invent URLs; add real ones later
    "note": "…"
  }]
}
```

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
