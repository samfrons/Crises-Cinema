---
name: readme-screenshots
description: Refresh the public README's screenshots and headline stats for this Next.js site (Disasters by the Decade). Use this whenever the README's images look stale — after a redesign, a new page or section, a copy change to the hero/atlas/reel/methodology pages, or whenever the film count or decade count in src/data/summary.json has moved on since the images were last captured. Also use it any time someone asks to "update the README", "refresh the screenshots", "make the README look current", or "polish the README" for this repo. Drives the real dev server with Playwright and crops each shot to match what the README actually describes — don't hand-roll a one-off screenshot script when this one already exists and is wired to the site's actual anchors and selectors.
---

# README screenshots

The README embeds six JPEGs from `docs/screenshots/` and quotes a handful
of numbers (film count, year range, decade count, the four-group split) in
prose. Both go stale the same two ways: the site's content or layout
changes, or the underlying data is rebuilt with a different film count.
This skill refreshes both from the live app and the live data file, so the
README never quietly drifts from what a visitor actually sees.

## Why this exists as a script, not ad hoc Playwright calls

The six shots aren't arbitrary crops — each one is pinned to the specific
selector and scroll position that makes it match its README caption (the
decade chart at `#reel`, the film cards at `#explorer`, the atlas as a full
page because it has two distinct plates). Re-deriving those anchors from
scratch each time risks a shot that's technically "a screenshot of the
page" but not the section the caption promises. `scripts/capture-screenshots.cjs`
already encodes the right selector, wait condition, and crop for each one —
use it, and only touch the `SHOTS` list inside it when a page's structure
actually changes.

## Steps

1. **Install deps and start the dev server** (it runs the data pipeline
   first, so the site reflects whatever's currently in `public/`):

   ```bash
   npm install
   (nohup npm run dev > /tmp/nextdev.log 2>&1 &)
   timeout 90 bash -c 'until curl -sf http://localhost:3000 >/dev/null; do sleep 2; done'
   ```

   If the port is already bound from a previous run, free it first:
   `lsof -ti:3000 -sTCP:LISTEN | xargs -r kill`.

2. **Check the headline stats** before touching any prose, so you know
   whether the numbers actually moved:

   ```bash
   node .claude/skills/readme-screenshots/scripts/print-stats.mjs
   ```

   Compare its output against what `README.md` currently says (the "831
   films", "1898–2025", "14 decades", and the four group counts — "296
   films blame earth & sky", etc. — all appear in the opening paragraphs).
   Update any that changed. This script derives the group totals the same
   way `Hero.tsx` does — if a family's `group` ever changes in
   `src/lib/taxonomy.ts`, update the mirrored mapping at the top of
   `print-stats.mjs` too, or the two will silently disagree.

3. **Capture the screenshots.** `playwright` is a global install here, not
   a project dependency — `NODE_PATH` is what makes `require('playwright')`
   resolve:

   ```bash
   NODE_PATH=$(npm root -g) node .claude/skills/readme-screenshots/scripts/capture-screenshots.cjs
   ```

   This overwrites every file in `docs/screenshots/` in place. Chromium is
   preinstalled at `/opt/pw-browsers/chromium` — don't run `playwright
   install`, it isn't needed and may fail without network access.

4. **Look at what you captured** before trusting it — a selector that
   silently stopped matching produces a technically-valid screenshot of
   the wrong state (a loading skeleton, an empty chart). Read at least
   `home-hero.jpg`, `home-explorer.jpg`, and `atlas.jpg` back with the Read
   tool and eyeball them against their README captions. The script prints
   a `!` warning line for any shot whose `waitFor` selector never appeared
   — treat that as a hard signal something broke, not a shot to ship
   anyway.

5. **If a page was added, removed, or restructured** enough that none of
   the existing six shots covers it, add or edit an entry in the `SHOTS`
   array in `capture-screenshots.cjs` — pick a selector that only appears
   once the section has real content (not the page shell), matching the
   pattern already used for the existing entries — then add or update the
   corresponding `![...]` line and surrounding paragraph in `README.md`.

6. **Stop the dev server** once you're done:

   ```bash
   lsof -ti:3000 -sTCP:LISTEN | xargs -r kill
   ```

7. **Review the diff.** `git status` / `git diff --stat` should show
   updated files under `docs/screenshots/` and, if the numbers moved, a
   prose diff in `README.md`. A refresh where nothing actually changed is
   a legitimate outcome — don't force a commit just to show activity.

## Gotchas

- **`waitUntil: 'networkidle'` hangs on `/reel`** — it streams video from
  the Internet Archive, which never goes idle. The script uses `waitUntil:
  'load'` plus a selector wait instead; keep that pattern if you add shots
  on that page.
- **Client components paint in after hydration.** The explorer's film
  cards and the atlas map are client-side, so a shot taken right after
  `load` can catch an empty or partially-rendered state even though the
  selector already exists in the DOM. That's what the per-shot `settle`
  delay is for — extend it rather than removing it if a capture looks
  incomplete.
- **File size.** JPEG at quality 85 and 1.5x device scale keeps each shot
  around 200–300KB (full-page shots like the atlas run larger, ~500–600KB)
  — small enough to commit directly to the repo. Don't switch to PNG or
  raise the scale factor without a reason; it roughly triples file size
  for a difference GitHub's rendered width mostly hides anyway.
