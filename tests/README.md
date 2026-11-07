# Tests

Zero-dependency (`node --test`, plain .mjs, no network). Run `npm test`: finishes in about a second.

- `scenarios-contract.test.mjs` guards the Control Room sourcing gates: runs `scripts/build-scenarios.mjs`
  on temp copies of the real data with injected faults (uncited fact, missing media file, late-dated
  imagery in the play log, out-of-order timesteps, placeholder licence, ...) and expects the right rejection.
- `data-integrity.test.mjs` guards the committed preparedness JSON: layers parse, scales/scores in range,
  manifest statuses match, world.json geometry, funding coverage = funded/required.
- `analysis.test.mjs` guards the essay's reproducibility claim: `scripts/essay-analysis.mjs` exits 0 and
  prints every section with its N=.
- `taxonomy.test.mjs` guards the film-family classifier and palette (`scripts/taxonomy.mjs`, plus the TS mirror's ids/colors).
- `e2e-smoke.mjs` is NOT part of `npm test`: `npm run build && npm run test:e2e` boots `next start` on :3126, loads
  `/`, `/preparedness`, `/control-room` at 1280 and 390 px (no console errors, no horizontal scroll, one
  `aria-current`) and plays three Lahaina decisions. Override with `PW_MODULE_DIR`, `CHROMIUM_PATH`, `PORT`.

Rule: every new data gate added to `scripts/build-scenarios.mjs` gets a fault-injection case in `scenarios-contract.test.mjs`.
Known data quirks (IDMC `AB9`, Russia's antimeridian centroid) are allowlisted with reasons in `data-integrity.test.mjs`.
