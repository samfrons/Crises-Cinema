# /preparedness data pipeline

`npm run build:preparedness` runs `scripts/build-preparedness-geometry.mjs`
(the world map, already built — do not touch) and then
`scripts/build-preparedness.mjs`, which writes the layer files under
`public/data/preparedness/` and the headline summary at
`src/data/preparedness-meta.json`.

It is network-heavy and, like `build:dispatches`, is **not** part of
`npm run build` — it's run by hand and its output is committed. Rerun it
whenever a source publishes a new edition, or after dropping in one of the
files described below.

Every raw response the script fetches is cached under `data/preparedness/raw/`
so a rerun is instant and a reviewer can see exactly what each API handed
back. Delete a file in that directory to force that one fetch to happen
again; delete the whole directory for a fully cold rebuild.

## What's loaded automatically, what's still stubbed

Six of the seven layers (plus funding) now load real data with zero manual
steps. Each layer's `source.publisher` in its own JSON file always says
exactly which route supplied it — check that field rather than assuming.

| Layer | Status | Route |
|---|---|---|
| **INFORM Risk** | Loaded | EC JRC's own API — fully open. |
| **ND-GAIN** | Loaded | Public zip on gain.nd.edu — needs a browser `User-Agent` (a bare `curl`/`fetch` UA gets a 403); the script sends one. |
| **EM-DAT** | Loaded, via a mirror | Our World in Data republishes CRED/EM-DAT's per-country, per-hazard-type death series openly (`deaths-from-natural-disasters-by-type`). A **registered EM-DAT export** dropped in at `data/preparedness/raw/emdat.csv` still takes priority when present — it carries affected-persons and damage figures the OWID mirror does not. |
| **IDMC GIDD** | Loaded, via HDX | The live GIDD API still needs a client key this build doesn't have, but IDMC republishes its own event-level disaster-displacement table openly on HDX — same data, no key needed. A dropped-in `data/preparedness/raw/idmc-gidd.csv` still takes priority when present. |
| **WHO SPAR** | Loaded | WHO's GHO OData API — fully open. |
| **OCHA FTS (funding.json → appeals)** | Loaded | Reachable at `api.hpc.tools` (the `api.fts.unocha.org` alias is blocked from this build environment's network). |
| **Sendai Framework Target G** | **Stub** | No open source exists anywhere this script could find — see below; this one is a genuine dead end, not a laziness stub. |
| **Loss & Damage Fund pledges (funding.json → lossAndDamage)** | **Stub** | No machine-readable pledge feed exists anywhere this script could find — see below. |

### EM-DAT — automatic via OWID, or drop in `data/preparedness/raw/emdat.csv` for the canonical export

The automatic path (`buildEmdatFromOwid` in `scripts/build-preparedness.mjs`)
pulls Our World in Data's `deaths-from-natural-disasters-by-type` grapher
CSV, which is EM-DAT's own death counts, per country and per hazard type,
reprocessed and republished by OWID under an open mirror — no registration
wall, and it's real EM-DAT provenance (the CSV's own citation reads "EM-DAT,
CRED / UCLouvain"). It only carries **deaths** — OWID's processed columns
don't include affected-persons or damage totals, so this layer's
`components` are thinner than the fuller registered-export path below.

For the canonical, fuller figures (deaths, affected, damage):

1. Register a free account at <https://public.emdat.be>.
2. Run a query for all disaster types, 2000 → present, and export.
3. If the export is `.xlsx`, convert it to CSV yourself (e.g. "Save As
   CSV" in a spreadsheet app) — the loader reads CSV only, on purpose, to
   keep this script free of an xlsx-parsing dependency.
4. Save the result as `data/preparedness/raw/emdat.csv`, keeping EM-DAT's
   own column headers (`ISO`, `Start Year`, `Disaster Type`, `Total Deaths`,
   `Total Affected`, `Total Damage, Adjusted ('000 US$)` — a couple of
   older/newer header spellings are also recognized; see
   `buildEmdatFromDropIn()` in `scripts/build-preparedness.mjs`).
5. `npm run build:preparedness` — a file at that path is always read first
   and takes priority over the OWID mirror automatically.

**EM-DAT's license is CC BY-NC-ND — non-commercial, no derivative works.**
This governs the layer regardless of which of the two routes above filled
it (the OWID mirror is still, at root, EM-DAT's data). It is the strictest
license among every source this pipeline touches:

- **Non-commercial**: this data (or anything built from it) must not be
  sold or used to sell anything.
- **No derivatives**: don't republish a reworked or recombined version of
  EM-DAT's own figures as if it were a new dataset. The per-100k-population
  normalization this script does *is* a transformation — the layer file
  presents it clearly labeled as EM-DAT's own totals run through a stated,
  documented formula (deaths ÷ population × 100,000), not as an
  independent statistic, which is the intent of "no derivatives" as CRED
  themselves describe acceptable reuse. If in doubt, ask CRED
  (<https://www.emdat.be/contact>) before using this layer commercially or
  redistributing a reworked version of it.
- Always attribute: "CRED / UCLouvain, EM-DAT: The International Disaster
  Database, www.emdat.be" alongside anything shown from this layer (add
  "via Our World in Data" when the layer's own `source.publisher` says so).

### IDMC GIDD — automatic via HDX, or drop in `data/preparedness/raw/idmc-gidd.csv`

The automatic path (`buildIdmcFromHdx()`) pulls IDMC's own event-level
disaster-displacement table from HDX (package
`idmc-internal-displacements-new-displacements-associated-with-disasters`,
found via HDX's `package_search`) — one row per disaster event with its own
ISO3, year, hazard type, and new-displacement count, licensed CC BY-IGO.
This is genuinely hazard-disaggregated, better than the aggregate the
project's original brief expected to find.

If HDX ever renames or moves that package, either:

- Request an API client key at <https://www.internal-displacement.org>
  (Data → API access) and wire it into `buildIdmc()` in
  `scripts/build-preparedness.mjs`, or
- Re-search <https://data.humdata.org> for the current package id and
  update `IDMC_HDX_PACKAGE` in `scripts/build-preparedness.mjs`, or
- Download a displacement export by hand and save it as
  `data/preparedness/raw/idmc-gidd.csv` with at minimum columns `ISO3`,
  `Year`, `Hazard Category`, `Disaster Internal Displacements` — this file
  is always read first and takes priority over the HDX pull when present.

Then `npm run build:preparedness`. This layer is disaster displacement
only — IDMC's HDX disaster-events table has no conflict-displacement figure
to show as a comparison component (see the layer's own `limitations`).

### Sendai Framework Target G — genuinely unavailable; drop-in path documented for whenever that changes

This is the one layer this pass could not fill from any open source, and
not for lack of trying. Evidence gathered directly by the script (see
`buildSendai()` and the console output of a fresh run):

- The UN SDG API's full series list (`unstats.un.org/sdgapi`,
  cached at `data/preparedness/raw/sdg-series-list.json`) carries **no**
  multi-hazard early-warning series under any code — checked against every
  `SG_*`, `EN_*`, and `VC_*` series in the list, plus a text search for
  "warning" / "EWS" / "MHEWS" / "multi-hazard". The SDG framework mirrors
  Sendai **Target E** (national DRR strategies, series `SG_DSR_*`) but has
  nothing for Target G.
- `sendaimonitor.undrr.org`'s dashboard API is not reachable by script:
  guessed REST paths return HTTP 403 behind a Cloudflare Managed
  Challenge, and its one real endpoint found, `/api/dashboard`, returns
  HTTP 401 (session auth required) — cached as evidence at
  `data/preparedness/raw/sendai-challenge-page.html`.
- HDX carries no UNDRR/Sendai Target G or early-warning dataset either.

To load it once a source exists: export Target G country data from
<https://sendaimonitor.undrr.org> in a browser (Data → Target G), save it
as `data/preparedness/raw/sendai-target-g.csv` with at least columns
`iso3,score`, and add a small parser to `buildSendai()` in
`scripts/build-preparedness.mjs` (the stub's shape is already correct —
score 0–1, higher is better).

### Loss & Damage Fund pledges — genuinely unavailable; drop-in path documented for whenever that changes

Also not for lack of trying. Every run fetches and caches both of the
pages that might plausibly carry a stated pledge total:

- `unfccc.int/loss-and-damage-fund` sits behind Imperva/Incapsula bot
  protection — its 200 response is a small JavaScript-redirect/challenge
  shell with no page content (cached at
  `data/preparedness/raw/frld-unfccc-page.html`).
- `frld.org` sits behind a Cloudflare Managed Challenge, HTTP 403 (cached
  at `data/preparedness/raw/frld-frld-page.html`).
- `fund.frld.org` is rejected outright by this build environment's egress
  proxy before a request even reaches the site.

None of the three hands back HTML with a parseable pledge figure in it.
This script will not hand-enter a number from memory or a news article —
compile a sourced CSV yourself:

```csv
contributor,pledgedUsd,announcedDate,sourceUrl
Germany,100000000,2023-11-30,https://unfccc.int/...
```

Save as `data/preparedness/raw/frld-pledges.csv`, then
`npm run build:preparedness`. Note in the output that pledged ≠ disbursed —
see the layer's own `limitations`.

## Notes on specific sources

- **INFORM Risk's "latest" workflow isn't always usable.** The API's
  workflow-group listing includes workflows years in advance that the JRC
  hasn't actually populated yet (`FlagDataSaved` stays `null`). The script
  only considers workflows the API itself marks data-saved, and picks the
  most recent of those by reference year — see `pickInformWorkflow()`.
- **INFORM's "Lack of Coping Capacity" component** (`CC` in their process
  tree) is carried through unchanged as `components["Lack of Coping
  Capacity"]` on every country. This is the number the /preparedness page's
  "future" composite metric uses — it is INFORM's own dimension score, not
  a page-specific invention.
- **INFORM hazard mapping**: `earthquake`→`HA.NAT.EQ`, `flood`→`HA.NAT.FL`
  (river flood), `storm`→`HA.NAT.TC` (tropical cyclone), `drought`→
  `HA.NAT.DR`, `epidemic`→`HA.NAT.EPI`, `conflict`→`HA.HUM` (their whole
  Human Hazard branch — conflict probability + current UCDP intensity —
  not conflict alone). **Tsunami is dropped**: INFORM carries it
  (`HA.NAT.TS`) as a sibling of earthquake in their own tree, not a
  sub-component of it, so it is not folded into `earthquake` and simply
  isn't represented on this page.
- **ND-GAIN needs a browser User-Agent.** `gain.nd.edu` 403s a bare
  `fetch`/`curl` User-Agent; the script sends a real browser UA string.
  If gain.nd.edu changes its zip filename convention or moves the download
  page, the regex in `buildNdgain()` that finds the zip link will need
  updating — the fallback stub's instructions cover the manual path.
- **ND-GAIN's own readiness/vulnerability CSVs are 0–1** while the
  composite score is 0–100; the script multiplies the two components by
  100 so every number in `ndgain.json` reads on one consistent unit.
- **EM-DAT/OWID hazard mapping**: `earthquake`→`total_dead_earthquake_yearly`,
  `flood`→`total_dead_flood_yearly`, `storm`→`total_dead_extreme_weather_yearly`
  (OWID's own column title for this is "Deaths - Storms"), `wildfire`→
  `total_dead_wildfire_yearly`, `drought`→`total_dead_drought_yearly`.
  OWID also carries volcanic activity, landslide, extreme temperature, and
  a mixed/other bucket with no canonical hazard key here — dropped rather
  than stretched onto the wrong hazard, same treatment as INFORM's tsunami.
- **IDMC/HDX hazard mapping**: exact matches on `Earthquake`, `Flood`,
  `Storm`, `Wildfire`, `Drought` from the `hazard_type_name` column. The
  source data also carries Volcanic activity, Mass Movement, Extreme
  Temperature, Erosion, Wave action, Sea level Rise, and Mixed disasters —
  dropped, not stretched, for the same reason.
- **`scale.max` on the open-ended layers (EM-DAT, IDMC)** is always the
  actual highest score observed in that run, not a fixed ceiling — it will
  shift release to release as new data arrives. This is called out in each
  layer's own `limitations` array too, not just here.
- **OCHA FTS funding.json is two calls per year**: `plan/year/{y}` for
  each plan's own revised requirement, and `fts/flow?year={y}&groupby=plan`
  for what was actually funded against each plan (`report2`,
  `destination:Plan`) — FTS does not expose both numbers from one endpoint.
- **WHO SPAR** pulls the newest year (2025 as of this build) that returns
  country rows from GHO indicator `SDGIHR2021`, filtered to
  `SpatialDimType eq 'COUNTRY'`; both the overall average
  (`IHRSPARINDICATORSCORE_TOTL`) and the 15 second-edition capacity scores
  (`IHRSPARINDICATORSCORE_C01`…`C15`) come from that one filtered pull.

## Attribution summary (see also `SOURCES.md` at the repo root)

| Source | License | Attribute as |
|---|---|---|
| INFORM Risk | CC BY 4.0 | European Commission, Joint Research Centre — INFORM |
| ND-GAIN | See `gain.nd.edu`; not independently confirmed by this build | University of Notre Dame — ND-GAIN Country Index |
| EM-DAT (via OWID mirror, automatic) | **CC BY-NC-ND** (non-commercial, no derivatives) | CRED / UCLouvain, EM-DAT — www.emdat.be, via Our World in Data |
| EM-DAT (registered export, drop-in) | **CC BY-NC-ND** (non-commercial, no derivatives) | CRED / UCLouvain, EM-DAT — www.emdat.be |
| IDMC GIDD (via HDX, automatic) | CC BY-IGO | Internal Displacement Monitoring Centre (IDMC) |
| WHO SPAR | CC BY-NC-SA 3.0 IGO | World Health Organization — SPAR/IHR Monitoring |
| Sendai Target G | Not yet determined (stub — no source found) | UNDRR — Sendai Framework Monitor |
| OCHA FTS | CC BY (per FTS's stated terms — reverify before commercial reuse) | UN OCHA — Financial Tracking Service |
| World Bank population | CC BY 4.0 | World Bank — SP.POP.TOTL |
| world-atlas / Natural Earth, world-countries | Public domain / ODbL — see `SOURCES.md` | (geometry build; unrelated script, untouched by this one) |
