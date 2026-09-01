# Sources

Every dataset behind Crises Cinema, where it comes from, what it's licensed
under, how current it is, and what it does and doesn't actually measure.
This file covers `/preparedness`'s data pipeline in full and the map
geometry it shares with `/atlas` and `/dispatches`; the film and Reddit
sourcing for those two pages is documented in their own build scripts
(`scripts/build-data.mjs`, `scripts/build-dispatches.mjs`).

For refresh steps, drop-in file instructions, and attribution requirements
specific to `/preparedness`, see `data/preparedness/README.md`. This file
is the reference table; that one is the runbook.

## Table

| Dataset | Publisher | License | As of | Retrieved |
|---|---|---|---|---|
| INFORM Risk | European Commission, Joint Research Centre (JRC) | CC BY 4.0 | 2025 reference year (INFORM Risk 2026 edition) | 2026-09-01 |
| ND-GAIN Country Index | University of Notre Dame (ND-GAIN) | See gain.nd.edu; not independently confirmed by automated fetch | 2024 (latest year with published data) | 2026-09-01 |
| EM-DAT | CRED / UCLouvain — via Our World in Data (processed mirror), automatic; or a registered export dropped in, taking priority when present | **CC BY-NC-ND** (non-commercial, no derivatives) | 2000–2025 | 2026-09-01 |
| IDMC GIDD (disaster displacement) | Internal Displacement Monitoring Centre — via HDX, automatic; or a dropped-in export, taking priority when present | CC BY-IGO | 2008–2025 | 2026-09-01 |
| WHO SPAR (IHR core capacities) | World Health Organization | CC BY-NC-SA 3.0 IGO | 2025 | 2026-09-01 |
| Sendai Framework Target G | UNDRR — Sendai Framework Monitor | Not yet determined | Not loaded — no open source exists anywhere this build could find (see below) | — |
| OCHA FTS (humanitarian appeals) | UN OCHA — Financial Tracking Service | CC BY (per FTS's stated terms; reverify before commercial reuse) | 2010–2026 | 2026-09-01 |
| Loss & Damage Fund (FRLD) pledges | Fund for responding to Loss and Damage | n/a (no feed exists) | Not loaded — no machine-readable feed exists anywhere this build could find (see below) | — |
| World Bank population (SP.POP.TOTL) | World Bank | CC BY 4.0 | 2023 (falls back to 2022/2021 per country if 2023 is missing) | 2026-09-01 |
| world-atlas countries-110m.json (Natural Earth admin-0, 1:110m) | Natural Earth, packaged as `world-atlas@2.0.2` | Public domain | — | 2026-08-31 |
| world-countries@5.1.0 (ISO numeric ↔ alpha-3 mapping) | Compiled from ISO 3166 sources | ODbL | — | 2026-08-31 |

## INFORM Risk

**What it is**: a composite disaster-risk index for ~190 countries,
combining roughly fifty indicators across three dimensions — Hazard &
Exposure, Vulnerability, and Lack of Coping Capacity — into one 0–10 score
per country, plus hazard-specific sub-scores for earthquake, flood
(river), tropical cyclone, drought, epidemic, and a combined
conflict/human-hazard figure.

**Known limitations**:
- It is a composite of many indicators combined by geometric mean under
  fixed, expert-assigned weights. The overall ranking is sensitive to
  those weighting choices, which INFORM's own methodology group revisits
  and can revise from one edition to the next — a country's rank can move
  for methodological reasons alone, not just because underlying conditions
  changed.
- Most component indicators (population estimates, GDP, WASH access,
  governance scores) are themselves modeled or survey-based estimates,
  often one to three years old at the time INFORM publishes — this is a
  lagging index, not a live one.
- The Hazard & Exposure sub-scores measure physical exposure (how many
  people live in a hazard-prone area), not the probability that a
  disaster strikes in any particular year. A high score means "many
  people are in harm's way," not "an event is imminent."
- "Lack of Coping Capacity" folds very different kinds of readiness
  (health infrastructure, road density, governance quality, disaster-risk
  institutions) into one number, which can mask which specific capacity is
  actually weak in a given country.

## ND-GAIN Country Index

**What it is**: a composite of Readiness (economic, governance, social
readiness to adapt) and Vulnerability (exposure, sensitivity, and adaptive
capacity to climate-related shocks specifically), combined into one
0–100 score per country.

**Known limitations**:
- Readiness correlates strongly with GDP per capita — wealthier countries
  score as "ready" substantially because they are wealthy, not because of
  disaster-specific preparedness investment. This is a widely-made
  criticism of the index: it can reward general economic development more
  than targeted resilience-building.
- The published index lags roughly two years behind the current date.
- Vulnerability and Readiness are themselves composites of dozens of
  proxy indicators (e.g. political stability standing in for governance
  capacity); the single overall score can obscure large country-to-country
  differences in which underlying proxy is actually driving it.

## EM-DAT

**What it is**: the standard reference database of disasters worldwide
since 1900 — deaths, people affected, and economic damage per event,
classified by disaster type and country.

**Loaded automatically**, via Our World in Data's open mirror of EM-DAT's
own per-country, per-hazard-type death counts (grapher slug
`deaths-from-natural-disasters-by-type`) — CRED gates bulk export behind a
free account, but licenses these processed columns to OWID, who republish
them with no registration wall and EM-DAT's own citation attached. This
route carries **deaths only**: OWID's processed columns don't include
affected-persons or damage totals. A registered EM-DAT export dropped in
at `data/preparedness/raw/emdat.csv` is read first and takes priority when
present, and carries the fuller figures — see `data/preparedness/README.md`
for that path.

**Known limitations**:
- Small and slow-onset disasters are systematically under-recorded,
  especially in lower-income and lower-capacity states where local
  reporting infrastructure is thinner. EM-DAT reflects what got reported
  and met its entry threshold, not every disaster that occurred.
- Economic damage figures are missing for most recorded events in EM-DAT's
  own full database — any total damage figure derived from a full EM-DAT
  export is a floor, not a true sum (moot for the automatic OWID route,
  which carries no damage figures to begin with).
- A minimum severity threshold (deaths, people affected, a declared
  emergency, or an international appeal) gates entry into the database at
  all — chronic, below-threshold hazard exposure never appears.
- The automatic route is a step removed from EM-DAT's raw record: Our
  World in Data's own reprocessing (unit handling, entity naming) sits
  between this figure and CRED's original data.
- The displayed `scale.max` is the highest deaths-per-100k score actually
  observed in this build's run, not a fixed ceiling — it moves release to
  release.
- **License is CC BY-NC-ND**: non-commercial use only, no derivative
  works — this governs the layer regardless of which route filled it. This
  is the strictest license of any source in this pipeline — see
  `data/preparedness/README.md` for what that means for this site
  specifically.

## IDMC — Global Internal Displacement Database (GIDD)

**What it is**: modeled estimates of new internal displacements caused by
disasters, by country, hazard type, and year.

**Loaded automatically**, via IDMC's own event-level disaster-displacement
export published openly on HDX (package
`idmc-internal-displacements-new-displacements-associated-with-disasters`)
— the live GIDD API (`helix-tools-api.idmcdb.org`) still requires a client
key this build doesn't have, but the HDX copy is the same underlying data,
genuinely disaggregated by hazard type per event, with no key needed. A
dropped-in export at `data/preparedness/raw/idmc-gidd.csv` is read first
and takes priority when present — see `data/preparedness/README.md`.

**Known limitations**:
- These are modeled estimates built from media, government, and cluster
  reports of varying quality and completeness by country — not a census.
- The figures are a **flow** (new displacements during a year), not a
  **stock** (how many people remain displaced). Someone displaced twice by
  two different events in one year is counted twice; the data says nothing
  about ongoing displacement duration.
- Small-scale or slow-onset displacement (e.g. gradual drought-driven
  movement) is under-captured relative to sudden, visible events like
  storms and earthquakes, which are easier to observe and report.
- This layer is disaster displacement only — IDMC also tracks conflict
  displacement, but the HDX export behind this layer is disaster-events
  only and carries no conflict figure to show alongside it.
- IDMC revises past years as better information becomes available, and
  HDX's own last-modified date on this resource moves accordingly — a
  rerun of this build months from now can change earlier years' totals,
  not just add new ones.
- The displayed `scale.max` is the highest total actually observed in this
  build's run, not a fixed ceiling.

## WHO SPAR (States Parties Self-Assessment Annual Reporting)

**What it is**: each WHO member state's self-reported score, 0–100,
against the 15 core capacities required under the International Health
Regulations (2005) — the world's standing framework for detecting and
responding to public health emergencies.

**Known limitations**:
- Every score is **self-reported by the country's own government**, with
  no independent audit. This is the single most important caveat on this
  layer.
- **The COVID-19 lesson**: SPAR (and the closely related Global Health
  Security Index) were the leading pre-pandemic pandemic-preparedness
  self-assessments. Multiple post-hoc analyses found that pre-2020 scores
  on these indices did not reliably predict COVID-19 outcomes — several
  countries that scored among the most "prepared" went on to record some
  of the worst outcomes of the pandemic, a mismatch widely cited (in
  public-health literature and press coverage alike) as evidence that
  self-assessed capacity on paper does not equal demonstrated
  performance in a real emergency.
- This is an epidemic/health-emergency-specific capacity measure — it has
  no earthquake, flood, storm, or other natural-hazard dimension. Treat it
  as one input, not a general disaster-preparedness score.
- Reporting is patchy: a country absent from a given year's data has not
  necessarily lost capacity — it may simply not have submitted that year's
  self-assessment.

## Sendai Framework Target G (multi-hazard early warning coverage)

**What it is**: intended to be each country's reported coverage by a
multi-hazard early warning system (MHEWS), one of the seven global targets
of the Sendai Framework for Disaster Risk Reduction 2015–2030.

**Not loaded in this build** — checked twice now, from three different
angles, and genuinely unavailable each time:
- The UN SDG indicator API (`unstats.un.org/sdgapi`) was the working
  hypothesis for where this would surface, since several Sendai targets
  are mirrored as SDG indicators. It isn't: the SDG framework tracks
  Sendai **Target E** (national/local disaster-risk-reduction strategies,
  series `SG_DSR_*`) but has no MHEWS-coverage series at all. Confirmed by
  fetching the SDG API's complete series list (cached at
  `data/preparedness/raw/sdg-series-list.json`) and searching it — every
  `SG_*`, `EN_*`, and `VC_*` series was checked, plus a text search for
  "warning" / "EWS" / "MHEWS" / "multi-hazard" — no early-warning entry
  anywhere in it.
- `sendaimonitor.undrr.org`'s own dashboard API was probed directly.
  Guessed REST paths return HTTP 403 behind a Cloudflare Managed
  Challenge; its one real endpoint found, `/api/dashboard`, returns HTTP
  401 (it needs a session login this build doesn't have). Response cached
  at `data/preparedness/raw/sendai-challenge-page.html`.
- HDX (`data.humdata.org`) carries no UNDRR or Sendai Target G / early-
  warning dataset either.

See `data/preparedness/README.md` for the manual export path, ready for
whenever one of these opens up.

**Known limitations** (documented even while stubbed):
- Reported by national disaster management authorities with no
  independent audit.
- Coverage is reported close to binary (covered / not covered) in most
  editions, erasing large differences in how many hazards a system
  actually covers, how much lead time it gives, and what share of the
  population it actually reaches.
- Reporting is voluntary and incomplete; a missing country means "not
  reported," not "zero coverage."

## OCHA FTS (humanitarian funding appeals)

**What it is**: for each year 2010–2026, the sum of UN-coordinated
humanitarian response plans' revised funding requirements, and the sum of
funding actually reported against those plans, worldwide.

**Known limitations**:
- Funding figures are reported voluntarily by donors and recipient
  agencies, not independently audited by OCHA.
- The same dollar can be reported more than once as it passes through
  multiple agencies before reaching its final recipient — a
  widely-acknowledged double-counting risk in flow-tracking data of this
  kind. Coverage (funded ÷ required) occasionally exceeds 100% in this
  series as a visible symptom, most notably in its earliest years.
- A plan's "requirement" is the humanitarian system's own funding ask,
  revised over the course of the year — a planning figure, not an
  independently estimated measure of true need.
- Only spending inside the tracked UN-coordinated appeal system is
  captured; a large share of total global humanitarian spending happens
  entirely outside a tracked plan and is invisible to this series.

## Loss and Damage Fund (FRLD) pledges

**What it is**: intended to be a running total of pledges to the Fund for
responding to Loss and Damage, established at COP27/28 to help vulnerable
countries recover from climate-driven disaster impacts.

**Not loaded in this build** — no machine-readable pledge feed exists, and
every plausible page was actually fetched and checked, not just assumed
unreachable:
- `unfccc.int/loss-and-damage-fund` sits behind Imperva/Incapsula bot
  protection — its HTTP 200 response is a small JavaScript-redirect/
  challenge shell with no page content (cached at
  `data/preparedness/raw/frld-unfccc-page.html`).
- `frld.org` sits behind a Cloudflare Managed Challenge (HTTP 403, cached
  at `data/preparedness/raw/frld-frld-page.html`).
- `fund.frld.org` is rejected outright by this build environment's egress
  proxy before a request reaches the site.

UNFCCC and the fund's own site publish pledge totals in prose (press
releases, COP outcome documents) when reachable at all, not a structured
API or downloadable dataset, and this pipeline does not hand-enter figures
from memory or news coverage — see `data/preparedness/README.md` for how
the site owner can compile a sourced, citable drop-in file.

## World Bank population (SP.POP.TOTL)

**What it is**: total population per country, used solely to normalize
EM-DAT's death totals (from either the automatic OWID mirror or a
registered drop-in export) to a per-100,000-population rate. Cached
regardless of which EM-DAT route is active, so a manual drop-in export
still works without a separate network fetch.

**Known limitations**: national statistical offices vary widely in census
recency and methodology; the World Bank's own figure is itself often an
interpolation between census years for countries that do not conduct
regular censuses.

## Map geometry (world-atlas / Natural Earth, world-countries)

**What it is**: `public/data/preparedness/world.json` — one SVG path per
country, built by `scripts/build-preparedness-geometry.mjs` (a separate,
already-built script; unrelated to and untouched by
`scripts/build-preparedness.mjs`) from `world-atlas@2.0.2`'s
`countries-110m.json` (Natural Earth 1:110m admin-0 boundaries, decoded by
hand from TopoJSON) and `world-countries@5.1.0` (ISO numeric ↔ alpha-3
code mapping).

**Known limitations**: 1:110m is a coarse simplification appropriate for a
world-scale choropleth, not for anything requiring precise borders;
several small island states and disputed territories are either merged
into a neighbor or absent entirely at this resolution. Antarctica is
deliberately dropped (it carries no index scores from any source in this
pipeline and would otherwise waste a fifth of the map's frame).
