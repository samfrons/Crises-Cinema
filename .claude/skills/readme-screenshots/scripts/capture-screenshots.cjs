#!/usr/bin/env node
// Generic Playwright capture engine for README screenshots. It knows nothing
// about any particular project — every project-specific decision (which
// pages, which selectors, which crops) lives in a shots config that the
// caller writes fresh each time, based on that project's own README and
// routes. This file is only the mechanical part: launch a browser, visit
// each URL, wait for real content, crop, compress, save.
//
// Usage:
//   node capture-screenshots.cjs <config.json>
//   SHOTS_JSON='{"shots":[...]}' node capture-screenshots.cjs
//
// Config shape (all top-level fields except `shots` are optional):
// {
//   "baseUrl": "http://localhost:3000",
//   "outDir": "docs/screenshots",
//   "viewport": { "width": 1280, "height": 900 },
//   "deviceScaleFactor": 1.5,
//   "format": "jpeg",              // "jpeg" or "png"
//   "quality": 85,                  // jpeg only
//   "chromiumPath": null,           // e.g. "/opt/pw-browsers/chromium" if a
//                                   // system Chromium is preinstalled;
//                                   // omit/null to let Playwright manage its
//                                   // own (requires `npx playwright install
//                                   // chromium` to have been run once)
//   "shots": [
//     {
//       "name": "home-hero",        // -> <outDir>/home-hero.jpg
//       "path": "/",                // URL path to load
//       "waitFor": ".hero-title",   // selector that must appear before the
//                                   // shot is trustworthy — pick one that
//                                   // only exists once real content has
//                                   // rendered, not the page shell
//       "anchor": "#pricing",       // optional: scroll this into view for a
//                                   // mid-page crop instead of the top
//       "fullPage": false,          // optional: capture the whole
//                                   // scrollable page, not one viewport
//       "settle": 800               // optional: extra ms to wait after
//                                   // waitFor appears, for animations,
//                                   // lazy images, or client hydration
//     }
//   ]
// }
//
// Requires the `playwright` package. If it's not a project dependency, a
// global install is picked up via `NODE_PATH=$(npm root -g) node
// capture-screenshots.cjs ...` — but only with `require` (used here), never
// with `import`: Node's ESM resolver ignores NODE_PATH, only CommonJS
// require() honours it. That's why this file is .cjs, not .mjs.

const { chromium } = require('playwright');
const { mkdirSync, readFileSync } = require('node:fs');

function loadConfig() {
  const configPath = process.argv[2];
  const raw = configPath ? readFileSync(configPath, 'utf8') : process.env.SHOTS_JSON;
  if (!raw) {
    console.error('Usage: node capture-screenshots.cjs <config.json>  (or set SHOTS_JSON)');
    process.exit(1);
  }
  const cfg = JSON.parse(raw);
  if (!Array.isArray(cfg.shots) || cfg.shots.length === 0) {
    console.error('Config must have a non-empty "shots" array.');
    process.exit(1);
  }
  return {
    baseUrl: cfg.baseUrl ?? 'http://localhost:3000',
    outDir: cfg.outDir ?? 'docs/screenshots',
    viewport: cfg.viewport ?? { width: 1280, height: 900 },
    deviceScaleFactor: cfg.deviceScaleFactor ?? 1.5,
    format: cfg.format ?? 'jpeg',
    quality: cfg.quality ?? 85,
    chromiumPath: cfg.chromiumPath ?? null,
    shots: cfg.shots,
  };
}

async function shootOne(browser, cfg, shot) {
  const ctx = await browser.newContext({ viewport: cfg.viewport, deviceScaleFactor: cfg.deviceScaleFactor });
  const page = await ctx.newPage();
  try {
    // `networkidle` looks like the "safe" wait but hangs forever on anything
    // with streaming media, websockets, or polling — `load` plus an explicit
    // selector wait is more reliable across arbitrary projects.
    await page.goto(`${cfg.baseUrl}${shot.path}`, { waitUntil: 'load', timeout: 30_000 });
    if (shot.waitFor) {
      try {
        await page.waitForSelector(shot.waitFor, { timeout: 15_000 });
      } catch {
        console.warn(`  ! ${shot.name}: selector "${shot.waitFor}" never appeared — shot may be incomplete`);
      }
    }
    if (shot.anchor) {
      await page.locator(shot.anchor).scrollIntoViewIfNeeded();
    }
    if (shot.settle) {
      await page.waitForTimeout(shot.settle);
    }
    const ext = cfg.format === 'png' ? 'png' : 'jpg';
    const dest = `${cfg.outDir}/${shot.name}.${ext}`;
    const shotOpts = { path: dest, type: cfg.format, fullPage: !!shot.fullPage };
    if (cfg.format === 'jpeg') shotOpts.quality = cfg.quality;
    await page.screenshot(shotOpts);
    console.log(`  ✓ ${dest}`);
  } finally {
    await ctx.close();
  }
}

async function main() {
  const cfg = loadConfig();
  mkdirSync(cfg.outDir, { recursive: true });
  const launchOpts = { args: ['--no-sandbox'] };
  if (cfg.chromiumPath) launchOpts.executablePath = cfg.chromiumPath;
  const browser = await chromium.launch(launchOpts);
  console.log(`Capturing ${cfg.shots.length} shots from ${cfg.baseUrl} into ${cfg.outDir}/ ...`);
  for (const shot of cfg.shots) {
    await shootOne(browser, cfg, shot);
  }
  await browser.close();
  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
