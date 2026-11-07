# CLAUDE.md — Crises Cinema

## 1. WHAT THIS IS

Crises Cinema ("Disasters by the Decade", crisescinema.storytimemaps.com) is a
data-essay site: Next.js 14 App Router, TypeScript, plain CSS per route, deployed
on Vercel. Pages: the essay (`/`), Atlas of Ruin, Dispatches from the Ground,
Control Room (`/control-room`, a playable scenario game), The Last Mile
(`/preparedness`), First Reels, Catalogue, Methodology. The build is the gate:
`npm run lint-build` (lint, then build) must pass before anything ships.

## 2. DESIGN SYSTEM

- Tokens live on `:root` in `src/app/globals.css` (top block). Use them; do not
  add raw colours or fonts in route CSS.
  - Surfaces/ink: `--paper`, `--paper-lit`, `--paper-deep`, `--rule`, `--ink`,
    `--ink-soft`, `--ink-faint` (the faint ink is the AA floor for small labels).
  - Accent: `--ember` (one-sheet red). Interaction and accent ONLY.
  - Type: `--poster` (SF Hollywood Hills, display headings at large sizes only),
    `--read` (serif, all prose), `--data` (mono, every number, label, eyebrow and
    axis tick).
  - Layout: `--page` (1180px max width).
- `--ember` is never a data colour. Never use it to encode a category, a series
  or a threshold.
- Idiom: 1970s disaster-movie one-sheet and exhibitor's pressbook. Cream stock,
  condensed poster type, typewriter credit blocks, hard rules. No glossy gradients,
  no rounded-app chrome, no generic dashboard styling.
- Styling is per-route scoped CSS (e.g. `atlas.css`, `control-room.css`) built on
  the tokens. Tailwind is installed and its directives sit in globals.css, but
  utilities are unused by convention. Do not add Tailwind utility classes to TSX.
- Category colour: the 11-family CVD-safe palette in `src/lib/taxonomy.ts`
  (`FAMILIES`) is the ONLY category palette. Do not hand-pick colours for a family,
  group or series. Its fixed order sets colour assignment; do not reorder it.
- Every page:
  - `<a className="skip">` is the first focusable element.
  - A masthead: `kicker` (with the back link where relevant), `h1` with `l1` and
    `l2` spans, a `lede`, and `.rise` `.rise-1..4` stagger on the masthead blocks.
  - A self-documenting colophon in a `<footer>`: how the data was made, what it does
    not measure, and the shared `<Elsewhere current="/route" />` component
    (`src/app/components/Elsewhere.tsx`). Never hand-write a sibling-link list.
- Navigation: the programme strip (`SiteNav`) is rendered once in
  `src/app/layout.tsx`. Never add a per-page nav, header bar or tab strip.
- Motion: 150–350 ms for microinteractions (hover, press, toggles), CSS-only (no JS
  animation libraries for decoration). Page-entrance choreography (the `.rise`
  stagger, ~0.72 s) is the one sanctioned exception. Every
  animation needs a designed `prefers-reduced-motion` equivalent, not just
  `animation: none`.
- Accessibility: WCAG AA minimum. Tap targets at least 40px. No horizontal page
  scroll down to 320px wide.

## 3. DATA SOURCING (IRON RULES)

- Never invent, interpolate or approximate a figure. If a number is not in a
  committed source file, it does not appear on the page.
- Every displayed number traces to a committed source file.
- A source that cannot be fetched gets an honest `not_loaded` state with drop-in
  instructions for the site owner. Never fill it with synthetic, remembered or
  news-article numbers. The Sendai Target G and Loss & Damage Fund layers are
  the existing examples.
- Every layer and every figure shows publisher · licence · as-of in the UI.
  Check the layer's own `source.publisher` field rather than assuming the route.
- EM-DAT is CC BY-NC-ND (non-commercial, no derivatives). Its raw drop-in
  (`data/preparedness/raw/emdat.csv`) and the whole `data/preparedness/raw/`
  directory are gitignored. NEVER commit them, and never copy their contents
  into another committed file.
- Licences are verified on the page the data was fetched from, never assumed.
  Unconfirmed licences are stated as unconfirmed (ND-GAIN in SOURCES.md).
- Reference: `SOURCES.md`. `/preparedness` runbook: `data/preparedness/README.md`.

## 4. THE CONTROL ROOM CONTRACT

- Scenarios are `data/scenarios/*.json`, one per file, kebab-case id matching the
  filename. Schema and rules: `data/scenarios/README.md`.
- `scripts/build-scenarios.mjs` validates them and writes
  `src/data/scenarios.json`. It FAILS the build on:
  - an unsourced fact (any citation without a `sourceId` in `sources[]`);
  - a `SOURCE NEEDED` placeholder in a playable scenario;
  - a media attachment with a missing field, a placeholder licence, a non-http(s)
    URL, a missing file under `public/control-room/<scenario-id>/`, or an
    extension that does not match its type;
  - play-log imagery whose `takenOn` is after the scenario `date`
    (such imagery belongs in `debrief_media`).
- Stubs (`"status": "stub"`) may carry placeholders and are excluded from play.
  Playables may not.
- Record-is-silent: never write a consequence the record does not carry. Use
  `"known": false` (UI: "THE RECORD IS SILENT"). Never simulate a counterfactual
  as history. Scoring and option `effects` are game design, labelled as such.
- Media: PD or CC licence verified at the source page. Serve files byte-for-byte;
  no recompression, no image optimiser.
- Hazard vocabulary comes only from `src/app/control-room/hazards.ts`. A fire
  scenario never says "gauge alert" or "flooding".
- Board drawings: one per scenario id in `src/app/control-room/OpsMap.tsx`.

## 5. BUILD & DATA PIPELINES

- `npm run dev` / `npm run build`: run `build:data` first (`build-data.mjs`,
  `build-atlas.mjs`, `build-scenarios.mjs`), then Next.
- `npm run build:data` regenerates `src/data/summary.json`, `src/data/atlas.json`
  and `src/data/scenarios.json` (scenario validation runs here).
- `npm run build:scenarios` re-runs only the scenario validator and bundle.
- `npm run build:reel` regenerates `src/data/reel.json`.
- Network pipelines are run BY HAND and their output is committed. They are not
  part of `npm run build`:
  - `npm run build:dispatches` writes `src/data/dispatches.json`.
  - `npm run build:preparedness` runs the geometry script (do not touch
    `world.json`) then `build-preparedness.mjs`, which writes
    `public/data/preparedness/` and `src/data/preparedness-meta.json`.
- Any build can rewrite `src/data/{atlas,summary,scenarios}.json` with only a new
  timestamp. If a diff is timestamp-only, revert it (`git checkout -- <file>`).

## 6. TESTING

- `npm test` (node --test; fast; no network) must pass before any commit.
- `npm run build && npm run test:e2e` runs the browser smoke test.
- Any new validator gate in `scripts/build-scenarios.mjs` needs a fault-injection
  case in `tests/` that proves the gate fails the build on the bad input.
- UI changes: verify in headless Chromium (playwright-core,
  `executablePath: /opt/pw-browsers/chromium`) at 1280×900 AND 390×844 minimum.
  Look at the screenshots before claiming done.
- Servers: kill only your own server, by port or PID. NEVER bare `pkill
  next-server`; other agents share the machine. Beware a stale orphaned server
  serving an old build.

## 7. MULTI-AGENT ETIQUETTE

- Each agent owns a disjoint set of files; touch only your own.
- Subagents do not commit. The orchestrator commits.
- Two concurrent `next build` runs clobber `.next`. Coordinate, or retry once.
