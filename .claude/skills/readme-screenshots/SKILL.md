---
name: readme-screenshots
description: Capture real, current screenshots of a running app and wire them into that project's public README.md, for any project — not just one repo. Use this whenever asked to write a "polished public README," add screenshots to a README that has none, refresh a README whose images or stats have gone stale (after a redesign, a new page, or a data/feature change), or any request phrased as "make the README look professional / public-facing," "update the README screenshots," or "the README looks outdated." Bundles a reusable Playwright capture engine (`scripts/capture-screenshots.cjs`) driven by a shots config you write fresh for each project — don't hand-roll a one-off screenshot script when this engine already exists; do the per-project discovery this skill describes instead.
---

# README screenshots

A README with real screenshots earns trust a wall of text can't — but a
screenshot is only as good as its accuracy: the wrong page, a loading
skeleton caught mid-render, or a stat in the prose next to it that's since
drifted. This skill is a repeatable way to get both right: discover what a
README should show, capture it properly from the actual running app, and
keep the surrounding prose honest.

The mechanical part (launch a browser, wait for real content, crop,
compress, save) is the same on every project, so it's a bundled script. The
part that differs by project — which pages matter, what selector proves a
page has actually rendered, what numbers the README quotes — has to be
figured out fresh each time by reading that project's own code and README.
Don't skip that discovery step and reuse a shots list from a previous
project; it will silently point at the wrong selectors.

## 1. Get the app running

Check for a project skill that already knows how to launch this app — read
`.claude/skills/*/SKILL.md` in the repo for one that mentions running or
driving it, and use it if found. Otherwise fall back to the `run` skill's
patterns: find the dev command (`package.json` scripts, a `Makefile`,
`docker-compose`, the README's own "Getting Started"), start it in the
background, and **poll** the port until it actually answers — don't guess
with a fixed sleep:

```bash
npm install   # or the project's real install step
(nohup npm run dev > /tmp/devserver.log 2>&1 &)
timeout 90 bash -c 'until curl -sf http://localhost:3000 >/dev/null; do sleep 2; done'
```

Note the base URL and port — the shots config in step 3 needs it. If the
port is already bound from a previous run, free it first:
`lsof -ti:<port> -sTCP:LISTEN | xargs -r kill`.

## 2. Figure out what to shoot

**Refreshing an existing README with images:** read its current `![alt
text](path)` lines and the paragraphs around them. That prose is the
checklist — it tells you what each image is supposed to prove, so re-derive
the same set of shots (same pages, same sections) rather than inventing a
new set. If a page or section referenced no longer exists, drop it; if
something new was added that the README doesn't mention yet, that's a
signal to ask whether it belongs.

**Writing a README's screenshots for the first time:** find the app's real
pages/routes rather than guessing — grep for route definitions matching the
framework (Next.js App Router: `**/page.tsx`; Pages Router: `pages/**/*`;
React Router: route configs; Rails: `config/routes.rb`; Django:
`urls.py`; etc.), or crawl `<a href>` links from the rendered homepage with
Playwright if the framework isn't obvious. Pick the homepage plus roughly
3-6 more views that show what the product actually *does* — the features a
visitor would want proof of — not settings pages, empty states, or admin
screens.

For a shot that should crop to one section of a page (a chart, a specific
feature) rather than the whole page, find a stable selector tied to that
content — an `id`, a heading, a distinctive class — and use it as an
`anchor` to scroll to plus a `waitFor` to confirm it rendered. Don't crop by
guessing a pixel offset; it breaks the moment the layout shifts.

## 3. Write the shots config and capture

Write a small JSON config — see the full shape documented at the top of
`scripts/capture-screenshots.cjs` — with one entry per screenshot:

```json
{
  "baseUrl": "http://localhost:3000",
  "outDir": "docs/screenshots",
  "shots": [
    { "name": "home-hero", "path": "/", "waitFor": ".hero-title" },
    { "name": "pricing", "path": "/", "anchor": "#pricing", "waitFor": "#pricing", "settle": 1000 },
    { "name": "dashboard", "path": "/dashboard", "waitFor": "[data-testid=chart]", "fullPage": true }
  ]
}
```

Then run it:

```bash
node .claude/skills/readme-screenshots/scripts/capture-screenshots.cjs shots.json
```

The script needs the `playwright` npm package resolvable. Check whether the
project already has it (`node -e "require.resolve('playwright')"`); if not,
either add it as a devDependency or point `NODE_PATH` at wherever a global
install lives (`NODE_PATH=$(npm root -g) node ...` — this only works
because the script uses CommonJS `require`, not `import`). Chromium itself
needs to exist somewhere the script can launch it: if the box has one
preinstalled (this container has one at `/opt/pw-browsers/chromium`), set
`chromiumPath` in the config to it; otherwise run `npx playwright install
chromium` once and leave `chromiumPath` unset so Playwright manages its own.

## 4. Check what you actually captured

A selector that stopped matching still produces a "successful" screenshot —
of a loading skeleton or an empty state. Read at least the homepage/hero
shot and one or two others back with the Read tool and compare them against
what the README will claim they show. Treat any `!` warning line the script
prints (selector never appeared) as a hard stop, not a shot to ship anyway —
fix the selector or extend `settle` and recapture.

## 5. Update the README

Embed the images with real captions, and while you're in there, check any
numbers the README states in prose (counts, versions, stats) against their
actual source — a data file the app builds from, `package.json`'s version,
an API response — rather than leaving a stale figure sitting next to a
freshly captured screenshot that contradicts it. Compress images before
committing: JPEG at quality 85 and ~1.5x device scale is close to lossless
at README display sizes and keeps a typical shot around 150–400KB, small
enough to commit directly rather than needing external hosting.

## 6. Clean up

Stop the dev server you started in step 1
(`lsof -ti:<port> -sTCP:LISTEN | xargs -r kill`), then review the diff —
`git status` / `git diff --stat` should show the new/updated images and, if
anything changed, a matching prose diff. A refresh where nothing actually
changed is a legitimate outcome; don't force a commit to show activity.

## Gotchas

- **`networkidle` hangs** on anything with streaming media, websockets, or
  background polling — always prefer `waitUntil: 'load'` plus an explicit
  `waitFor` selector, which the bundled script already does.
- **Client-rendered content isn't done just because its selector exists.**
  A React/Vue component can mount with an empty or skeleton state before its
  data arrives. That's what per-shot `settle` is for — extend it rather than
  trusting the selector alone if a capture looks incomplete.
- **NODE_PATH only helps `require`, never `import`.** If you see
  `ERR_MODULE_NOT_FOUND` for `playwright` despite `NODE_PATH` being set,
  something is trying to `import` it — the bundled script avoids this by
  being CommonJS on purpose; don't rewrite it as `.mjs`.
- **Don't blow up the repo.** Full-page shots of long pages get large even
  compressed; if a page is very long, prefer a targeted `anchor` crop over
  `fullPage: true`, or accept the larger file only where the whole page is
  genuinely the point (e.g. a long-form data essay).
