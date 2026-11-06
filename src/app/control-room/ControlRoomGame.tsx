'use client';

import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import type { Citation, Option, Scenario, ScenarioBundle, Timestep } from './types';
import { startSession, logChoice, completeSession, type ChoiceEvent } from './telemetry';
import { scoreRun, historicalLeadTime, formatLead, type Choice } from './scoring';
import DayStrip from './DayStrip';
import OpsMap, { STATE_LABEL, type ZoneState } from './OpsMap';
import AlertTimingChart from './AlertTimingChart';
import { KindGlyph, HazardGlyph } from './glyphs';

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
 * revealed (forecast → watch, gauge → signal, field report → flooding) and
 * the zones the player's own choices have warned.
 */
const KIND_STATE: Partial<Record<string, ZoneState>> = { forecast: 'watch', gauge: 'signal', field_report: 'flooding' };
const STATE_RANK: Record<ZoneState, number> = { quiet: 0, watch: 1, signal: 2, flooding: 3 };

function deriveBoard(scenario: Scenario, uptoIndex: number, choices: Choice[]) {
  const zoneStates: Record<string, ZoneState> = {};
  for (const t of scenario.timesteps.slice(0, uptoIndex + 1)) {
    for (const info of t.info_available) {
      const state = KIND_STATE[info.kind];
      if (!state) continue;
      for (const z of info.zones ?? []) {
        if (STATE_RANK[state] > STATE_RANK[zoneStates[z] ?? 'quiet']) zoneStates[z] = state;
      }
    }
  }
  const warnedZones = new Set<string>();
  for (const c of choices) warnedBy(scenario, c.option).forEach((z) => warnedZones.add(z));
  return { zoneStates, warnedZones: Array.from(warnedZones) };
}

function warnedBy(scenario: Scenario, option: Option): string[] {
  const e = option.effects;
  if (e.warning_scope === 'province') return scenario.scoring.at_risk_zones.map((z) => z.id);
  if (e.warning_scope === 'targeted' || e.protective) return e.zones;
  return [];
}

const KIND_LABEL: Record<string, string> = {
  forecast: 'Forecast',
  gauge: 'Gauge',
  message: 'Message',
  media: 'Media',
  field_report: 'From the field',
};

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

  return (
    <div className="cr-run">
      <Console scenario={scenario} started={started} cursor={cursor} choices={choices} done={done}
        board={board} showMapButton={!wide} />

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
              onChoose={choose}
              onAdvance={advance}
            />
          ))}
        </div>

        {wide && <SidePanel scenario={scenario} board={board} choices={choices} started={started} />}
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

function Console({ scenario, started, cursor, choices, done, board, showMapButton }: {
  scenario: Scenario; started: boolean; cursor: number; choices: Choice[]; done: boolean;
  board: ReturnType<typeof deriveBoard>; showMapButton: boolean;
}) {
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
          aria-label={`${time} ${scenario.clock.timezone}, ${status}. Jump to the desk.`}>
          <span className="cr-console-time">{time}</span>
          <span className="cr-console-status">{scenario.clock.timezone} · {status}</span>
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
          <OpsMap scenario={scenario} zoneStates={board.zoneStates} warnedZones={board.warnedZones} />
          <BoardList scenario={scenario} board={board} />
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
  return (
    <ul className="cr-boardlist">
      {scenario.scoring.at_risk_zones.map((z) => {
        const s = board.zoneStates[z.id] ?? 'quiet';
        const warned = board.warnedZones.includes(z.id);
        return (
          <li key={z.id} className={`is-${s}`}>
            <span className="cr-boardlist-zone">{z.label}</span>
            <span className="cr-boardlist-state">{STATE_LABEL[s]}{warned ? ' · warned by you' : ''}</span>
          </li>
        );
      })}
    </ul>
  );
}

/* ── Wide screens: the board and your run, alongside the log ────────────── */

function SidePanel({ scenario, board, choices, started }: {
  scenario: Scenario; board: ReturnType<typeof deriveBoard>; choices: Choice[]; started: boolean;
}) {
  return (
    <aside className="cr-side" aria-label="Situation board and your run">
      <p className="cr-side-head">Situation board</p>
      <OpsMap scenario={scenario} zoneStates={board.zoneStates} warnedZones={board.warnedZones} />
      <BoardList scenario={scenario} board={board} />
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
            <HazardGlyph hazard={s.hazard} size={26} className="cr-card-glyph" />
            <span className="cr-card-date">{s.date} · {s.hazard}</span>
            <span className="cr-card-title">{s.title}</span>
            <span className="cr-card-loc">{s.location}</span>
            <span className="cr-card-meta">{s.timesteps.length} decisions · {s.clock.start}–{s.clock.end} {s.clock.timezone}</span>
            <span className="cr-card-cta">Take the desk →</span>
          </button>
        ))}
        {bundle.stubs.map((s) => (
          <div key={s.id} className="cr-card cr-card-stub" aria-disabled>
            <HazardGlyph hazard={s.hazard} size={26} className="cr-card-glyph" />
            <span className="cr-card-date">{s.date} · {s.hazard}</span>
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
  return (
    <article id="cr-briefing" className="cr-entry cr-entry-brief" aria-labelledby="cr-brief-title">
      <p className="cr-stamp">
        <span className="cr-stamp-time">{scenario.clock.start}</span>
        <span className="cr-stamp-meta">{scenario.clock.timezone} · {scenario.date} · Briefing</span>
      </p>
      <h2 id="cr-brief-title" className="cr-brief-title" tabIndex={-1}>{scenario.title}</h2>
      <p className="cr-brief">{scenario.location}. You hold the civil-protection desk. You will see only what
        officials could see at each moment — forecasts, gauge readings, messages — and choose what to do.
        The clock then advances along the real timeline: <strong>history does not branch here</strong>. Each
        call you make stays in this log; at the end, it is set beside what officials actually did and what the
        inquiry found. Where you leave the historical path, the record is silent about what would have
        followed — and the log will say so rather than invent it.</p>
      <p className="cr-brief-count">{scenario.timesteps.length} decision points, from {scenario.clock.start} {scenario.clock.timezone}.
        The console above keeps the clock and your progress.</p>
      {inlineMap && !started && (
        <OpsMap scenario={scenario} zoneStates={{}} warnedZones={[]} />
      )}
      {started ? (
        <p className="cr-brief-taken">Desk taken at {scenario.clock.start} {scenario.clock.timezone}.</p>
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

function StepEntry({ scenario, t, index, choice, isCurrent, isLast, onChoose, onAdvance }: {
  scenario: Scenario; t: Timestep; index: number; choice?: Choice;
  isCurrent: boolean; isLast: boolean; onChoose: (o: Option) => void; onAdvance: () => void;
}) {
  const sourceIndex = useSourceIndex(scenario);
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

  return (
    <article id={id} className={`cr-entry${isCurrent ? ' is-current' : ''}`} aria-labelledby={`${id}-h`}>
      <h3 id={`${id}-h`} className="cr-stamp" tabIndex={-1}>
        <span className="cr-stamp-time">{stamp(t)}</span>
        <span className="cr-stamp-meta">
          {scenario.clock.timezone}
          {t.time_label !== t.time && t.time_label !== stamp(t) ? ` · ${t.time_label}` : ''}
          {' · '}Decision {index + 1} of {scenario.timesteps.length}
        </span>
      </h3>

      <ul className="cr-dispatches" aria-label={`Incoming at ${stamp(t)}`}>
        {t.info_available.map((info, i) => (
          <li key={info.id} className={`cr-slip cr-slip-${info.kind}`} style={{ '--i': i } as React.CSSProperties}>
            <p className="cr-slip-kind"><KindGlyph kind={info.kind} className="cr-kind-glyph" /> {KIND_LABEL[info.kind]}</p>
            <p className="cr-slip-text">{info.text} <Cite c={info.citation} idx={sourceIndex} /></p>
          </li>
        ))}
      </ul>

      {changes.length > 0 && (
        <p className="cr-boardline" style={{ '--i': t.info_available.length } as React.CSSProperties}>
          <span className="cr-boardline-tag">Board</span>
          {changes.map((c, i) => (
            <Fragment key={c.label}>
              {i > 0 && <span aria-hidden> · </span>}
              <span>{c.label} → <strong>{STATE_LABEL[c.state]}</strong></span>
            </Fragment>
          ))}
        </p>
      )}

      {choice ? (
        <CallRecord scenario={scenario} t={t} choice={choice} sourceIndex={sourceIndex} />
      ) : (
        <div className="cr-call" role="group" aria-labelledby={`${id}-call`}
          style={{ '--i': t.info_available.length + 1 } as React.CSSProperties}>
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
            {isLast ? 'Close the log — to the debrief ↓' : 'Advance the clock ↓'}
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
            <span className="cr-taken-mark">{o.id === choice.option.id ? 'Your call' : 'Not taken'}</span>
            <span className="cr-taken-label">{o.label}</span>
          </li>
        ))}
      </ul>
      {warned.length > 0 && (
        <p className="cr-boardline cr-boardline-you">
          <span className="cr-boardline-tag">Board</span>
          Marked warned by you: {warned.map(zoneLabel).join(' · ')}
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
  const d = scenario.outcome.deaths;

  return (
    <section id="cr-debrief" className="cr-debrief" aria-labelledby="cr-debrief-title">
      <div className="cr-endband">
        <div className="wrap">
          <p className="cr-endband-stamp">
            <span>{scenario.clock.end} {scenario.clock.timezone}</span>
            <span>End of record</span>
          </p>
          <h2 id="cr-debrief-title" className="cr-endband-title" tabIndex={-1}>
            Debrief — {scenario.title}, {scenario.date}
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
                  <span className="cr-vs-time">{stamp(t)}</span>
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
              <dt>Coverage of at-risk basins</dt>
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
