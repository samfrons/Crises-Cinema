/**
 * What the desk remembers about the player, and nothing else — all of it in
 * this browser only, every read and write wrapped so a private window,
 * blocked storage or a thumbnail capture simply sees an empty memory.
 *
 *   coached   — the desk notes (the taught first hour) have been seen or
 *               skipped this session: sessionStorage, plus an in-memory flag
 *               so a browser that refuses storage still never repeats them
 *               within the page's life.
 *   mode      — LOG or PICTURE, the player's last choice: localStorage.
 *   last run  — per scenario, the option the player took at each decision
 *               on their last completed run: localStorage. Read back only
 *               against the scenario as it now stands; a run that no longer
 *               matches its options is dropped rather than half-shown.
 */
import type { RunShape } from './summary';

const COACH_KEY = 'cr-coached';
let coachedInMemory = false;

export function wasCoached(): boolean {
  if (coachedInMemory) return true;
  try {
    return window.sessionStorage.getItem(COACH_KEY) === '1';
  } catch {
    return false;
  }
}

export function markCoached() {
  coachedInMemory = true;
  try {
    window.sessionStorage.setItem(COACH_KEY, '1');
  } catch {
    /* storage refused: the in-memory flag holds for this page's life */
  }
}

/* The desk's opening overture (the boot sequence) plays in full once a
   session, on the first desk taken; later desks open with a quick cut.
   Same storage rules as the desk notes. */
const BOOT_KEY = 'cr-booted';
let bootedInMemory = false;

export function wasBooted(): boolean {
  if (bootedInMemory) return true;
  try {
    return window.sessionStorage.getItem(BOOT_KEY) === '1';
  } catch {
    return false;
  }
}

export function markBooted() {
  bootedInMemory = true;
  try {
    window.sessionStorage.setItem(BOOT_KEY, '1');
  } catch {
    /* storage refused: the in-memory flag holds for this page's life */
  }
}

/* LOG · PICTURE: how the desk is shown, the reading version or the board
   played out. A presentation choice only (both render the same run), kept
   in localStorage; anything unreadable means the default, the log. */
export type DeskMode = 'log' | 'picture';
const MODE_KEY = 'cr-mode';

export function loadMode(): DeskMode {
  try {
    return window.localStorage.getItem(MODE_KEY) === 'picture' ? 'picture' : 'log';
  } catch {
    return 'log';
  }
}

export function saveMode(mode: DeskMode) {
  try {
    window.localStorage.setItem(MODE_KEY, mode);
  } catch {
    /* storage refused: the choice holds for this page's life */
  }
}

/** One completed run: timestep id → option id, and when it closed. */
export type LastRun = { at: string; picks: Record<string, string> };

const runKey = (id: string) => `cr-last-run:${id}`;

export function loadLastRun(scenario: RunShape): LastRun | null {
  try {
    const raw = window.localStorage.getItem(runKey(scenario.id));
    if (!raw) return null;
    const v = JSON.parse(raw) as { v?: number; at?: unknown; picks?: unknown };
    if (v?.v !== 1 || typeof v.at !== 'string' || !v.picks || typeof v.picks !== 'object') return null;
    const picks = v.picks as Record<string, unknown>;
    // Every decision must still exist with the option the player took.
    for (const t of scenario.timesteps) {
      const id = picks[t.id];
      if (typeof id !== 'string' || !t.options.some((o) => o.id === id)) return null;
    }
    return { at: v.at, picks: picks as Record<string, string> };
  } catch {
    return null;
  }
}

export function saveRun(scenario: RunShape, picks: Record<string, string>) {
  try {
    window.localStorage.setItem(runKey(scenario.id), JSON.stringify({ v: 1, at: new Date().toISOString(), picks }));
  } catch {
    /* storage refused: the next visit simply starts without a last run */
  }
}

/** How many of the decisions that have a recorded official call the picks
 *  share with it. Not a score: the officials' call is the record, not the
 *  right answer. */
export function sameCalls(scenario: RunShape, picks: Record<string, string>) {
  const counted = scenario.timesteps.filter((t) => t.historical_option_id !== null);
  return {
    same: counted.filter((t) => picks[t.id] === t.historical_option_id).length,
    of: counted.length,
  };
}
