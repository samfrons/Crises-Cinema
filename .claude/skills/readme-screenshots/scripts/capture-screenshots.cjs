#!/usr/bin/env node
// Screenshots every page/section the README embeds, against a dev server that
// must already be running at BASE_URL. One image per shot spec below — edit
// this list when a page is added, removed, or its layout changes enough that
// the old crop no longer shows what the caption says it shows.
//
// Usage:
//   NODE_PATH=$(npm root -g) node .claude/skills/readme-screenshots/scripts/capture-screenshots.cjs
//
// CommonJS on purpose: `playwright` is a global install on this box, not a
// project devDependency, and Node's ESM resolver ignores NODE_PATH (only
// require() honours it) — so `import` would fail to find it here even
// though `require` finds it fine. If the project ever adds playwright as a
// real devDependency, this still works unchanged, with or without NODE_PATH.

const { chromium } = require('playwright');
const { mkdirSync } = require('node:fs');

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000';
const OUT_DIR = process.env.OUT_DIR ?? 'docs/screenshots';
const CHROMIUM_PATH = process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium';

// viewport width matches the site's editorial max content width, so cropped
// sections don't show empty page margin either side.
const VIEWPORT = { width: 1280, height: 900 };
const DEVICE_SCALE = 1.5; // sharp on retina without ballooning file size
const JPEG_QUALITY = 85; // visually lossless at this size, ~200-300KB/shot

// path: URL path to load. anchor: CSS selector to scroll into view after
// load, for a mid-page crop (viewport screenshot, not full page). fullPage:
// capture the whole scrollable page instead of one viewport. waitFor: a
// selector that must appear before the shot is trustworthy — pages here
// render their hero data server-side, but client components (the explorer,
// the atlas map) paint in after hydration, so waiting on the right selector
// (not just `load`) is what keeps a shot from catching a loading state.
const SHOTS = [
  { name: 'home-hero', path: '/', waitFor: '.hero-title' },
  { name: 'home-chart', path: '/', waitFor: '#reel', anchor: '#reel' },
  { name: 'home-explorer', path: '/', waitFor: '#explorer', anchor: '#explorer', settle: 2200 },
  { name: 'atlas', path: '/atlas', waitFor: '#territories', fullPage: true, settle: 1200 },
  { name: 'reel', path: '/reel', waitFor: '.rl-masthead', settle: 1500 },
  { name: 'methodology', path: '/methodology', waitFor: '.md-masthead' },
];

async function shootOne(browser, shot) {
  const ctx = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: DEVICE_SCALE });
  const page = await ctx.newPage();
  try {
    await page.goto(`${BASE_URL}${shot.path}`, { waitUntil: 'load', timeout: 30_000 });
    try {
      await page.waitForSelector(shot.waitFor, { timeout: 15_000 });
    } catch {
      console.warn(`  ! ${shot.name}: selector "${shot.waitFor}" never appeared — shot may be incomplete`);
    }
    if (shot.anchor) {
      await page.locator(shot.anchor).scrollIntoViewIfNeeded();
    }
    // Charts and maps animate in and posters lazy-load; a fixed settle beats
    // guessing at a "no more network activity" wait, which some of these
    // client views never actually reach.
    await page.waitForTimeout(shot.settle ?? 800);
    const dest = `${OUT_DIR}/${shot.name}.jpg`;
    await page.screenshot({ path: dest, type: 'jpeg', quality: JPEG_QUALITY, fullPage: !!shot.fullPage });
    console.log(`  ✓ ${dest}`);
  } finally {
    await ctx.close();
  }
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const browser = await chromium.launch({ executablePath: CHROMIUM_PATH, args: ['--no-sandbox'] });
  console.log(`Capturing ${SHOTS.length} shots from ${BASE_URL} into ${OUT_DIR}/ ...`);
  for (const shot of SHOTS) {
    await shootOne(browser, shot);
  }
  await browser.close();
  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
