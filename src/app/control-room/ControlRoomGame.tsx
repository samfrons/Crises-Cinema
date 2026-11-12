'use client';

import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import type { Citation, GlossaryEntry, InfoItem, MediaAttachment, Option, Scenario, ScenarioBundle, Timestep } from './types';
import { startSession, logChoice, completeSession, type ChoiceEvent } from './telemetry';
import { scoreRun, historicalLeadTime, formatLead, alertBeforeClock, type Choice } from './scoring';
import DayStrip from './DayStrip';
import OpsMap, { BoardMiniature, hasBoard } from './OpsMap';
import { itemState, STATE_RANK, vocabFor, COMPASS_WORD, type ZoneState } from './hazards';
import AlertTimingChart from './AlertTimingChart';
import { KindGlyph, HazardGlyph, Pictogram, SilentGlyph, hasPictogram } from './glyphs';
import Readings from './Readings';
import WarningChain, { chainChanges, chainNews, deriveChain } from './WarningChain';
import { loadLastRun, markCoached, sameCalls, saveRun, wasCoached, type LastRun } from './memory';
import prepMeta from '../../data/preparedness-meta.json';
import { inWords, tzLabel, WPM, type CardBundle, type ScenarioCard } from './summary';
import { DAY_FOLDER, FILE_PATH, folderHref, folderWord, isFolder, type FolderId } from './file/folders';

/* ══════════════════════════════════════════════════════════════════════════
   One continuous desk. Once a day is chosen, everything happens in a single
   dispatch log that grows downward as the clock advances: the briefing, then
   each decision point's incoming traffic, your call, and what the record
   says followed — and finally the debrief, appended as the log's last entry.
   A console strip stays pinned above the log (clock, decision pips, the day
   on a rail), and the situation board rides beside the log on wide screens
   or opens as a sheet on phones. Nothing here invents an outcome: every line
   is either cited, the player's own action, or a statement that the record
   is silent.
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * What the wall map shows: zone states lit only by cited information already
 * revealed and the zones the player's own choices have warned. Which state an
 * item lights is the hazard's default for its kind (flood: forecast → watch,
 * gauge → signal, field report → flooding; fire: forecast → red flag, sensor
 * and field report → fire reported) unless the item names its own
 * board_state — "burning" only where the cited text says so, "none" where a
 * zoned report is not about the hazard at all (a pole down is not a fire).
 * The board only ever escalates; it never invents a state.
 */
function deriveBoard(scenario: Scenario, uptoIndex: number, choices: Choice[]) {
  const vocab = vocabFor(scenario);
  const zoneStates: Record<string, ZoneState> = {};
  // The board's marks restate cited items too: where the record first places
  // the hazard (`origin`, one per zone) and a wind direction a forecast states
  // (`wind`, held from the first item that states it, as of the latest).
  const origins: Record<string, string> = {};
  let wind: { from: string; by: string } | null = null;
  for (const t of scenario.timesteps.slice(0, uptoIndex + 1)) {
    for (const info of t.info_available) {
      if (info.origin && info.zones?.length === 1 && !origins[info.zones[0]]) {
        origins[info.zones[0]] = info.origin === true ? `BY ${stamp(t)}` : info.origin;
      }
      if (info.wind) wind = { from: info.wind.from, by: stamp(t) };
      const state = itemState(info, vocab);
      if (!state) continue;
      for (const z of info.zones ?? []) {
        if (STATE_RANK[state] > STATE_RANK[zoneStates[z] ?? 'quiet']) zoneStates[z] = state;
      }
    }
  }
  const warnedZones = new Set<string>();
  for (const c of choices) warnedBy(scenario, c.option).forEach((z) => warnedZones.add(z));
  return { zoneStates, warnedZones: Array.from(warnedZones), origins, wind };
}

/** What decision `index`'s traffic changed on the board, so the plate can
 *  print just those changes in (and, for reduced motion, strike them twice). */
function boardFresh(scenario: Scenario, index: number) {
  if (index < 0) return { zones: [], origins: [], wind: false };
  const a = deriveBoard(scenario, index - 1, []);
  const b = deriveBoard(scenario, index, []);
  return {
    zones: Object.keys(b.zoneStates).filter((z) => b.zoneStates[z] !== a.zoneStates[z]),
    origins: Object.keys(b.origins).filter((z) => !a.origins[z]),
    wind: !!b.wind && !a.wind,
  };
}

/** The pictograms a decision point's slips carry, most frequent first, for
 *  the debrief rows (a scanning aid; the rows say what happened in words). */
function stepIcons(t: Timestep, max = 3) {
  const n = new Map<string, number>();
  for (const i of t.info_available) if (hasPictogram(i.icon)) n.set(i.icon, (n.get(i.icon) ?? 0) + 1);
  return Array.from(n.entries()).sort((a, b) => b[1] - a[1]).slice(0, max).map(([k]) => k);
}

function warnedBy(scenario: Scenario, option: Option): string[] {
  const e = option.effects;
  if (e.warning_scope === 'province') return scenario.scoring.at_risk_zones.map((z) => z.id);
  if (e.warning_scope === 'targeted' || e.protective) return e.zones;
  return [];
}

const stamp = (t: Timestep) => `${t.approx ? '≈' : ''}${t.time}`;
const stepId = (t: Timestep) => `cr-step-${t.id}`;

type Run = {
  scenario: Scenario;
  sessionId: string | null; // null while still on the briefing
  cursor: number; // the decision point currently on the desk
  choices: Choice[];
  presentedAt: number;
  done: boolean;
  /** The player's previous completed run of this day, read when the desk was
   *  taken (so the debrief can set this run beside it); null on a first run. */
  last: LastRun | null;
  /** Set when the desk officer's file sent the player here: which folder,
   *  and the decision it points at (if any). Interface only; the day still
   *  runs from its opening. */
  filed: Filed | null;
};

type Filed = { folder: FolderId; at: string | null };

/** What the select screen says about the desk officer's file (computed on
 *  the server from src/data/essay.json; the essay itself never ships here). */
export type FileCard = { folders: number; sources: number; minutes: number; draft: boolean };

/** A link from the file: /control-room#day=<id>&at=<step>&file=<folder>. */
function readFiledHash(): { day: string; filed: Filed | null } | null {
  if (typeof window === 'undefined' || !window.location.hash.startsWith('#day=')) return null;
  const p = new URLSearchParams(window.location.hash.slice(1));
  const day = p.get('day');
  if (!day) return null;
  const folder = p.get('file');
  return { day, filed: isFolder(folder) ? { folder, at: p.get('at') } : null };
}

/* ── The taught first hour ────────────────────────────────────────────────
   The first time a visitor takes a desk this session, the interface names
   its own parts, one desk note at a time, each pinned beside the thing it
   names: the first slip, the warning chain, the clock, the call. Four notes,
   one press to dismiss them all, never shown again this session. This is
   interface teaching, not record content: it states how to read the desk,
   never a fact about the day. */

type CoachAt = 'slip' | 'chain' | 'clock' | 'call';
const COACH: { at: CoachAt; text: string }[] = [
  { at: 'slip', text: 'Dispatch traffic arrives here, one slip at a time, as officials received it. The bracketed number is the citation: every line on this desk is the record.' },
  { at: 'chain', text: 'Every warning must cross this chain to reach a person: forecast office, your desk, then sirens, phones, broadcast, posts. A link lights only when the record says it carried one.' },
  { at: 'clock', text: 'The clock is real; it will not wait. After each call it jumps to the next moment the record holds, and whatever happened in between happened without you.' },
  { at: 'call', text: 'Your call. No option is drawn as the right one. Afterwards the log says what officials did, and says so plainly where the record is silent.' },
];

type Coach = { at: CoachAt; index: number; onNext: () => void; onSkip: () => void } | null;
const coached = (coach: Coach, at: CoachAt) => (coach?.at === at ? ' is-coached' : '');

/** One desk note, set beside the part of the desk it names. `alt` replaces
 *  the line where that part is somewhere else on this screen (the chain,
 *  on a phone hour that does not print it, lives behind MAP). */
function CoachMark({ coach, at, point = 'up', alt }: { coach: Coach; at: CoachAt; point?: 'up' | 'down'; alt?: string }) {
  if (!coach || coach.at !== at) return null;
  const last = coach.index === COACH.length - 1;
  return (
    <aside id="cr-coach" className={`cr-coach cr-coach-${at} is-${point}`} aria-labelledby="cr-coach-h"
      onKeyDown={(e) => { if (e.key === 'Escape') coach.onSkip(); }}>
      <p id="cr-coach-h" className="cr-coach-head">Desk note {coach.index + 1} of {COACH.length}</p>
      <p className="cr-coach-text">{alt ?? COACH[coach.index].text}</p>
      <div className="cr-coach-actions">
        <button type="button" id="cr-coach-next" className="cr-coach-next" onClick={coach.onNext}>
          {last ? 'Take the call' : 'Next note'} <span aria-hidden>→</span>
        </button>
        {!last && (
          <button type="button" className="cr-coach-skip" onClick={coach.onSkip}>I&apos;ve held a desk before</button>
        )}
      </div>
    </aside>
  );
}

/** After a render: where focus lands and what scrolls into view. */
type Pending = { focus?: string; scroll?: string; block?: ScrollLogicalPosition };

function useMedia(query: string) {
  const [match, setMatch] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const sync = () => setMatch(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, [query]);
  return match;
}

const reducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** The full scenarios load only once a day is picked: the select screen
 *  ships card summaries (summary.ts), and this chunk follows on demand. */
let bundlePromise: Promise<ScenarioBundle> | null = null;
const loadBundle = () => {
  bundlePromise ??= import('../../data/scenarios.json').then((m) => (m.default ?? m) as unknown as ScenarioBundle);
  return bundlePromise;
};

export default function ControlRoomGame({ cards, file }: { cards: CardBundle; file?: FileCard }) {
  const [run, setRun] = useState<Run | null>(null);
  const [coachIndex, setCoachIndex] = useState<number | null>(null);
  const wide = useMedia('(min-width: 1024px)');

  const pending = useRef<Pending | null>(null);
  useEffect(() => {
    const p = pending.current;
    if (!p) return;
    pending.current = null;
    // Focus without the browser's own jump, then one deliberate scroll so the
    // new entry settles just under the console strip (scroll-margin-top).
    if (p.focus) document.getElementById(p.focus)?.focus({ preventScroll: true });
    if (p.scroll) {
      document.getElementById(p.scroll)?.scrollIntoView({
        block: p.block ?? 'start',
        behavior: reducedMotion() ? 'auto' : 'smooth',
      });
    }
  });

  const newRun = (scenario: Scenario, filed: Filed | null = null): Run =>
    ({ scenario, sessionId: null, cursor: 0, choices: [], presentedAt: 0, done: false, last: loadLastRun(scenario), filed });

  const [loading, setLoading] = useState<string | null>(null);
  const pick = (id: string, filed: Filed | null = null) => {
    setLoading(id);
    loadBundle().then((b) => {
      const scenario = b.playable.find((x) => x.id === id);
      setLoading(null);
      if (!scenario) return;
      // A decision the day does not hold is dropped, not guessed at.
      const at = filed?.at && scenario.timesteps.some((t) => t.id === filed.at) ? filed.at : null;
      pending.current = { focus: 'cr-brief-title', scroll: 'desk' };
      setRun(newRun(scenario, filed ? { ...filed, at } : null));
    }, () => setLoading(null));
  };

  // Arriving from the desk officer's file (#day=…), open that day's briefing.
  // Read after mount, so the server render (the select screen) and the first
  // client render agree; a later hash change from a link does the same.
  const pickRef = useRef(pick);
  pickRef.current = pick;
  useEffect(() => {
    const sync = () => {
      const h = readFiledHash();
      if (!h || !cards.playable.some((c) => c.id === h.day)) return;
      // Read once: a reload, or "Choose another day", returns to the select
      // screen rather than reopening this briefing.
      window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}#desk`);
      pickRef.current(h.day, h.filed);
    };
    sync();
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, [cards]);

  if (!run) {
    return <SelectScreen cards={cards} file={file} onPick={(id) => pick(id)} loading={loading} />;
  }

  const { scenario, sessionId, cursor, choices, done } = run;
  const started = sessionId !== null;
  const steps = scenario.timesteps;
  const current = steps[cursor];
  const lastIndex = steps.length - 1;
  const decided = choices.length > cursor;

  const start = () => {
    const session = startSession(scenario.id);
    if (!wasCoached()) {
      // First desk this session: the interface introduces itself. Marked as
      // seen at once, so leaving half-way never brings the notes back.
      markCoached();
      setCoachIndex(0);
      pending.current = { focus: 'cr-coach-next', scroll: stepId(steps[0]) };
    } else {
      pending.current = { focus: `${stepId(steps[0])}-h`, scroll: stepId(steps[0]) };
    }
    setRun({ ...run, sessionId: session.sessionId, cursor: 0, presentedAt: Date.now() });
  };

  const endCoach = () => {
    setCoachIndex(null);
    pending.current = { focus: `${stepId(steps[0])}-h`, scroll: `${stepId(steps[0])}-call`, block: 'center' };
  };
  const coach: Coach = coachIndex === null || !started || done ? null : {
    at: COACH[coachIndex].at,
    index: coachIndex,
    onNext: () => {
      if (coachIndex >= COACH.length - 1) { endCoach(); return; }
      setCoachIndex(coachIndex + 1);
      pending.current = { focus: 'cr-coach-next', scroll: 'cr-coach', block: 'nearest' };
    },
    onSkip: endCoach,
  };

  const choose = (option: Option) => {
    if (!sessionId || decided) return;
    const now = Date.now();
    const event: ChoiceEvent = {
      timestepId: current.id,
      optionId: option.id,
      presentedAt: run.presentedAt,
      chosenAt: now,
      hesitationMs: now - run.presentedAt,
      warningScope: option.effects.warning_scope,
      divergedFromHistory: current.historical_option_id !== null && option.id !== current.historical_option_id,
    };
    logChoice(sessionId, event);
    setCoachIndex(null);
    pending.current = { focus: 'cr-advance-btn', scroll: `${stepId(current)}-record`, block: 'nearest' };
    setRun({ ...run, choices: [...choices, { timestep: current, option, event }] });
  };

  const advance = () => {
    if (!sessionId || !decided) return;
    if (cursor >= lastIndex) {
      completeSession(sessionId, scoreRun(scenario, choices));
      saveRun(scenario, Object.fromEntries(choices.map((c) => [c.timestep.id, c.option.id])));
      pending.current = { focus: 'cr-debrief-title', scroll: 'cr-debrief' };
      setRun({ ...run, done: true });
    } else {
      const next = steps[cursor + 1];
      pending.current = { focus: `${stepId(next)}-h`, scroll: stepId(next) };
      setRun({ ...run, cursor: cursor + 1, presentedAt: Date.now() });
    }
  };

  const replay = () => {
    pending.current = { focus: 'cr-brief-title', scroll: 'desk' };
    setRun(newRun(scenario));
  };
  const leave = () => {
    pending.current = { scroll: 'desk' };
    setRun(null);
  };

  const board = deriveBoard(scenario, started ? cursor : -1, choices);
  const shownIndex = started ? cursor : -1;
  const fresh = done ? { zones: [], origins: [], wind: false } : boardFresh(scenario, shownIndex);
  const chain = deriveChain(scenario, shownIndex);
  const chainFresh = done || !started ? new Set<string>() : chainChanges(scenario, shownIndex);
  const live = { board, fresh, chain, chainFresh };

  return (
    <div className="cr-run">
      <Console scenario={scenario} started={started} cursor={cursor} choices={choices} done={done}
        live={live} showMapButton={!wide} coach={coach} />

      <div className="cr-play wrap">
        <div className="cr-log" role="log" aria-label="Dispatch log" aria-live="polite">
          <Briefing scenario={scenario} started={started} inlineMap={!wide} onStart={start} last={run.last} filed={run.filed} />

          {started && steps.slice(0, cursor + 1).map((t, i) => (
            <StepEntry
              key={t.id}
              scenario={scenario}
              t={t}
              index={i}
              choice={choices[i]}
              isCurrent={i === cursor && !done}
              isLast={i === lastIndex}
              inlineChain={!wide}
              coach={i === 0 ? coach : null}
              filed={run.filed?.at === t.id ? run.filed.folder : null}
              onChoose={choose}
              onAdvance={advance}
            />
          ))}
        </div>

        {wide && <SidePanel scenario={scenario} live={live} choices={choices} started={started} coach={coach} />}
      </div>

      {done ? (
        <Debrief scenario={scenario} choices={choices} last={run.last} onReplay={replay} onLeave={leave} />
      ) : (
        <div className="wrap cr-play-sources">
          <Sources scenario={scenario} title="Sources for this day" />
        </div>
      )}
    </div>
  );
}

/* ── The console strip ───────────────────────────────────────────────────
   Pinned to the top of the viewport for the whole run, ~60px tall: the
   current time (a link back to the decision on the desk), the decision
   count in words, one pip per decision point, and the day as a rail along
   its bottom edge. On phones it also carries the MAP button. */

type Live = {
  board: ReturnType<typeof deriveBoard>;
  fresh: ReturnType<typeof boardFresh>;
  chain: ReturnType<typeof deriveChain>;
  chainFresh: Set<string>;
};

/** The board as the live desk shows it, with this hour's changes marked. */
function LiveBoard({ scenario, live, note }: { scenario: Scenario; live: Live; note?: string }) {
  const { board, fresh } = live;
  return (
    <OpsMap scenario={scenario} zoneStates={board.zoneStates} warnedZones={board.warnedZones}
      origins={board.origins} wind={board.wind} fresh={fresh} note={note} />
  );
}

function Console({ scenario, started, cursor, choices, done, live, showMapButton, coach }: {
  scenario: Scenario; started: boolean; cursor: number; choices: Choice[]; done: boolean;
  live: Live; showMapButton: boolean; coach: Coach;
}) {
  const { board } = live;
  const steps = scenario.timesteps;
  const t = steps[cursor];
  const time = done ? scenario.clock.end : started ? stamp(t) : scenario.clock.start;
  const status = done
    ? 'End of record'
    : started
      ? `Decision ${cursor + 1} of ${steps.length}`
      : 'Briefing';
  const target = done ? 'cr-debrief' : started ? stepId(t) : 'cr-briefing';
  const boardLit = board.warnedZones.length > 0 || Object.values(board.zoneStates).some((s) => s !== 'quiet');
  const [sheetOpen, setSheetOpen] = useState(false);

  return (
    <div className="cr-console">
      <div className="cr-console-row wrap">
        <a className={`cr-console-clock${coached(coach, 'clock')}`} href={`#${target}`}
          aria-label={`${time} ${tzLabel(scenario)}, ${status}. Jump to the desk.`}>
          <span className="cr-console-time">{time}</span>
          <span className="cr-console-status"><span className="cr-console-tz">{tzLabel(scenario)} · </span>{status}</span>
        </a>
        <span className="cr-console-title" aria-hidden>{scenario.title}</span>
        <span className="cr-pips" aria-hidden>
          {steps.map((s, i) => {
            const c = choices[i];
            const cls = c
              ? c.event.divergedFromHistory ? 'is-diverged' : 'is-kept'
              : started && i === cursor && !done ? 'is-now' : '';
            return <i key={s.id} className={cls} />;
          })}
        </span>
        {showMapButton && (
          <button type="button" className="cr-console-map" onClick={() => setSheetOpen(true)}
            aria-haspopup="dialog" aria-label={`Situation board${boardLit ? ' (zones lit)' : ''}`}>
            Map{boardLit && <i className="cr-console-lit" aria-hidden />}
          </button>
        )}
      </div>
      <DayStrip scenario={scenario} currentIndex={started ? cursor : -1} choices={choices} ended={done} />
      {coach?.at === 'clock' && (
        <div className="cr-coach-dock wrap"><CoachMark coach={coach} at="clock" /></div>
      )}
      {showMapButton && (
        <BoardSheet open={sheetOpen} onClose={() => setSheetOpen(false)}>
          <LiveBoard scenario={scenario} live={live} />
          <BoardList scenario={scenario} board={board} />
          <p className="cr-side-head">Warning chain</p>
          <WarningChain scenario={scenario} snapshot={live.chain} fresh={live.chainFresh} />
        </BoardSheet>
      )}
    </div>
  );
}

/** Phone situation board: a native modal dialog styled as a bottom sheet —
 *  focus is held inside while open, Escape and the scrim close it, and focus
 *  returns to the MAP button. */
function BoardSheet({ open, onClose, children }: { open: boolean; onClose: () => void; children: React.ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog ref={ref} className="cr-sheet" aria-labelledby="cr-sheet-title" onClose={onClose}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="cr-sheet-head">
        <h2 id="cr-sheet-title">Situation board</h2>
        <button type="button" className="cr-sheet-close" onClick={onClose}>Close</button>
      </div>
      {open && children}
    </dialog>
  );
}

/** The board's state in words — what the map shows, never by colour alone. */
function BoardList({ scenario, board }: { scenario: Scenario; board: ReturnType<typeof deriveBoard> }) {
  const { states, originNoun } = vocabFor(scenario);
  return (
    <ul className="cr-boardlist">
      {scenario.scoring.at_risk_zones.map((z) => {
        const s = board.zoneStates[z.id] ?? 'quiet';
        const warned = board.warnedZones.includes(z.id);
        const origin = board.origins[z.id];
        return (
          <li key={z.id} className={`is-${s}`}>
            <span className="cr-boardlist-zone">{z.label}</span>
            <span className="cr-boardlist-state">
              {states[s]}{warned ? ' · warned by you' : ''}
            </span>
            {origin && (
              <span className="cr-boardlist-origin">
                <span aria-hidden>✳ </span>The record first places {originNoun} here{' '}
                {origin.startsWith('BY') ? origin.toLowerCase() : `at ${origin}`}
              </span>
            )}
          </li>
        );
      })}
      {board.wind && (
        <li className="cr-boardlist-wind">
          <span className="cr-boardlist-zone">Wind</span>
          <span className="cr-boardlist-state">{COMPASS_WORD[board.wind.from]} winds, per the forecast as of {board.wind.by}</span>
        </li>
      )}
    </ul>
  );
}

/** Why the board is blank on the briefing: it lights only from traffic the
 *  player has been shown, so the first decision's items (which may report a
 *  fire already burning, or a warning already in force) light it all at once
 *  at the opening time. Said up front, that first frame is expected. */
const boardNote = (scenario: Scenario) =>
  `Quiet until you take the desk. At ${scenario.timesteps[0].time} the board lights from the first traffic you are shown — including anything already under way before the clock starts.`;

/* ── Wide screens: the board and your run, alongside the log ────────────── */

function SidePanel({ scenario, live, choices, started, coach }: {
  scenario: Scenario; live: Live; choices: Choice[]; started: boolean; coach: Coach;
}) {
  return (
    <aside className="cr-side" aria-label="Situation board, warning chain and your run">
      <p className="cr-side-head">Situation board</p>
      <LiveBoard scenario={scenario} live={live} note={started ? undefined : boardNote(scenario)} />
      <BoardList scenario={scenario} board={live.board} />
      <p className="cr-side-head">Warning chain</p>
      <CoachMark coach={coach} at="chain" point="down" />
      <div className={`cr-coach-target${coached(coach, 'chain')}`}>
        <WarningChain scenario={scenario} snapshot={live.chain} fresh={live.chainFresh} />
      </div>
      <p className="cr-side-head">Your run so far</p>
      {started && choices.length ? (
        <ol className="cr-trace">
          {choices.map((c) => (
            <li key={c.timestep.id} className={c.event.divergedFromHistory ? 'is-diverged' : ''}>
              <a href={`#${stepId(c.timestep)}`}>
                <span className="cr-trace-time">{stamp(c.timestep)}</span>
                <span className="cr-trace-label">
                  {c.option.label}
                  {c.event.divergedFromHistory && <span className="cr-trace-tag"> · off the historical path</span>}
                </span>
              </a>
            </li>
          ))}
        </ol>
      ) : (
        <p className="cr-side-empty">No calls made yet. Each one will be listed here as you make it.</p>
      )}
    </aside>
  );
}

/* ── Select ──────────────────────────────────────────────────────────────── */

function SelectScreen({ cards, file, onPick, loading }: {
  cards: CardBundle; file?: FileCard; onPick: (id: string) => void; loading: string | null;
}) {
  // What this browser remembers of each day: unknown until mounted (so the
  // server render and the first client render agree), then a run or null.
  const [memory, setMemory] = useState<Record<string, LastRun | null> | null>(null);
  useEffect(() => {
    setMemory(Object.fromEntries(cards.playable.map((s) => [s.id, loadLastRun(s)])));
  }, [cards]);
  return (
    <section className="cr-select wrap" aria-labelledby="cr-select-title">
      <h2 id="cr-select-title" className="cr-section-eyebrow">Choose a day to hold the desk</h2>
      <div className="cr-select-grid">
        {cards.playable.map((s) => (
          <button type="button" key={s.id} className="cr-card" onClick={() => onPick(s.id)}
            aria-busy={loading === s.id} disabled={loading !== null && loading !== s.id}>
            {hasBoard(s.id) && (
              <span className="cr-card-plate">
                <BoardMiniature id={s.id} />
                <span className="cr-card-plate-tag" aria-hidden>The board · ground only</span>
              </span>
            )}
            <span className="cr-card-head">
              <HazardGlyph hazard={s.hazard} size={22} className="cr-card-glyph" />
              <span className="cr-card-date">{s.date} · {s.hazard}</span>
            </span>
            <span className="cr-card-title">{s.title}</span>
            <span className="cr-card-loc">{s.location}</span>
            <span className="cr-card-meta">
              {inWords(s.timesteps.length)} decisions · about {s.minutes} min · {s.clock.start}–{s.clock.end} {s.tz}
            </span>
            <CardMemory scenario={s} last={memory ? memory[s.id] : undefined} />
            <span className="cr-card-cta">
              {loading === s.id ? 'Opening the desk…' : memory?.[s.id] ? 'Take the desk again' : 'Take the desk'}
              <span className="cr-card-arrow" aria-hidden>→</span>
            </span>
          </button>
        ))}
        {file && (
          <a className="cr-card cr-card-file" href={FILE_PATH}>
            <span className="cr-card-head">
              <span className="cr-card-filetab" aria-hidden>File</span>
              <span className="cr-card-date">The argument · {inWords(file.folders).toLowerCase()} folders{file.draft ? ' · draft' : ''}</span>
            </span>
            <span className="cr-card-title">The Desk Officer&apos;s File</span>
            <span className="cr-card-loc">Read the desk officer&apos;s file: the argument behind these days, in{' '}
              {inWords(file.folders).toLowerCase()} folders. The Last Mile essay, filed for reading at the desk, with a slip wherever a claim is one you
              can hold here.</span>
            <span className="cr-card-meta">{file.sources} sources · about {file.minutes} min to read</span>
            <span className="cr-card-cta">Open the file <span className="cr-card-arrow" aria-hidden>→</span></span>
          </a>
        )}
        {cards.stubs.map((s) => (
          <div key={s.id} className="cr-card cr-card-stub" aria-disabled>
            <span className="cr-card-plate is-pending">
              <svg className="cr-mini is-pending" viewBox="0 0 720 150" aria-hidden focusable="false">
                <path className="cr-mini-pending" d="M24 18h672v114H24zM24 18l672 114M696 18L24 132" />
              </svg>
              <span className="cr-card-plate-tag">Board pending research</span>
            </span>
            <span className="cr-card-head">
              <HazardGlyph hazard={s.hazard} size={22} className="cr-card-glyph" />
              <span className="cr-card-date">{s.date} · {s.hazard}</span>
            </span>
            <span className="cr-card-title">{s.title}</span>
            <span className="cr-card-loc">{s.location}</span>
            <span className="cr-card-cta">In research — sources needed</span>
          </div>
        ))}
      </div>
      <p className="cr-footnote">Minutes are reading time: the words each day puts in front of you, at {WPM} a
        minute. Greyed scenarios exist only as schema: nothing appears here until every fact in
        them carries a source, and the build enforces it.</p>
    </section>
  );
}

/** The card's memory line. Its height is held whether or not there is a
 *  run to report, so the grid never shifts when this browser's memory is
 *  read after first paint. */
function CardMemory({ scenario, last }: { scenario: ScenarioCard; last: LastRun | null | undefined }) {
  let text = '';
  if (last) {
    const { same, of } = sameCalls(scenario, last.picks);
    text = `You have held this desk before — your last run took the officials' call at ${same} of ${of} decisions.`;
  } else if (last === null) {
    text = 'Not yet held on this browser.';
  }
  return <span className={`cr-card-memory${last ? ' is-held' : ''}`}>{text}</span>;
}

/* ── Log entry 0: the briefing ───────────────────────────────────────────── */

function Briefing({ scenario, started, inlineMap, onStart, last, filed }: {
  scenario: Scenario; started: boolean; inlineMap: boolean; onStart: () => void; last: LastRun | null; filed: Filed | null;
}) {
  const filedStep = filed?.at ? scenario.timesteps.findIndex((t) => t.id === filed.at) : -1;
  const vocab = vocabFor(scenario);
  const sourceIndex = useSourceIndex(scenario);
  const lastSame = last ? sameCalls(scenario, last.picks) : null;
  return (
    <article id="cr-briefing" className="cr-entry cr-entry-brief" aria-labelledby="cr-brief-title">
      <p className="cr-stamp">
        <span className="cr-stamp-time">{scenario.clock.start}</span>
        <span className="cr-stamp-meta">{tzLabel(scenario)} · {scenario.date} · Briefing</span>
      </p>
      <h2 id="cr-brief-title" className="cr-brief-title" tabIndex={-1}>{scenario.title}</h2>
      <p className="cr-brief">{scenario.location}. You hold the {vocab.desk}. You will see only what
        officials could see at each moment — {vocab.feeds} — and choose what to do.
        The clock then advances along the real timeline: <strong>history does not branch here</strong>. Each
        call you make stays in this log; at the end, it is set beside what officials actually did and what the
        inquiry found. Where you leave the historical path, the record is silent about what would have
        followed — and the log will say so rather than invent it.</p>
      <p className="cr-brief-count">{scenario.timesteps.length} decision points, from {scenario.clock.start} {tzLabel(scenario)}.
        The console above keeps the clock and your progress.</p>
      {filed && (
        <p className="cr-filed">
          <span className="cr-filed-tag">From the file · folder {folderWord(filed.folder)}</span>
          <span className="cr-filed-body">
            {filedStep >= 0
              ? <>The desk officer&apos;s file sent you here for decision {filedStep + 1} of {scenario.timesteps.length}, at {stamp(scenario.timesteps[filedStep])}. </>
              : <>The desk officer&apos;s file sent you to this desk. </>}
            The day still starts at its opening: the clock will bring you to that call, and the log will mark it.{' '}
            <a href={folderHref(filed.folder)}>Back to folder {folderWord(filed.folder)}</a>
          </span>
        </p>
      )}
      {lastSame && (
        <p className="cr-brief-count cr-brief-again">You have held this desk before: your last run took the officials&apos;
          call at {lastSame.same} of {lastSame.of} decisions. The debrief will set this run beside it.</p>
      )}
      {scenario.glossary && scenario.glossary.length > 0 && (
        <details className="cr-terms">
          <summary>
            <span className="cr-terms-label">Terms of the desk</span>
            <span className="cr-terms-count">{scenario.glossary.length} official definition{scenario.glossary.length > 1 ? 's' : ''}</span>
          </summary>
          <dl>
            {scenario.glossary.map((g) => (
              <div key={g.term}>
                <dt>{g.term}</dt>
                <dd><Definition g={g} idx={sourceIndex} /></dd>
              </div>
            ))}
          </dl>
          <p className="cr-terms-note">Each term is also marked with a dotted underline where it first appears in
            the traffic; press it for the definition. Words without an official definition the project could
            fetch and check are left unglossed.</p>
        </details>
      )}
      {scenario.briefing_media && <Figure scenario={scenario} m={scenario.briefing_media} />}
      {inlineMap && !started && (
        <OpsMap scenario={scenario} zoneStates={{}} warnedZones={[]} note={boardNote(scenario)} />
      )}
      {started ? (
        <p className="cr-brief-taken">Desk taken at {scenario.clock.start} {tzLabel(scenario)}.</p>
      ) : (
        <div className="cr-dock">
          <button type="button" className="cr-btn-primary" onClick={onStart}>
            Take the desk — {scenario.clock.start}
          </button>
        </div>
      )}
    </article>
  );
}

/* ── Log entries 1…n: one decision point each ────────────────────────────── */

function StepEntry({ scenario, t, index, choice, isCurrent, isLast, inlineChain, coach, filed, onChoose, onAdvance }: {
  scenario: Scenario; t: Timestep; index: number; choice?: Choice;
  isCurrent: boolean; isLast: boolean; inlineChain: boolean; coach: Coach; filed: FolderId | null;
  onChoose: (o: Option) => void; onAdvance: () => void;
}) {
  const sourceIndex = useSourceIndex(scenario);
  const termMarks = useTermMarks(scenario);
  const total = scenario.timesteps.length;
  const remaining = total - (index + 1);
  const vocab = vocabFor(scenario);
  const id = stepId(t);
  // What this hour's traffic changed on the board — derived only from the
  // cited items shown here, compared with the board before them.
  const changes = useMemo(() => {
    const before = deriveBoard(scenario, index - 1, []).zoneStates;
    const after = deriveBoard(scenario, index, []).zoneStates;
    return scenario.scoring.at_risk_zones
      .filter((z) => (after[z.id] ?? 'quiet') !== (before[z.id] ?? 'quiet'))
      .map((z) => ({ label: z.label, state: after[z.id] as ZoneState }));
  }, [scenario, index]);
  // What this hour's traffic says about the warning chain, in words; on
  // phones the chain as it stands at this hour is printed under it.
  const news = useMemo(() => chainNews(scenario, index), [scenario, index]);
  const chainAt = useMemo(() => (news.length && inlineChain
    ? { snap: deriveChain(scenario, index), fresh: chainChanges(scenario, index) } : null), [scenario, index, news, inlineChain]);
  const slips = t.info_available.length;

  return (
    <article id={id} className={`cr-entry${isCurrent ? ' is-current' : ''}`} aria-labelledby={`${id}-h`}>
      <h3 id={`${id}-h`} className="cr-stamp" tabIndex={-1}>
        <span className="cr-stamp-time">{stamp(t)}</span>
        <span className="cr-stamp-meta">
          {tzLabel(scenario)}
          {t.time_label !== t.time && t.time_label !== stamp(t) ? ` · ${t.time_label}` : ''}
          {' · '}Decision {index + 1} of {scenario.timesteps.length}
        </span>
      </h3>
      {filed && (
        <p className="cr-filed cr-filed-step">
          <span className="cr-filed-tag">The file points here</span>
          <span className="cr-filed-body">
            This is the call folder {folderWord(filed)} sent you to.{' '}
            <a href={folderHref(filed)}>Read the folder</a>
          </span>
        </p>
      )}

      <ul className="cr-dispatches" aria-label={`Incoming at ${stamp(t)}`}>
        {t.info_available.map((info, i) => (
          <li key={info.id} className={`cr-slip cr-slip-${info.kind}${i === 0 ? coached(coach, 'slip') : ''}`}
            style={{ '--i': i } as React.CSSProperties}>
            <p className="cr-slip-kind">
              <KindGlyph kind={info.kind} className="cr-kind-glyph" /> {vocab.kindLabel[info.kind]}
              {hasPictogram(info.icon) && <Pictogram name={info.icon} size={22} className="cr-slip-pict" />}
            </p>
            <SlipText info={info} marks={termMarks.get(info.id)} idx={sourceIndex} />
            {info.readings && <Readings scenario={scenario} itemId={info.id} readings={info.readings} />}
            {i === 0 && <CoachMark coach={coach} at="slip" />}
            {info.media && <Figure scenario={scenario} m={info.media} />}
          </li>
        ))}
      </ul>
      {inlineChain && !chainAt && (
        <CoachMark coach={coach} at="chain" alt={`${COACH[1].text} On this screen the chain is on the situation board: press MAP in the bar above.`} />
      )}

      {changes.length > 0 && (
        <p className="cr-boardline" style={{ '--i': t.info_available.length } as React.CSSProperties}>
          <span className="cr-boardline-tag">{index === 0 ? 'Board opens' : 'Board'}</span>
          <span className="cr-boardline-body">
            {changes.map((c) => (
              <span key={c.label} className="cr-boardline-item">
                {c.label} <span aria-hidden>→</span><span className="cr-sr"> now </span> <strong>{vocab.states[c.state]}</strong>
              </span>
            ))}
          </span>
        </p>
      )}

      {news.length > 0 && (
        <div className="cr-chainline" style={{ '--i': slips + 1 } as React.CSSProperties}>
          <p className="cr-boardline">
            <span className="cr-boardline-tag">Chain</span>
            <span className="cr-boardline-body">
              {news.map((n) => (
                <span key={n.key} className="cr-boardline-item">
                  {n.what} <span aria-hidden>→</span><span className="cr-sr"> now </span> <strong>{n.word}{n.at ? ` ${n.at}` : ''}</strong>
                </span>
              ))}
            </span>
          </p>
          {chainAt && <CoachMark coach={coach} at="chain" />}
          {chainAt && (
            <div className={`cr-coach-target${coached(coach, 'chain')}`}>
              <WarningChain scenario={scenario} snapshot={chainAt.snap} fresh={chainAt.fresh} compact />
            </div>
          )}
        </div>
      )}

      {choice ? (
        <CallRecord scenario={scenario} t={t} choice={choice} sourceIndex={sourceIndex} />
      ) : (
        <div className="cr-call" role="group" aria-labelledby={`${id}-call`}
          style={{ '--i': slips + 2 } as React.CSSProperties}>
          <p id={`${id}-call`} className="cr-call-head">Your call · {stamp(t)}</p>
          <CoachMark coach={coach} at="call" point="down" />
          <div className={`cr-options${coached(coach, 'call')}`}>
            {t.options.map((o) => (
              <button type="button" key={o.id} className="cr-option" onClick={() => onChoose(o)}>
                <span className="cr-option-label">{o.label}</span>
                {o.detail && <span className="cr-option-detail">{o.detail}</span>}
              </button>
            ))}
          </div>
        </div>
      )}

      {choice && isCurrent && (
        <div className="cr-dock">
          <button type="button" id="cr-advance-btn" className="cr-btn-primary" onClick={onAdvance}>
            {isLast ? 'Close the log — to the debrief' : 'Advance the clock'}
            <span className="cr-btn-arrow" aria-hidden>↓</span>
          </button>
          <p className={`cr-advance-note${remaining === 1 ? ' is-penultimate' : ''}`}>
            Decision {index + 1} of {total} logged
            {remaining > 1 && <> · {remaining} more on the record</>}
            {remaining === 1 && <> · <strong>one decision remains before the log closes</strong></>}
            {remaining === 0 && <> · that was the last call; the log closes on the debrief</>}
          </p>
        </div>
      )}
    </article>
  );
}

/* ── Terms of the desk ─────────────────────────────────────────────────────
   A glossary term is marked once, where it first appears in the day's
   traffic (in slip order), as a dotted-underline button: pressing it prints
   the official definition as a footnote under the slip, cited like every
   other line. Its title carries the same words for a pointer's hover. */

type TermMark = { g: GlossaryEntry; start: number; end: number };
const escRe = (x: string) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function useTermMarks(scenario: Scenario) {
  return useMemo(() => {
    const out = new Map<string, TermMark[]>();
    for (const g of scenario.glossary ?? []) {
      const res = g.match.map((m) => new RegExp(`\\b${escRe(m)}\\b`));
      found: for (const t of scenario.timesteps) {
        for (const info of t.info_available) {
          let best: { start: number; end: number } | null = null;
          for (const re of res) {
            const m = re.exec(info.text);
            if (m && (!best || m.index < best.start)) best = { start: m.index, end: m.index + m[0].length };
          }
          if (!best) continue;
          const list = out.get(info.id) ?? [];
          // Two terms may not overlap in one slip; the earlier-listed term wins.
          if (!list.some((x) => best!.start < x.end && x.start < best!.end)) list.push({ g, ...best });
          out.set(info.id, list.sort((a, b) => a.start - b.start));
          break found;
        }
      }
    }
    return out;
  }, [scenario]);
}

function Definition({ g, idx }: { g: GlossaryEntry; idx: Map<string, number> }) {
  return (
    <>
      {g.kind === 'verbatim' ? <q className="cr-def-quote" lang={g.translation ? 'es' : undefined}>{g.definition}</q> : g.definition}
      {g.translation ? <span className="cr-translation"> {g.translation} <span className="cr-paraphrase-tag">our translation</span></span> : null}
      {' '}<Cite c={g.citation} idx={idx} />
      {g.kind === 'paraphrase' && <span className="cr-paraphrase-tag"> paraphrase</span>}
    </>
  );
}

function SlipText({ info, marks, idx }: { info: InfoItem; marks?: TermMark[]; idx: Map<string, number> }) {
  const [open, setOpen] = useState<string | null>(null);
  if (!marks?.length) {
    return <p className="cr-slip-text">{info.text} <Cite c={info.citation} idx={idx} /></p>;
  }
  const parts: React.ReactNode[] = [];
  let at = 0;
  for (const m of marks) {
    parts.push(info.text.slice(at, m.start));
    const noteId = `${info.id}-term-${m.start}`;
    const isOpen = open === m.g.term;
    parts.push(
      <button key={noteId} type="button" className={`cr-term${isOpen ? ' is-open' : ''}`} aria-expanded={isOpen}
        aria-controls={noteId} title={m.g.translation ?? m.g.definition}
        onClick={() => setOpen(isOpen ? null : m.g.term)}>
        {info.text.slice(m.start, m.end)}
      </button>,
    );
    at = m.end;
  }
  parts.push(info.text.slice(at));
  return (
    <>
      <p className="cr-slip-text">{parts.map((x, i) => <Fragment key={i}>{x}</Fragment>)} <Cite c={info.citation} idx={idx} /></p>
      {marks.map((m) => (
        <p key={m.start} id={`${info.id}-term-${m.start}`} className="cr-term-note" hidden={open !== m.g.term}>
          <span className="cr-term-tag">Term of the desk</span>{' '}
          <b>{m.g.term}</b> <span aria-hidden>—</span> <Definition g={m.g} idx={idx} />
        </p>
      ))}
    </>
  );
}

/** A decision once made: your call stamped, the others left as not taken,
 *  and what the record says — or that it is silent. Stays in the log. */
function CallRecord({ scenario, t, choice, sourceIndex }: {
  scenario: Scenario; t: Timestep; choice: Choice; sourceIndex: Map<string, number>;
}) {
  const c = choice.option.consequence;
  const warned = warnedBy(scenario, choice.option);
  const zoneLabel = (z: string) => scenario.scoring.at_risk_zones.find((x) => x.id === z)?.label ?? z;
  return (
    <div id={`${stepId(t)}-record`} className="cr-record">
      <p className="cr-call-head">Your call · {stamp(t)}</p>
      <ul className="cr-taken" aria-label="Options at this hour">
        {t.options.map((o) => (
          <li key={o.id} className={o.id === choice.option.id ? 'is-chosen' : 'is-not'}>
            <span className="cr-taken-mark">{o.id === choice.option.id ? 'Taken' : 'Not taken'}</span>
            <span className="cr-taken-label">{o.label}</span>
          </li>
        ))}
      </ul>
      {warned.length > 0 && (
        <p className="cr-boardline cr-boardline-you">
          <span className="cr-boardline-tag">Board</span>
          <span className="cr-boardline-body">
            <span className="cr-boardline-lead">Marked warned by you</span>
            {warned.map((z) => <span key={z} className="cr-boardline-item">{zoneLabel(z)}</span>)}
          </span>
        </p>
      )}
      {c.known ? (
        <div className="cr-consequence">
          <p className="cr-consequence-tag">The record</p>
          <p>{c.text} <Cite c={c.citation} idx={sourceIndex} /></p>
        </div>
      ) : (
        <div className="cr-consequence cr-consequence-silent">
          <SilentGlyph className="cr-silent-glyph" />
          <p className="cr-consequence-tag">The record is silent</p>
          <p>No one took this path on the day, so no source can say what it would have changed. Your call is
            logged and scored; the clock moves on along the real timeline.</p>
        </div>
      )}
    </div>
  );
}

/* ── The last entry: the debrief ─────────────────────────────────────────── */

function Debrief({ scenario, choices, last, onReplay, onLeave }: {
  scenario: Scenario; choices: Choice[]; last: LastRun | null; onReplay: () => void; onLeave: () => void;
}) {
  const sourceIndex = useSourceIndex(scenario);
  const score = useMemo(() => scoreRun(scenario, choices), [scenario, choices]);
  const histLead = historicalLeadTime(scenario);
  // Where the real public warnings came before this clock opened, the day's
  // first-alert HH:MM is not the officials' lead time; say so beside it.
  const early = alertBeforeClock(scenario);
  const firstAlert = scenario.scoring.historical_first_public_alert;
  const compact = !useMedia('(min-width: 640px)');
  const vocab = vocabFor(scenario);
  const d = scenario.outcome.deaths;
  const optLabel = (t: Timestep, id?: string) => t.options.find((o) => o.id === id)?.label ?? '—';
  // This run beside the last one, counted against the record — never ranked.
  const thisPicks = Object.fromEntries(choices.map((c) => [c.timestep.id, c.option.id]));
  const nowSame = sameCalls(scenario, thisPicks);
  const lastSame = last ? sameCalls(scenario, last.picks) : null;
  const changed = last ? scenario.timesteps.filter((t) => last.picks[t.id] !== thisPicks[t.id]) : [];

  return (
    <section id="cr-debrief" className="cr-debrief" aria-labelledby="cr-debrief-title">
      <div className="cr-endband">
        <div className="wrap">
          <p className="cr-endband-stamp">
            <span>{scenario.clock.end} {tzLabel(scenario)}</span>
            <span>End of record</span>
          </p>
          <h2 id="cr-debrief-title" className="cr-endband-title" tabIndex={-1}>
            <span className="cr-endband-kicker">Debrief<span className="cr-sr"> —</span> <span aria-hidden>·</span> {scenario.date}</span>
            <span className="cr-endband-name">{scenario.title}</span>
          </h2>
          <p className="cr-toll">
            <span className="cr-toll-number">{d.min === d.max ? d.min : `${d.min}–${d.max}`}</span>
            <span className="cr-toll-label">
              dead <Cite c={scenario.outcome.citation} idx={sourceIndex} />
            </span>
            {d.contested && d.note ? <span className="cr-toll-note">{d.note}</span> : null}
          </p>
        </div>
      </div>

      <div className="wrap cr-debrief-body">
        <div className="cr-dsec">
          <h3 className="cr-dsec-title">Your day beside theirs</h3>
          {last && lastSame && (
            <div className="cr-vs-legend">
              <p className="cr-vs-key">
                <span><span className="cr-vs-who is-you">You</span> this run</span>
                <span><span className="cr-vs-who is-last">Last</span> your last run on this browser</span>
                <span><span className="cr-vs-who">They</span> the record</span>
              </p>
              <p className="cr-vs-compare">
                This run took the officials&apos; call at <strong>{nowSame.same} of {nowSame.of}</strong> decisions;
                your last run, at <strong>{lastSame.same} of {lastSame.of}</strong>.{' '}
                {changed.length
                  ? <>You changed your call at {changed.map((t) => stamp(t)).join(', ')}.</>
                  : <>You made every call as you did last time.</>}
                {' '}<span className="cr-vs-compare-note">Neither count is a score: the officials&apos; call is what
                happened, not the right answer. What matters is which line of the record moved you.</span>
              </p>
            </div>
          )}
          <ol className="cr-vs">
            {scenario.timesteps.map((t) => {
              const c = choices.find((x) => x.timestep.id === t.id);
              const h = scenario.historical_path.find((x) => x.timestep_id === t.id);
              const diverged = !!c?.event.divergedFromHistory;
              return (
                <li key={t.id} id={`cr-vs-${t.id}`} className={diverged ? 'is-diverged' : ''}>
                  <span className="cr-vs-time">
                    <span className="cr-vs-stamp">{stamp(t)}</span>
                    <span className="cr-vs-icons" aria-hidden>
                      {stepIcons(t).map((name) => <Pictogram key={name} name={name} size={18} />)}
                    </span>
                  </span>
                  <div className="cr-vs-mine">
                    <div className="cr-vs-you">
                      <span className="cr-vs-who">You</span>
                      <span>
                        {c ? c.option.label : '—'}
                        {c && (
                          <span className="cr-vs-meta">
                            {' '}· decided in {Math.round(c.event.hesitationMs / 1000)}s
                            {diverged ? <strong> · off the historical path</strong> : ' · as on the day'}
                          </span>
                        )}
                      </span>
                    </div>
                    {last && (
                      <div className="cr-vs-last">
                        <span className="cr-vs-who">Last</span>
                        <span>
                          {last.picks[t.id] === c?.option.id
                            ? <span className="cr-vs-meta">The same call</span>
                            : <>{optLabel(t, last.picks[t.id])} <span className="cr-vs-meta">· changed this run</span></>}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="cr-vs-they">
                    <span className="cr-vs-who">They</span>
                    <span>{h ? <>{h.action} <Cite c={h.citation} idx={sourceIndex} /></> : 'The record does not say.'}</span>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>

        {scenario.takeaways && scenario.takeaways.length > 0 && (
          <div className="cr-dsec">
            <h3 className="cr-dsec-title">What the record teaches</h3>
            <p className="cr-dsec-note">{inWords(scenario.takeaways.length)} lessons in our words, each tied to the cited
              line it is drawn from. The line is the record; the lesson is our reading of it.</p>
            <ol className="cr-lessons">
              {scenario.takeaways.map((k, i) => {
                const fromStep = 'step' in k.from ? scenario.timesteps.find((t) => 'step' in k.from && t.id === k.from.step) : undefined;
                const href = 'finding' in k.from ? `#cr-finding-${k.from.finding}` : `#cr-vs-${k.from.step}`;
                const label = 'finding' in k.from
                  ? `the inquiry said, no. ${k.from.finding + 1} below`
                  : `the record at ${fromStep ? stamp(fromStep) : k.from.step}, above`;
                return (
                  <li key={i}>
                    <span className="cr-lesson-num" aria-hidden>{String(i + 1).padStart(2, '0')}</span>
                    <p className="cr-lesson-text">{k.text}</p>
                    <p className="cr-lesson-from">
                      Drawn from <a href={href}>{label}</a> <Cite c={k.citation} idx={sourceIndex} />
                    </p>
                  </li>
                );
              })}
            </ol>
          </div>
        )}

        {scenario.debrief_media && scenario.debrief_media.length > 0 && (
          <div className="cr-dsec">
            <h3 className="cr-dsec-title">After the clock stopped</h3>
            <p className="cr-dsec-note">Imagery from after the last decision point, or computed afterwards from the
              day&apos;s data. None of it was on the desk:
              the log showed only what existed at each hour.{compact ? ' Tap a plate to open it.' : ''}</p>
            {compact ? (
              <ContactSheet scenario={scenario} media={scenario.debrief_media} />
            ) : (
              <div className="cr-figures">
                {scenario.debrief_media.map((m) => <Figure key={m.file} scenario={scenario} m={m} />)}
              </div>
            )}
          </div>
        )}

        <div className="cr-dsec">
          <h3 className="cr-dsec-title">Your run, measured</h3>
          <AlertTimingChart scenario={scenario} choices={choices} compact={compact} />
          {early && (
            <div className="cr-early" id="cr-early">
              <p className="cr-early-tag">Warnings before the clock</p>
              <p className="cr-early-body">
                <strong>Public warning came {early.span} this clock opened</strong>, on {early.weekday} {early.longDate}
                {early.time ? `, at ${early.time}` : ''}. {early.note} <Cite c={early.citation} idx={sourceIndex} />
              </p>
              <p className="cr-early-body">The {firstAlert} on this clock is {early.clock_alert}. A lead time measured
                from it is this day&apos;s figure only: it neither credits the officials with the warnings that came
                before the clock opened nor counts them against you, who could not issue them.</p>
            </div>
          )}
          <dl className="cr-score-grid">
            <div>
              <dt>Warning lead time</dt>
              <dd className="big">{formatLead(score.leadTimeMinutes)}</dd>
              {early ? (
                <dd className="sub">officials, on this clock only: {formatLead(histLead)} ({firstAlert} is {early.clock_alert}).
                  Their public warnings came earlier — <a href="#cr-early">{early.span} this clock</a>.</dd>
              ) : (
                <dd className="sub">officials: {formatLead(histLead)} (first alert {firstAlert})</dd>
              )}
            </div>
            <div>
              <dt>Coverage of at-risk {vocab.zoneNoun}</dt>
              <dd className="big">{Math.round(score.coverage * 100)}%</dd>
              <dd className="cr-meter"><span style={{ width: `${Math.round(score.coverage * 100)}%` }} /></dd>
              <dd className="sub">{scenario.scoring.at_risk_zones.map((z) => z.label).join(' · ')}</dd>
            </div>
            <div>
              <dt>False-alarm cost</dt>
              <dd className="big">{score.falseAlarmWeight}</dd>
              <dd className="sub">weight of warnings issued before the signals warranted them</dd>
            </div>
            <div>
              <dt>Divergence from history</dt>
              <dd className="big">{score.divergence} / {choices.length}</dd>
              <dd className="cr-meter">
                {choices.map((c) => (
                  <i key={c.timestep.id} className={c.event.divergedFromHistory ? 'is-diverged' : ''} />
                ))}
              </dd>
              <dd className="sub">decision points where you left the historical path</dd>
            </div>
          </dl>
          <p className="cr-score-caveat">A scoring layer, not history: it measures your choices against the real
            clock and the documented impact at {scenario.scoring.impact.time} ({scenario.scoring.impact.label}{' '}
            <Cite c={scenario.scoring.impact.citation} idx={sourceIndex} />). It makes no claim about lives a
            different decision would have saved — the record is silent on paths not taken.</p>
        </div>

        <div className="cr-dsec">
          <h3 className="cr-dsec-title">The inquiry said</h3>
          <ol className="cr-findings">
            {scenario.inquiry_findings.map((f, i) => (
              <li key={i} id={`cr-finding-${i}`} className={f.kind === 'verbatim' ? 'is-verbatim' : ''}>
                {f.kind === 'verbatim' ? <q className="cr-verbatim">{f.quote}</q> : f.quote}
                {f.translation ? <span className="cr-translation"> {f.translation}</span> : null}
                {' '}<Cite c={f.citation} idx={sourceIndex} />
                {f.kind === 'paraphrase' && <span className="cr-paraphrase-tag"> paraphrase</span>}
              </li>
            ))}
          </ol>
        </div>

        <div className="cr-caveat">
          <p className="cr-consequence-tag">The state of the record</p>
          <p>{scenario.record_caveat}</p>
        </div>

        <Sources scenario={scenario} title="Sources" />

        <div className="cr-end-actions">
          <button type="button" className="cr-btn-primary" onClick={onReplay}>Replay this day</button>
          <button type="button" className="cr-btn-quiet" onClick={onLeave}>Choose another day</button>
        </div>
        <p className="cr-replay-note">A replay keeps this run, in this browser only, and sets the next one beside it.</p>

        <nav className="cr-bridge" aria-labelledby="cr-bridge-h">
          <p id="cr-bridge-h" className="cr-bridge-line">One day, one desk. The rest of the site widens the frame.</p>
          <ul>
            <li className="cr-bridge-file">
              <a href={DAY_FOLDER[scenario.id] ? folderHref(DAY_FOLDER[scenario.id]) : FILE_PATH}>
                <span className="cr-bridge-title">The argument behind this day, in six folders</span>
                <span className="cr-bridge-sub">
                  The desk officer&apos;s file — the Last Mile essay, filed for reading at the desk
                  {DAY_FOLDER[scenario.id] ? `. This day is clocked in folder ${folderWord(DAY_FOLDER[scenario.id])}.` : '.'}
                </span>
              </a>
            </li>
            <li>
              <a href="/preparedness">
                <span className="cr-bridge-title">{COUNTRY_COUNT
                  ? `The same machinery, scored for ${COUNTRY_COUNT} countries`
                  : 'The same machinery, scored country by country'}</span>
                <span className="cr-bridge-sub">The Last Mile — preparedness indices, and the inquiries into what failed</span>
              </a>
            </li>
            <li>
              <a href="/">
                <span className="cr-bridge-title">The movies get this wrong on purpose</span>
                <span className="cr-bridge-sub">The essay — disaster films, decade by decade</span>
              </a>
            </li>
          </ul>
        </nav>
      </div>
    </section>
  );
}

/** Countries the preparedness page scores (src/data/preparedness-meta.json,
 *  written by its committed pipeline) — the same figure that page prints. */
const COUNTRY_COUNT = typeof (prepMeta as { countryCount?: unknown }).countryCount === 'number'
  ? (prepMeta as { countryCount: number }).countryCount : 0;

/* ── Figures ───────────────────────────────────────────────────────────────
   A cited image or clip, printed into the log like a pasted-in plate: ruled
   frame, then the caption in the reading face, then ONE compact mono credit
   line — who made it · the licence by its short name (linked to the licence
   or its guidance) · the source page. The full credit and the full licence
   wording are kept, folded into a "Terms" disclosure at the end of that line
   (and on the links' titles), so nothing about the licence is dropped from
   the page; it simply stops outweighing the caption. Width and height are
   always set and the frame keeps the aspect ratio, so nothing shifts as a
   lazy image arrives. The image is informative, so its caption is its alt
   text. Video never autoplays and loads nothing until asked. Files are
   served exactly as vetted (no image optimiser re-encoding them). */

/** "CC0 1.0 (NASA data-use guidance: …)" → "CC0 1.0"; "Public domain (U.S.
 *  military work; …)" → "Public domain". */
const shortLicense = (license: string) => license.split(' (')[0].trim();

/** The credit as one line can carry it: the first clause, then without a
 *  trailing parenthetical, then the first comma-part — only as far as needed. */
function shortCredit(credit: string) {
  // A © notice is attribution a licence requires (e.g. Copernicus EMS with
  // its OpenStreetMap base): keep it whole, up to its first semicolon.
  if (credit.includes('©')) return credit.split(';')[0].trim();
  let s = credit.split(/;|: /)[0].trim();
  if (s.length > 52) s = s.replace(/\s*\([^)]*\)\s*$/, '');
  if (s.length > 52) s = s.split(', ')[0];
  return s;
}

function Figure({ scenario, m }: { scenario: Scenario; m: MediaAttachment }) {
  const base = `/control-room/${scenario.id}/`;
  const ratio = { aspectRatio: `${m.width} / ${m.height}` };
  const credit = shortCredit(m.credit);
  const license = shortLicense(m.license);
  const folded = credit !== m.credit || license !== m.license;
  return (
    <figure className={`cr-figure cr-figure-${m.type}`}>
      <div className="cr-figure-frame">
        {m.type === 'image' ? (
          // eslint-disable-next-line @next/next/no-img-element -- served byte-for-byte as licence-vetted, not re-encoded
          <img src={base + m.file} alt={m.caption} width={m.width} height={m.height} style={ratio}
            loading="lazy" decoding="async" />
        ) : (
          <video src={base + m.file} poster={m.poster ? base + m.poster : undefined} width={m.width} height={m.height} style={ratio}
            controls preload="none" playsInline aria-label={m.caption} />
        )}
      </div>
      <figcaption>
        <span className="cr-figure-caption">{m.caption}</span>
        <span className="cr-figure-credit">
          <span className={`cr-figure-by${credit.includes('©') ? ' is-notice' : ''}`} title={m.credit}>{credit}</span>
          <span className="cr-figure-sep" aria-hidden> · </span>
          <a href={m.licenseUrl ?? m.sourcePage} title={m.license}>{license}</a>
          {m.licenseUrl ? <><span className="cr-figure-sep" aria-hidden> · </span><a href={m.sourcePage}>Source</a></> : null}
          {folded && (
            <details className="cr-figure-terms">
              <summary><span className="cr-figure-sep" aria-hidden> · </span><span className="cr-figure-terms-label">Terms</span></summary>
              <span className="cr-figure-terms-body">
                <span><b>Credit</b> {m.credit}</span>
                <span><b>Licence</b> {m.license}</span>
              </span>
            </details>
          )}
        </span>
      </figcaption>
    </figure>
  );
}

/** Phones, debrief only: the after-the-clock imagery as a two-up contact
 *  sheet. Each plate is a disclosure — its thumbnail and short label are the
 *  summary; opening it prints the full figure (caption, credit, licence)
 *  across both columns, in place. No lightbox, no dependency; the summary's
 *  label names the plate, and the full caption is the opened figure's. */
/** A plate's short label: the caption's lead clause (usually its date and
 *  place — "9 August, Upcountry Maui"), never a dangling parenthesis. CSS
 *  clamps it to three lines; the full caption is in the opened plate. */
function plateLabel(caption: string) {
  let s = caption.split(/:\s|\.\s|\s—\s/)[0];
  const open = s.lastIndexOf('(');
  if (open > 0 && s.indexOf(')', open) < 0) s = s.slice(0, open).trim();
  return s.replace(/[,;]$/, '');
}

function ContactSheet({ scenario, media }: { scenario: Scenario; media: MediaAttachment[] }) {
  const base = `/control-room/${scenario.id}/`;
  return (
    <div className="cr-contact">
      {media.map((m, i) => {
        const thumb = m.type === 'image' ? m.file : m.poster;
        const label = plateLabel(m.caption);
        return (
          <details key={m.file} className="cr-plate">
            <summary>
              <span className="cr-plate-thumb">
                {thumb ? (
                  // eslint-disable-next-line @next/next/no-img-element -- same vetted file as the plate, not re-encoded
                  <img src={base + thumb} alt="" loading="lazy" decoding="async" width={m.width} height={m.height} />
                ) : <span className="cr-plate-blank" />}
                {m.type === 'video' && <span className="cr-plate-play" aria-hidden>▶</span>}
              </span>
              <span className="cr-plate-label">
                <span className="cr-plate-num">Plate {i + 1}{m.type === 'video' ? ' · clip' : ''}</span>
                <span className="cr-plate-what">{label}</span>
              </span>
              <span className="cr-plate-toggle" aria-hidden />
            </summary>
            <Figure scenario={scenario} m={m} />
          </details>
        );
      })}
    </div>
  );
}

/* ── Citations ───────────────────────────────────────────────────────────── */

/** The numbered source list every [n] in the log points at. Rendered once:
 *  under the log during play, inside the debrief at the end. */
function Sources({ scenario, title }: { scenario: Scenario; title: string }) {
  return (
    <div className="cr-sources">
      <h3 className="cr-dsec-title">{title}</h3>
      <ol>
        {scenario.sources.map((s, i) => (
          <li key={s.id} id={`src-${s.id}`}>
            <span className="cr-src-num">[{i + 1}]</span> {s.label}
            {s.url ? <> — <a href={s.url}>{s.url}</a></> : null}
            {s.note ? <span className="cr-src-note"> {s.note}</span> : null}
          </li>
        ))}
      </ol>
    </div>
  );
}

function useSourceIndex(scenario: Scenario) {
  return useMemo(() => new Map(scenario.sources.map((s, i) => [s.id, i + 1])), [scenario]);
}

function Cite({ c, idx }: { c: Citation; idx: Map<string, number> }) {
  const n = idx.get(c.sourceId);
  if (!n) return null;
  return (
    <sup className="cr-cite">
      <a href={`#src-${c.sourceId}`} title={c.detail ?? c.sourceId} aria-label={`Source ${n}`}>[{n}]</a>
    </sup>
  );
}
