'use client';

import { useMemo, useRef, useState } from 'react';
import type { Citation, Option, Scenario, ScenarioBundle, Timestep } from './types';
import { startSession, logChoice, completeSession, type ChoiceEvent } from './telemetry';
import { scoreRun, historicalLeadTime, formatLead, type Choice } from './scoring';

const KIND_LABEL: Record<string, string> = {
  forecast: 'Forecast',
  gauge: 'Gauge',
  message: 'Message',
  media: 'Media',
  field_report: 'From the field',
};

type Phase =
  | { name: 'select' }
  | { name: 'briefing'; scenario: Scenario }
  | { name: 'deciding'; scenario: Scenario; step: number; sessionId: string; choices: Choice[]; presentedAt: number }
  | { name: 'aftermath'; scenario: Scenario; step: number; sessionId: string; choices: Choice[] }
  | { name: 'debrief'; scenario: Scenario; choices: Choice[] };

export default function ControlRoomGame({ bundle }: { bundle: ScenarioBundle }) {
  const [phase, setPhase] = useState<Phase>({ name: 'select' });

  if (phase.name === 'select') {
    return (
      <SelectScreen
        bundle={bundle}
        onPick={(scenario) => setPhase({ name: 'briefing', scenario })}
      />
    );
  }

  if (phase.name === 'briefing') {
    const { scenario } = phase;
    return (
      <section className="cr-stage wrap" aria-live="polite">
        <p className="cr-clock">
          <span className="cr-clock-time">{scenario.clock.start}</span>
          <span className="cr-clock-tz">{scenario.clock.timezone} · {scenario.date}</span>
        </p>
        <h2 className="cr-step-title">{scenario.title}</h2>
        <p className="cr-brief">{scenario.location}. You hold the civil-protection desk. You will see only what
          officials could see at each moment — forecasts, gauge readings, messages — and choose what to do.
          The clock then advances along the real timeline: <strong>history does not branch here</strong>. Your
          choices are recorded and, at the end, set beside what officials actually did and what the inquiry
          found. Where you leave the historical path, the record is silent about what would have followed —
          and the game will say so rather than invent it.</p>
        <button className="cr-btn cr-btn-primary" onClick={() => {
          const session = startSession(scenario.id);
          setPhase({ name: 'deciding', scenario, step: 0, sessionId: session.sessionId, choices: [], presentedAt: Date.now() });
        }}>
          Take the desk — {scenario.clock.start}
        </button>
      </section>
    );
  }

  if (phase.name === 'deciding') {
    const { scenario, step, sessionId, choices, presentedAt } = phase;
    const t = scenario.timesteps[step];
    return (
      <TimestepScreen
        scenario={scenario}
        t={t}
        step={step}
        onChoose={(option) => {
          const now = Date.now();
          const event: ChoiceEvent = {
            timestepId: t.id,
            optionId: option.id,
            presentedAt,
            chosenAt: now,
            hesitationMs: now - presentedAt,
            warningScope: option.effects.warning_scope,
            divergedFromHistory: t.historical_option_id !== null && option.id !== t.historical_option_id,
          };
          logChoice(sessionId, event);
          const next = [...choices, { timestep: t, option, event }];
          setPhase({ name: 'aftermath', scenario, step, sessionId, choices: next });
        }}
      />
    );
  }

  if (phase.name === 'aftermath') {
    const { scenario, step, sessionId, choices } = phase;
    const choice = choices[choices.length - 1];
    const last = step >= scenario.timesteps.length - 1;
    return (
      <AftermathScreen
        scenario={scenario}
        choice={choice}
        last={last}
        onAdvance={() => {
          if (last) {
            completeSession(sessionId, scoreRun(scenario, choices));
            setPhase({ name: 'debrief', scenario, choices });
          } else {
            setPhase({ name: 'deciding', scenario, step: step + 1, sessionId, choices, presentedAt: Date.now() });
          }
        }}
      />
    );
  }

  return (
    <DebriefScreen
      scenario={phase.scenario}
      choices={phase.choices}
      onRestart={() => setPhase({ name: 'select' })}
    />
  );
}

/* ── Select ──────────────────────────────────────────────────────────────── */

function SelectScreen({ bundle, onPick }: { bundle: ScenarioBundle; onPick: (s: Scenario) => void }) {
  return (
    <section className="cr-stage wrap">
      <p className="eyebrow">Choose a day to hold the desk</p>
      <div className="cr-select-grid">
        {bundle.playable.map((s) => (
          <button key={s.id} className="cr-card" onClick={() => onPick(s)}>
            <span className="cr-card-date">{s.date} · {s.hazard}</span>
            <span className="cr-card-title">{s.title}</span>
            <span className="cr-card-loc">{s.location}</span>
            <span className="cr-card-cta">Take the desk →</span>
          </button>
        ))}
        {bundle.stubs.map((s) => (
          <div key={s.id} className="cr-card cr-card-stub" aria-disabled>
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

/* ── Timestep ────────────────────────────────────────────────────────────── */

function TimestepScreen({ scenario, t, step, onChoose }: {
  scenario: Scenario; t: Timestep; step: number; onChoose: (o: Option) => void;
}) {
  const sourceIndex = useSourceIndex(scenario);
  return (
    <section className="cr-stage wrap" aria-live="polite">
      <p className="cr-clock">
        <span className="cr-clock-time">{t.approx ? '≈' : ''}{t.time}</span>
        <span className="cr-clock-tz">{scenario.clock.timezone} · step {step + 1} of {scenario.timesteps.length}</span>
      </p>
      {t.time_label !== t.time && <p className="cr-time-label">{t.time_label}</p>}

      <div className="cr-feed">
        {t.info_available.map((info) => (
          <article key={info.id} className={`cr-info cr-info-${info.kind}`}>
            <p className="cr-info-kind">{KIND_LABEL[info.kind]}</p>
            <p className="cr-info-text">{info.text} <Cite c={info.citation} idx={sourceIndex} /></p>
          </article>
        ))}
      </div>

      <p className="cr-prompt">Your call.</p>
      <div className="cr-options">
        {t.options.map((o) => (
          <button key={o.id} className="cr-btn cr-option" onClick={() => onChoose(o)}>
            <span className="cr-option-label">{o.label}</span>
            {o.detail && <span className="cr-option-detail">{o.detail}</span>}
          </button>
        ))}
      </div>
    </section>
  );
}

/* ── Aftermath of one choice ─────────────────────────────────────────────── */

function AftermathScreen({ scenario, choice, last, onAdvance }: {
  scenario: Scenario; choice: Choice; last: boolean; onAdvance: () => void;
}) {
  const sourceIndex = useSourceIndex(scenario);
  const c = choice.option.consequence;
  return (
    <section className="cr-stage wrap" aria-live="polite">
      <p className="cr-clock">
        <span className="cr-clock-time">{choice.timestep.approx ? '≈' : ''}{choice.timestep.time}</span>
        <span className="cr-clock-tz">{scenario.clock.timezone}</span>
      </p>
      <p className="cr-chosen">You chose: <strong>{choice.option.label}</strong></p>
      {c.known ? (
        <div className="cr-consequence">
          <p className="cr-consequence-tag">The record</p>
          <p>{c.text} <Cite c={c.citation} idx={sourceIndex} /></p>
        </div>
      ) : (
        <div className="cr-consequence cr-consequence-silent">
          <p className="cr-consequence-tag">The record is silent</p>
          <p>No one took this path on the day, so no source can say what it would have changed. Your choice is
            logged and scored; the clock moves on along the real timeline.</p>
        </div>
      )}
      <button className="cr-btn cr-btn-primary" onClick={onAdvance}>
        {last ? 'To the debrief →' : 'Advance the clock →'}
      </button>
    </section>
  );
}

/* ── Debrief ─────────────────────────────────────────────────────────────── */

function DebriefScreen({ scenario, choices, onRestart }: {
  scenario: Scenario; choices: Choice[]; onRestart: () => void;
}) {
  const sourceIndex = useSourceIndex(scenario);
  const score = useMemo(() => scoreRun(scenario, choices), [scenario, choices]);
  const histLead = historicalLeadTime(scenario);
  const d = scenario.outcome.deaths;

  return (
    <section className="cr-stage wrap cr-debrief" aria-live="polite">
      <p className="eyebrow">Debrief — {scenario.title}, {scenario.date}</p>
      <p className="cr-toll">
        <span className="cr-toll-number">{d.min === d.max ? d.min : `${d.min}–${d.max}`}</span>
        <span className="cr-toll-label">
          dead <Cite c={scenario.outcome.citation} idx={sourceIndex} />
          {d.contested && d.note ? <span className="cr-toll-note"> {d.note}</span> : null}
        </span>
      </p>

      <div className="cr-columns">
        <div className="cr-col">
          <h3 className="cr-col-title">You did</h3>
          <ol className="cr-col-list">
            {choices.map((c) => (
              <li key={c.timestep.id} className={c.event.divergedFromHistory ? 'cr-diverged' : ''}>
                <span className="cr-col-time">{c.timestep.approx ? '≈' : ''}{c.timestep.time}</span>
                <span className="cr-col-body">
                  {c.option.label}
                  <span className="cr-hesitation"> · decided in {Math.round(c.event.hesitationMs / 1000)}s{c.event.divergedFromHistory ? ' · off the historical path' : ''}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>
        <div className="cr-col">
          <h3 className="cr-col-title">They did</h3>
          <ol className="cr-col-list">
            {scenario.historical_path.map((h) => {
              const t = scenario.timesteps.find((x) => x.id === h.timestep_id);
              return (
                <li key={h.timestep_id}>
                  <span className="cr-col-time">{t ? `${t.approx ? '≈' : ''}${t.time}` : ''}</span>
                  <span className="cr-col-body">{h.action} <Cite c={h.citation} idx={sourceIndex} /></span>
                </li>
              );
            })}
          </ol>
        </div>
        <div className="cr-col">
          <h3 className="cr-col-title">The inquiry said</h3>
          <ol className="cr-col-list">
            {scenario.inquiry_findings.map((f, i) => (
              <li key={i}>
                <span className="cr-col-body">
                  {f.kind === 'verbatim' ? <q className="cr-verbatim">{f.quote}</q> : f.quote}
                  {f.translation ? <span className="cr-translation"> {f.translation}</span> : null}
                  {' '}<Cite c={f.citation} idx={sourceIndex} />
                  {f.kind === 'paraphrase' && <span className="cr-paraphrase-tag"> paraphrase</span>}
                </span>
              </li>
            ))}
          </ol>
        </div>
      </div>

      <div className="cr-score">
        <h3 className="cr-col-title">Your run, measured</h3>
        <p className="cr-score-caveat">A scoring layer, not history: it measures your choices against the real
          clock and the documented impact at {scenario.scoring.impact.time} ({scenario.scoring.impact.label}{' '}
          <Cite c={scenario.scoring.impact.citation} idx={sourceIndex} />). It makes no claim about lives a
          different decision would have saved — the record is silent on paths not taken.</p>
        <dl className="cr-score-grid">
          <div>
            <dt>Warning lead time</dt>
            <dd className="big">{formatLead(score.leadTimeMinutes)}</dd>
            <dd className="sub">officials: {formatLead(histLead)} (first alert {scenario.scoring.historical_first_public_alert})</dd>
          </div>
          <div>
            <dt>Coverage of at-risk basins</dt>
            <dd className="big">{Math.round(score.coverage * 100)}%</dd>
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
            <dd className="sub">decision points where you left the historical path</dd>
          </div>
        </dl>
      </div>

      <div className="cr-caveat">
        <p className="cr-consequence-tag">The state of the record</p>
        <p>{scenario.record_caveat}</p>
      </div>

      <div className="cr-sources">
        <h3 className="cr-col-title">Sources</h3>
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

      <button className="cr-btn cr-btn-primary" onClick={onRestart}>Back to the scenarios</button>
    </section>
  );
}

/* ── Citations ───────────────────────────────────────────────────────────── */

function useSourceIndex(scenario: Scenario) {
  const ref = useRef<Map<string, number> | null>(null);
  if (!ref.current) {
    ref.current = new Map(scenario.sources.map((s, i) => [s.id, i + 1]));
  }
  return ref.current;
}

function Cite({ c, idx }: { c: Citation; idx: Map<string, number> }) {
  const n = idx.get(c.sourceId);
  if (!n) return null;
  return (
    <sup className="cr-cite">
      <a href={`#src-${c.sourceId}`} title={c.detail ?? c.sourceId}>[{n}]</a>
    </sup>
  );
}
