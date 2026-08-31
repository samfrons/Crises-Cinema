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

## What's loaded automatically, what needs a drop-in file

| Layer | Status | Why |
|---|---|---|
| **INFORM Risk** | Loaded | EC JRC's API is fully open. |
| **ND-GAIN** | Loaded | Public zip on gain.nd.edu, but only answers requests carrying a browser `User-Agent` — a bare `curl`/`fetch` UA gets a 403. |
| **WHO SPAR** | Loaded | WHO's GHO OData API is fully open. |
| **OCHA FTS (funding.json → appeals)** | Loaded | Reachable at `api.hpc.tools` (the `api.fts.unocha.org` alias is blocked from this build environment's network). |
| **EM-DAT** | **Stub** — needs a drop-in file | Registration-gated at emdat.be; this script does not scrape it. |
| **IDMC GIDD** | **Stub** — needs a drop-in file or API key | `helix-tools-api.idmcdb.org` requires a client key this build doesn't have. |
| **Sendai Framework Target G** | **Stub** — needs a drop-in file | No open bulk API exists for it (see below). |
| **Loss & Damage Fund pledges (funding.json → lossAndDamage)** | **Stub** — needs a drop-in file | No machine-readable pledge feed exists; UNFCCC/FRLD publish pledge totals as prose. |

### EM-DAT — `data/preparedness/raw/emdat.csv`

1. Register a free account at <https://public.emdat.be>.
2. Run a query for all disaster types, 2000 → present, and export.
3. If the export is `.xlsx`, convert it to CSV yourself (e.g. "Save As
   CSV" in a spreadsheet app) — the loader reads CSV only, on purpose, to
   keep this script free of an xlsx-parsing dependency.
4. Save the result as `data/preparedness/raw/emdat.csv`, keeping EM-DAT's
   own column headers (`ISO`, `Start Year`, `Disaster Type`, `Total Deaths`,
   `Total Affected`, `Total Damage, Adjusted ('000 US$)` — a couple of
   older/newer header spellings are also recognized; see `buildEmdat()` in
   `scripts/build-preparedness.mjs`).
5. `npm run build:preparedness`.

**EM-DAT's license is CC BY-NC-ND — non-commercial, no derivative works.**
That is the strictest license among every source this pipeline touches:

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
  Database, www.emdat.be" alongside anything shown from this layer.

### IDMC GIDD — `data/preparedness/raw/idmc-gidd.csv`

Either:

- Request an API client key at <https://www.internal-displacement.org>
  (Data → API access) and wire it into `buildIdmc()` in
  `scripts/build-preparedness.mjs`, or
- Download the disaster displacement dataset from
  <https://www.internal-displacement.org/database/displacement-data>. Their
  export is Excel by default — convert to CSV — and save it as
  `data/preparedness/raw/idmc-gidd.csv` with at minimum columns `ISO3`,
  `Year`, `Hazard Category`, `Disaster Internal Displacements`.

Then `npm run build:preparedness`. License: CC BY — attribute IDMC.

### Sendai Framework Target G — `data/preparedness/raw/sendai-target-g.csv`

The brief's working hypothesis was that Target G ("multi-hazard early
warning system coverage") would surface as a UN SDG indicator series. It
does not: the official SDG framework tracks Sendai **Target E** (national
DRR strategies, series `SG_DSR_*`) but carries no MHEWS series at all —
confirmed here by fetching the SDG API's full series list
(`data/preparedness/raw/sdg-series-list.json`) and searching it for
"warning" and related terms. Target G is monitored only through the
Sendai Framework Monitor itself, which has no open bulk API.

To load it: export Target G country data from
<https://sendaimonitor.undrr.org> (Data → Target G), save it as
`data/preparedness/raw/sendai-target-g.csv` with at least columns
`iso3,score`, and add a small parser to `buildSendai()` in
`scripts/build-preparedness.mjs` (the stub's shape is already correct —
score 0–1, higher is better).

### Loss & Damage Fund pledges — `data/preparedness/raw/frld-pledges.csv`

There is no structured pledge feed for the Fund for responding to Loss and
Damage (FRLD); UNFCCC and fund.frld.org publish pledge totals in prose and
press releases. This script will not hand-enter figures from memory or
from a press article — compile them yourself with a citation per row:

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
  sub-component of it, so per the brief it is not folded into `earthquake`
  and simply isn't represented on this page.
- **ND-GAIN needs a browser User-Agent.** `gain.nd.edu` 403s a bare
  `fetch`/`curl` User-Agent; the script sends a real browser UA string.
  If gain.nd.edu changes its zip filename convention or moves the download
  page, the regex in `buildNdgain()` that finds the zip link will need
  updating — the fallback stub's instructions cover the manual path.
- **ND-GAIN's own readiness/vulnerability CSVs are 0–1** while the
  composite score is 0–100; the script multiplies the two components by
  100 so every number in `ndgain.json` reads on one consistent unit.
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
| EM-DAT | **CC BY-NC-ND** (non-commercial, no derivatives) | CRED / UCLouvain, EM-DAT — www.emdat.be |
| IDMC GIDD | CC BY | Internal Displacement Monitoring Centre (IDMC) |
| WHO SPAR | CC BY-NC-SA 3.0 IGO | World Health Organization — SPAR/IHR Monitoring |
| Sendai Target G | Not yet determined (stub) | UNDRR — Sendai Framework Monitor |
| OCHA FTS | CC BY (per FTS's stated terms — reverify before commercial reuse) | UN OCHA — Financial Tracking Service |
| World Bank population | CC BY 4.0 | World Bank — SP.POP.TOTL |
| world-atlas / Natural Earth, world-countries | Public domain / ODbL — see `SOURCES.md` | (geometry build; unrelated script, untouched by this one) |
