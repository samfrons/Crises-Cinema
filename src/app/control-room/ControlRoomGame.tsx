'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { Citation, MediaAttachment, Option, Scenario, ScenarioBundle, Timestep } from './types';
import { startSession, logChoice, completeSession, type ChoiceEvent } from './telemetry';
import { scoreRun, historicalLeadTime, formatLead, type Choice } from './scoring';
import DayStrip from './DayStrip';
import OpsMap from './OpsMap';
import { itemState, STATE_RANK, vocabFor, COMPASS_WORD, type ZoneState } from './hazards';
import AlertTimingChart from './AlertTimingChart';
import { KindGlyph, HazardGlyph, Pictogram, hasPictogram } from './glyphs';
import WarningChain, { chainChanges, chainNews, deriveChain } from './WarningChain';

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

/** The clock's zone as players read it: an IANA region ("Pacific/Honolulu")
 *  becomes its short name on the scenario's date ("HST"); a name that is
 *  already short ("CET") is shown as given. */
function tzLabel(s: Pick<Scenario, 'clock' | 'date'>) {
  const tz = s.clock.timezone;
  if (!tz.includes('/')) return tz;
  try {
    const part = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'short' })
      .formatToParts(new Date(`${s.date}T12:00:00Z`))
      .find((p) => p.type === 'timeZoneName')?.value;
    return part && !/^GMT/.test(part) ? part : tz;
  } catch {
    return tz;
  }
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
};

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

export default function ControlRoomGame({ bundle }: { bundle: ScenarioBundle }) {
  const [run, setRun] = useState<Run | null>(null);
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

  const pick = (scenario: Scenario) => {
    pending.current = { focus: 'cr-brief-title', scroll: 'desk' };
    setRun({ scenario, sessionId: null, cursor: 0, choices: [], presentedAt: 0, done: false });
  };

  if (!run) {
    return <SelectScreen bundle={bundle} onPick={pick} />;
  }

  const { scenario, sessionId, cursor, choices, done } = run;
  const started = sessionId !== null;
  const steps = scenario.timesteps;
  const current = steps[cursor];
  const lastIndex = steps.length - 1;
  const decided = choices.length > cursor;

  const start = () => {
    const session = startSession(scenario.id);
    pending.current = { focus: `${stepId(steps[0])}-h`, scroll: stepId(steps[0]) };
    setRun({ ...run, sessionId: session.sessionId, cursor: 0, presentedAt: Date.now() });
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
    pending.current = { focus: 'cr-advance-btn', scroll: `${stepId(current)}-record`, block: 'nearest' };
    setRun({ ...run, choices: [...choices, { timestep: current, option, event }] });
  };

  const advance = () => {
    if (!sessionId || !decided) return;
    if (cursor >= lastIndex) {
      completeSession(sessionId, scoreRun(scenario, choices));
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
    setRun({ scenario, sessionId: null, cursor: 0, choices: [], presentedAt: 0, done: false });
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
        live={live} showMapButton={!wide} />

      <div className="cr-play wrap">
        <div className="cr-log" role="log" aria-label="Dispatch log" aria-live="polite">
          <Briefing scenario={scenario} started={started} inlineMap={!wide} onStart={start} />

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
              onChoose={choose}
              onAdvance={advance}
            />
          ))}
        </div>

        {wide && <SidePanel scenario={scenario} live={live} choices={choices} started={started} />}
      </div>

      {done ? (
        <Debrief scenario={scenario} choices={choices} onReplay={replay} onLeave={leave} />
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

function Console({ scenario, started, cursor, choices, done, live, showMapButton }: {
  scenario: Scenario; started: boolean; cursor: number; choices: Choice[]; done: boolean;
  live: Live; showMapButton: boolean;
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
        <a className="cr-console-clock" href={`#${target}`}
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

function SidePanel({ scenario, live, choices, started }: {
  scenario: Scenario; live: Live; choices: Choice[]; started: boolean;
}) {
  return (
    <aside className="cr-side" aria-label="Situation board, warning chain and your run">
      <p className="cr-side-head">Situation board</p>
      <LiveBoard scenario={scenario} live={live} note={started ? undefined : boardNote(scenario)} />
      <BoardList scenario={scenario} board={live.board} />
      <p className="cr-side-head">Warning chain</p>
      <WarningChain scenario={scenario} snapshot={live.chain} fresh={live.chainFresh} />
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

function SelectScreen({ bundle, onPick }: { bundle: ScenarioBundle; onPick: (s: Scenario) => void }) {
  return (
    <section className="cr-select wrap" aria-labelledby="cr-select-title">
      <h2 id="cr-select-title" className="cr-section-eyebrow">Choose a day to hold the desk</h2>
      <div className="cr-select-grid">
        {bundle.playable.map((s) => (
          <button type="button" key={s.id} className="cr-card" onClick={() => onPick(s)}>
            <span className="cr-card-head">
              <HazardGlyph hazard={s.hazard} size={22} className="cr-card-glyph" />
              <span className="cr-card-date">{s.date} · {s.hazard}</span>
            </span>
            <span className="cr-card-title">{s.title}</span>
            <span className="cr-card-loc">{s.location}</span>
            <span className="cr-card-meta">{s.timesteps.length} decisions · {s.clock.start}–{s.clock.end} {tzLabel(s)}</span>
            <span className="cr-card-cta">Take the desk <span className="cr-card-arrow" aria-hidden>→</span></span>
          </button>
        ))}
        {bundle.stubs.map((s) => (
          <div key={s.id} className="cr-card cr-card-stub" aria-disabled>
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
      <p className="cr-footnote">Greyed scenarios exist only as schema: nothing appears here until every fact in
        them carries a source, and the build enforces it.</p>
    </section>
  );
}

/* ── Log entry 0: the briefing ───────────────────────────────────────────── */

function Briefing({ scenario, started, inlineMap, onStart }: {
  scenario: Scenario; started: boolean; inlineMap: boolean; onStart: () => void;
}) {
  const vocab = vocabFor(scenario);
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

function StepEntry({ scenario, t, index, choice, isCurrent, isLast, inlineChain, onChoose, onAdvance }: {
  scenario: Scenario; t: Timestep; index: number; choice?: Choice;
  isCurrent: boolean; isLast: boolean; inlineChain: boolean; onChoose: (o: Option) => void; onAdvance: () => void;
}) {
  const sourceIndex = useSourceIndex(scenario);
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

      <ul className="cr-dispatches" aria-label={`Incoming at ${stamp(t)}`}>
        {t.info_available.map((info, i) => (
          <li key={info.id} className={`cr-slip cr-slip-${info.kind}`} style={{ '--i': i } as React.CSSProperties}>
            <p className="cr-slip-kind">
              <KindGlyph kind={info.kind} className="cr-kind-glyph" /> {vocab.kindLabel[info.kind]}
              {hasPictogram(info.icon) && <Pictogram name={info.icon} size={22} className="cr-slip-pict" />}
            </p>
            <p className="cr-slip-text">{info.text} <Cite c={info.citation} idx={sourceIndex} /></p>
            {info.media && <Figure scenario={scenario} m={info.media} />}
          </li>
        ))}
      </ul>

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
          {chainAt && <WarningChain scenario={scenario} snapshot={chainAt.snap} fresh={chainAt.fresh} compact />}
        </div>
      )}

      {choice ? (
        <CallRecord scenario={scenario} t={t} choice={choice} sourceIndex={sourceIndex} />
      ) : (
        <div className="cr-call" role="group" aria-labelledby={`${id}-call`}
          style={{ '--i': slips + 2 } as React.CSSProperties}>
          <p id={`${id}-call`} className="cr-call-head">Your call · {stamp(t)}</p>
          <div className="cr-options">
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
        </div>
      )}
    </article>
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
          <p className="cr-consequence-tag">The record is silent</p>
          <p>No one took this path on the day, so no source can say what it would have changed. Your call is
            logged and scored; the clock moves on along the real timeline.</p>
        </div>
      )}
    </div>
  );
}

/* ── The last entry: the debrief ─────────────────────────────────────────── */

function Debrief({ scenario, choices, onReplay, onLeave }: {
  scenario: Scenario; choices: Choice[]; onReplay: () => void; onLeave: () => void;
}) {
  const sourceIndex = useSourceIndex(scenario);
  const score = useMemo(() => scoreRun(scenario, choices), [scenario, choices]);
  const histLead = historicalLeadTime(scenario);
  const compact = !useMedia('(min-width: 640px)');
  const vocab = vocabFor(scenario);
  const d = scenario.outcome.deaths;

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
          <ol className="cr-vs">
            {scenario.timesteps.map((t) => {
              const c = choices.find((x) => x.timestep.id === t.id);
              const h = scenario.historical_path.find((x) => x.timestep_id === t.id);
              const diverged = !!c?.event.divergedFromHistory;
              return (
                <li key={t.id} className={diverged ? 'is-diverged' : ''}>
                  <span className="cr-vs-time">
                    <span className="cr-vs-stamp">{stamp(t)}</span>
                    <span className="cr-vs-icons" aria-hidden>
                      {stepIcons(t).map((name) => <Pictogram key={name} name={name} size={18} />)}
                    </span>
                  </span>
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
                  <div className="cr-vs-they">
                    <span className="cr-vs-who">They</span>
                    <span>{h ? <>{h.action} <Cite c={h.citation} idx={sourceIndex} /></> : 'The record does not say.'}</span>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>

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
          <dl className="cr-score-grid">
            <div>
              <dt>Warning lead time</dt>
              <dd className="big">{formatLead(score.leadTimeMinutes)}</dd>
              <dd className="sub">officials: {formatLead(histLead)} (first alert {scenario.scoring.historical_first_public_alert})</dd>
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
              <li key={i} className={f.kind === 'verbatim' ? 'is-verbatim' : ''}>
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
      </div>
    </section>
  );
}

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
