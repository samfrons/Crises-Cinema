// Browser smoke test. NOT part of `npm test`: run `npm run build` first, then `npm run test:e2e`.
// Env: PW_MODULE_DIR (dir containing node_modules/playwright-core), CHROMIUM_PATH (chromium binary), PORT.
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = join(dirname(fileURLToPath(import.meta.url)), '..');
const PW_MODULE_DIR = process.env.PW_MODULE_DIR ?? '/tmp/claude-0/-home-user-Crises-Cinema/fc0c3d13-b2a2-5871-b80a-7f4af9e3c249/scratchpad';
const CHROMIUM_PATH = process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium';
const PORT = process.env.PORT ?? '3126';
const BASE = `http://127.0.0.1:${PORT}`;
const { chromium } = createRequire(join(PW_MODULE_DIR, 'noop.js'))('playwright-core');

const failures = [];
const check = (ok, msg) => { if (!ok) { failures.push(msg); console.error(`  FAIL ${msg}`); } };

const server = spawn(process.execPath, [join(repo, 'node_modules/next/dist/bin/next'), 'start', '-p', PORT], { cwd: repo, stdio: 'ignore' });
let browser;
const cleanup = () => { server.kill('SIGKILL'); };
process.on('exit', cleanup);

async function waitForServer() {
  for (let i = 0; i < 60; i++) {
    try { if ((await fetch(BASE)).ok) return; } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`next start did not come up on :${PORT} (did you run npm run build?)`);
}

async function checkPage(browser, path, width) {
  const page = await browser.newPage({ viewport: { width, height: 800 } });
  const errors = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(BASE + path, { waitUntil: 'networkidle' });
  const tag = `${path} @${width}`;
  check(errors.length === 0, `${tag}: console errors: ${errors.join(' | ')}`);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  check(overflow <= 0, `${tag}: horizontal scroll (${overflow}px)`);
  const current = await page.locator('nav [aria-current], header [aria-current]').count();
  check(current === 1, `${tag}: expected 1 aria-current nav entry, found ${current}`);
  console.log(`ok   ${tag}`);
  return page;
}

async function playLahaina(browser) {
  const page = await checkPage(browser, '/control-room', 1280);
  await page.locator('.cr-card', { hasText: 'The Day the Fire Came Back' }).click();
  await page.locator('.cr-btn-primary').first().click(); // start from the briefing
  for (let i = 1; i <= 3; i++) {
    await page.locator('.cr-option').first().click();
    await page.locator('#cr-advance-btn').click();
    console.log(`ok   decision ${i}`);
  }
  check(await page.locator('.cr-entry').count() >= 4, 'after 3 decisions, 4+ log entries should be visible');
  await page.close();
}

try {
  await waitForServer();
  browser = await chromium.launch({ executablePath: CHROMIUM_PATH, args: ['--no-sandbox'] });
  for (const path of ['/', '/preparedness', '/control-room']) {
    for (const width of [1280, 390]) await (await checkPage(browser, path, width)).close();
  }
  await playLahaina(browser);
} catch (e) {
  failures.push(String(e?.stack ?? e));
  console.error(e);
} finally {
  await browser?.close();
  cleanup();
}
console.log(failures.length ? `\n${failures.length} failure(s)` : '\nsmoke: all green');
process.exit(failures.length ? 1 : 0);
