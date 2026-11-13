'use client';

/**
 * The reckoning: the debrief's centerpiece. Three lanes on the day's own
 * clock — YOU, THE RECORD, THE EARLIEST DEFENSIBLE — each with its first
 * warning and a bar measuring the minutes between that warning and the
 * documented impact. Below: the same, zone by zone; the benchmark's cited
 * basis; the cited context on why minutes matter; and a per-decision ladder
 * setting your call beside the record's on the dimensions the scenario data
 * already codes (warning scope, zones reached, false-alarm weight).
 *
 * Every number on this panel is arithmetic on a cited clock time already in
 * the scenario, or a value an option already carries. Nothing converts the
 * minutes into lives: the record is silent on the paths not taken, and the
 * panel says so. The benchmark is game design, authored in the scenario data
 * and gated by the build against the slip it rests on (README, "The
 * reckoning"); the panel labels it as a hypothesis, not a verdict.
 *
 * Shape, not colour, carries the lane: you a filled disc, the record a filled
 * square, the benchmark a hollow diamond on a dashed rail. Ember marks only
 * the impact window, a status rather than a series. Each lane's bar grows
 * out of the impact line (350 ms, staggered); under reduced motion the bars
 * arrive set and are struck twice out of register instead, as elsewhere in
 * the Control Room.
 */
import type { ReactNode } from 'react';
import type { Citation, Option, Scenario } from './types';
import { alertBeforeClock, reckon, reached, scopeRank, span, type Choice, type LaneMark } from './scoring';

const minutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};
const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

type Cite = (c: Citation) => ReactNode;

/** "3 h 25 min before impact", "at the moment of impact", "never". */
function leadWords(l: LaneMark) {
  if (l.lead === null) return { big: 'Never', sub: 'no warning on this clock' };
  if (l.lead === 0) return { big: 'At impact', sub: 'the moment of impact' };
  return { big: span(l.lead), sub: l.lead > 0 ? 'before impact' : 'after impact' };
}

export default function Reckoning({ scenario, choices, compact, cite }: {
  scenario: Scenario; choices: Choice[]; compact: boolean; cite: Cite;
}) {
  const r = reckon(scenario, choices);
  const early = alertBeforeClock(scenario);
  const approx = (t: string | null) => !!t && scenario.timesteps.some((s) => s.time === t && s.approx);
  const at = (t: string | null) => (t ? `${approx(t) ? '≈' : ''}${t}` : '—');
  const zoneLabel = (id: string) => scenario.warning_chain?.zones?.[id] ?? scenario.scoring.at_risk_zones.find((z) => z.id === id)?.label ?? id;

  const you = leadWords(r.you);
  const rec = leadWords(r.record);
  const ben = leadWords(r.bench);

  // The verdict, in words: two comparisons against the benchmark.
  const youLine = r.you.time === null
    ? 'You sent no warning on this clock.'
    : r.youVsBench === null ? ''
      : r.youVsBench > 0
        ? `Your first warning went out ${span(r.youVsBench)} before the benchmark: earlier than this reading of the desk's record can justify, which is what the false-alarm score weighs.`
        : r.youVsBench === 0
          ? 'Your first warning landed on the benchmark.'
          : `Your first warning came ${span(r.youVsBench)} after the benchmark.`;
  const recordLine = r.recordMetMark
    ? `The record met the benchmark${r.recordVsBench ? `, ${span(r.recordVsBench)} ahead of it` : ''}${early ? `, and its public warnings had begun ${early.span} this clock opened` : ''}. Here the officials were early.`
    : r.recordVsBench === null ? '' : `The record's first warning came ${span(r.recordVsBench)} after it.`;

  return (
    <div className={`cr-dsec cr-rk${r.recordMetMark ? ' is-met' : ''}`} aria-labelledby="cr-rk-title">
      <h3 id="cr-rk-title" className="cr-dsec-title">The reckoning</h3>
      <p className="cr-rk-dek">
        Minutes and scope on the day&apos;s own clock: when you first warned, when the record first warned, and the
        earliest call this desk&apos;s own record could justify, each measured to the documented impact at{' '}
        {r.impact} ({scenario.scoring.impact.label} {cite(scenario.scoring.impact.citation)}). Arithmetic on cited
        times. No figure here counts lives.
      </p>

      <dl className="cr-rk-figs">
        <div className="cr-rk-fig is-you">
          <dt><Glyph kind="you" /> Your first warning</dt>
          <dd className="cr-rk-big">{you.big}</dd>
          <dd className="cr-rk-sub">{you.sub}{r.you.time ? ` · at ${at(r.you.time)} · ${r.you.scope}` : ''}</dd>
        </div>
        <div className="cr-rk-fig is-record">
          <dt><Glyph kind="record" /> The record&apos;s first warning</dt>
          <dd className="cr-rk-big">{approx(r.record.time) && r.record.lead !== null ? '≈' : ''}{rec.big}</dd>
          <dd className="cr-rk-sub">
            {rec.sub} · at {at(r.record.time)}
            {early ? <> · {early.clock_alert}; public warnings began {early.span} this clock, on {early.longDate}</> : null}
          </dd>
          {r.recordMetMark && <dd className="cr-rk-stamp">Met the mark</dd>}
        </div>
        <div className="cr-rk-fig is-bench">
          <dt><Glyph kind="bench" /> The earliest defensible</dt>
          <dd className="cr-rk-big">{ben.big}</dd>
          <dd className="cr-rk-sub">{ben.sub} · at {at(r.bench.time)} · game-design benchmark</dd>
        </div>
      </dl>
      <p className="cr-rk-verdict">{youLine} {recordLine}</p>

      <Lanes scenario={scenario} choices={choices} compact={compact} r={r} early={early} at={at} />

      <div className="cr-rk-pair">
        <div className="cr-rk-bench">
          <p className="cr-rk-tag">A game-design benchmark</p>
          <p className="cr-rk-bench-lede">
            The earliest call this desk&apos;s own record could justify — a hypothesis, not a verdict. Each call rests
            on one slip, at or after the decision point where that slip reached the desk; the build refuses one that
            would act on information not yet on it, or that prints a figure its slip does not.
          </p>
          <ol className="cr-rk-calls">
            {r.calls.map((c, i) => {
              const step = scenario.timesteps.find((t) => t.info_available.some((x) => x.id === c.from));
              const opt = scenario.timesteps.find((t) => t.time === c.time)?.options.find((o) => o.id === c.option);
              return (
                <li key={i}>
                  <span className="cr-rk-call-time">{at(c.time)}</span>
                  <div>
                    <p className="cr-rk-call-basis">{c.basis} {cite(c.citation)}</p>
                    <p className="cr-rk-call-meta">
                      {c.zones.map(zoneLabel).join(' · ')}
                      {step ? ` · slip on the desk at ${at(step.time)}` : ''}
                      {opt ? ` · the call: “${opt.label}”` : ''}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
          {early && (
            <p className="cr-rk-note">
              The benchmark is set on this clock only and cannot see before it. The record&apos;s public warnings began
              on {early.longDate}, {early.span} this clock opened; <a href="#cr-early">see the note under the scores</a>.
            </p>
          )}
        </div>
        <MinutesMatter scenario={scenario} cite={cite} />
      </div>

      <ZoneTable r={r} at={at} zoneLabel={zoneLabel} />
      <Ladder ladder={r.ladder} total={scenario.scoring.at_risk_zones.length} scenario={scenario} />

      <p className="cr-rk-silent">
        <strong>The record is silent</strong> on what an earlier warning would have changed. The game does not
        estimate lives saved, and none of these minutes is one.
      </p>
    </div>
  );
}

function Glyph({ kind, size = 12 }: { kind: 'you' | 'record' | 'bench'; size?: number }) {
  return (
    <svg className={`cr-rk-glyph is-${kind}`} viewBox="0 0 12 12" width={size} height={size} aria-hidden>
      {kind === 'you' && <circle cx="6" cy="6" r="4.6" />}
      {kind === 'record' && <rect x="1.6" y="1.6" width="8.8" height="8.8" />}
      {kind === 'bench' && <path d="M6 0.9 11.1 6 6 11.1 0.9 6Z" />}
    </svg>
  );
}

/* ── The lanes ──────────────────────────────────────────────────────────── */

type R = ReturnType<typeof reckon>;

function Lanes({ scenario, choices, compact, r, early, at }: {
  scenario: Scenario; choices: Choice[]; compact: boolean; r: R;
  early: ReturnType<typeof alertBeforeClock>; at: (t: string | null) => string;
}) {
  const W = compact ? 360 : 720;
  const PAD = { left: compact ? 14 : 22, right: compact ? 14 : 22 };
  const TOP = 40;
  const GAP = compact ? 62 : 58;
  const lanes = [
    { key: 'you', name: 'YOU', mark: r.you },
    { key: 'record', name: 'THE RECORD', mark: r.record },
    { key: 'bench', name: compact ? 'EARLIEST DEFENSIBLE' : 'EARLIEST DEFENSIBLE · GAME DESIGN', mark: r.bench },
  ] as const;
  const laneY = (i: number) => TOP + 34 + i * GAP;
  const axisY = laneY(2) + 30;
  const H = axisY + 26;

  const impact = minutes(r.impact);
  const win = r.window ?? 0;
  // Warnings before the clock get an hour of axis to point back from.
  const t0 = Math.floor(minutes(scenario.clock.start) / 60) * 60 - (early ? 60 : 0);
  const t1 = Math.ceil(Math.max(minutes(scenario.clock.end), impact + Math.max(win, 30)) / 60) * 60;
  const x = (m: number) => PAD.left + ((m - t0) / (t1 - t0)) * (W - PAD.left - PAD.right);
  const xi = x(impact);
  const labelEvery = compact ? 3 : 2;
  const hours: number[] = [];
  for (let m = t0; m <= t1; m += 60) hours.push(m);

  const benchX = r.bench.time ? x(minutes(r.bench.time)) : null;
  const label = (m: LaneMark) => {
    if (m.lead === null) return '';
    if (m.lead === 0) return 'AT IMPACT';
    return `${span(m.lead).toUpperCase()} ${m.lead > 0 ? 'BEFORE' : 'AFTER'}`;
  };

  const aria = [
    `Impact at ${r.impact}${win ? `, window of ${win} minutes` : ''}.`,
    `You: ${r.you.time ? `first warning at ${r.you.time}, ${leadWords(r.you).big} ${leadWords(r.you).sub}` : 'no warning'}.`,
    `The record: first warning at ${r.record.time}, ${leadWords(r.record).big} ${leadWords(r.record).sub}${early ? `; public warnings began ${early.span} this clock, on ${early.longDate}` : ''}.`,
    `Earliest defensible (game-design benchmark): ${r.bench.time}, ${leadWords(r.bench).big} ${leadWords(r.bench).sub}.`,
  ].join(' ');

  return (
    <figure className={`cr-rk-lanes${compact ? ' is-compact' : ''}`}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={aria}>
        <defs>
          <pattern id="cr-rk-hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="5" className="cr-rk-hatch-line" />
          </pattern>
        </defs>
        {/* impact: the fixed vertical reference every bar is measured to */}
        {win > 0 && <rect className="cr-rk-window" x={xi} y={TOP} width={x(impact + win) - xi} height={axisY - TOP} />}
        <line className="cr-rk-impact" x1={xi} y1={TOP - 4} x2={xi} y2={axisY} />
        <text className="cr-rk-impact-label" x={xi} y={TOP - 10} textAnchor={xi > W * 0.8 ? 'end' : 'middle'}>
          {`IMPACT ${r.impact}${win ? ` · ${win} MIN WINDOW` : ''}`}
        </text>
        {/* the benchmark, carried up through every lane as a dashed guide */}
        {benchX !== null && (
          <line className="cr-rk-guide" x1={benchX} y1={TOP + 8} x2={benchX} y2={axisY} />
        )}

        {lanes.map((ln, i) => {
          const y = laneY(i);
          const m = ln.mark;
          const mx = m.time ? x(minutes(m.time)) : null;
          const before = m.lead !== null && m.lead > 0;
          const bx = mx === null ? 0 : Math.min(mx, xi);
          const bw = mx === null ? 0 : Math.abs(xi - mx);
          const text = label(m);
          // The lead label sits at the impact end of its bar, clear of the lane
          // name; a bar too short to hold it puts it beyond the mark, or, with
          // no room there, on the other side of the impact line.
          const tw = text.length * (compact ? 7.4 : 6.6) + 12;
          const fits = bw > tw;
          const roomBeyond = mx !== null && (before ? mx - PAD.left - 110 : W - PAD.right - mx) > tw;
          const lab = fits
            ? { x: before ? xi - 6 : xi + 6, anchor: before ? 'end' : 'start' }
            : roomBeyond
              ? { x: before ? (mx as number) - 12 : (mx as number) + 12, anchor: before ? 'end' : 'start' }
              : { x: before ? xi + 8 : xi - 8, anchor: before ? 'start' : 'end' };
          return (
            <g key={ln.key} className={`cr-rk-lane is-${ln.key}`} style={{ ['--i' as string]: i }}>
              <text className="cr-rk-lane-name" x={PAD.left} y={y - 16}>{ln.name}</text>
              <line className="cr-rk-rail" x1={PAD.left} y1={y} x2={W - PAD.right} y2={y} />
              {ln.key === 'you' && choices.map((c) => {
                const cx = x(minutes(c.timestep.time));
                return <circle key={c.timestep.id} className="cr-rk-step" cx={cx} cy={y} r={3} />;
              })}
              {ln.key === 'record' && early && (
                <g className="cr-rk-early">
                  <path d={`M${x(t0 + 60) - 10} ${y}H${PAD.left}M${PAD.left + 6} ${y - 5}L${PAD.left} ${y}L${PAD.left + 6} ${y + 5}`} />
                  <text x={(m.time ? x(minutes(m.time)) : PAD.left) + 30} y={y + 22}>{`FROM ${early.short} · ${early.days === 1 ? '1 DAY' : `${early.days} DAYS`} EARLIER`}</text>
                </g>
              )}
              {mx !== null && bw > 0 && (
                <rect className={`cr-rk-bar${before ? ' is-before' : ' is-after'}`} x={bx} y={y - 5} width={bw} height={10}
                  fill={ln.key === 'bench' ? 'url(#cr-rk-hatch)' : undefined} />
              )}
              {mx !== null && text && (
                <text className="cr-rk-bar-label" x={lab.x} y={y - 10} textAnchor={lab.anchor as 'start' | 'end'}>{text}</text>
              )}
              {mx !== null && (
                <g className="cr-rk-mark">
                  <circle className="cr-rk-ring" cx={mx} cy={y} r={9} />
                  {ln.key === 'you' && <circle className="cr-rk-dot" cx={mx} cy={y} r={6.5} />}
                  {ln.key === 'record' && <rect className="cr-rk-dot" x={mx - 6} y={y - 6} width={12} height={12} />}
                  {ln.key === 'bench' && <path className="cr-rk-dot" d={`M${mx} ${y - 7.5}L${mx + 7.5} ${y}L${mx} ${y + 7.5}L${mx - 7.5} ${y}Z`} />}
                  <text className="cr-rk-mark-time" x={mx} y={y + 22} textAnchor="middle">{at(m.time)}</text>
                </g>
              )}
              {mx === null && (
                <text className="cr-rk-never" x={W - PAD.right} y={y - 10} textAnchor="end">NO WARNING SENT</text>
              )}
            </g>
          );
        })}

        <line className="cr-rk-axis" x1={PAD.left} y1={axisY} x2={W - PAD.right} y2={axisY} />
        {hours.map((m) => (
          <g key={m}>
            <line className="cr-rk-tick" x1={x(m)} y1={axisY} x2={x(m)} y2={axisY + ((m / 60) % labelEvery === 0 ? 5 : 3)} />
            {(m / 60) % labelEvery === 0 && (
              <text className="cr-rk-hour" x={x(m)} y={axisY + 18} textAnchor={x(m) < PAD.left + 16 ? "start" : x(m) > W - PAD.right - 16 ? "end" : "middle"}>{hhmm(m % 1440)}</text>
            )}
          </g>
        ))}
      </svg>
      <figcaption className="cr-rk-caption">
        Each bar runs from a lane&apos;s first warning to the impact line: left of the line is warning before impact,
        right of it is after. The dashed guide carries the benchmark up through your lane and the record&apos;s.
        {early ? ' The arrow on the record’s lane points to warnings issued before this clock opened.' : ''}
        {' '}Your small dots are your decision points.
      </figcaption>
    </figure>
  );
}

/* ── Zone by zone ───────────────────────────────────────────────────────── */

function ZoneTable({ r, at, zoneLabel }: { r: R; at: (t: string | null) => string; zoneLabel: (id: string) => string }) {
  const cell = (t: string | null, kind: 'you' | 'record' | 'bench') => (t
    ? <span className="cr-rk-z-time">{at(t)}</span>
    : <span className="cr-rk-z-none">{kind === 'bench' ? 'no call set' : kind === 'record' ? 'none at a decision point' : 'no warning'}</span>);
  return (
    <div className="cr-rk-zones">
      <p className="cr-rk-tag">Zone by zone · first warning reaching each, by decision time</p>
      <table>
        <thead>
          <tr>
            <th scope="col">Zone</th>
            <th scope="col"><Glyph kind="you" /> You</th>
            <th scope="col"><Glyph kind="record" /> Record</th>
            <th scope="col"><Glyph kind="bench" /> Benchmark</th>
          </tr>
        </thead>
        <tbody>
          {r.zones.map((z) => (
            <tr key={z.id}>
              <th scope="row">{zoneLabel(z.id)}</th>
              <td>{cell(z.you, 'you')}</td>
              <td>{cell(z.record, 'record')}</td>
              <td>{cell(z.bench, 'bench')}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="cr-rk-note">
        The record&apos;s column is the officials&apos; call at each decision point, as this log codes it; warnings
        they issued between or before the decision points are not in it, which is why a zone can read &ldquo;none at a decision point&rdquo; on a day the record did warn it. &ldquo;No call set&rdquo; means no single
        slip before the clock closed gives the benchmark grounds for that zone.
      </p>
    </div>
  );
}

/* ── Decision by decision ───────────────────────────────────────────────── */

const SCOPES = ['none', 'targeted', 'province'] as const;

function Meter({ kind, o, total }: { kind: 'scope' | 'zones' | 'weight'; o: Option | null; total: number }) {
  if (kind === 'scope') {
    const n = scopeRank(o);
    return <span className="cr-rk-meter is-scope">{[1, 2].map((k) => <i key={k} className={k <= n ? 'on' : ''} />)}</span>;
  }
  if (kind === 'zones') {
    const n = reached(o);
    return <span className="cr-rk-meter is-zones">{Array.from({ length: total }, (_, k) => <i key={k} className={k < n ? 'on' : ''} />)}</span>;
  }
  const w = o?.effects.false_alarm_weight ?? 0;
  return <span className="cr-rk-meter is-weight">{[0.5, 1, 1.5, 2].map((k) => <i key={k} className={k <= w ? 'on' : ''} />)}</span>;
}

function describe(o: Option | null, total: number) {
  if (!o) return 'no call';
  return `${o.effects.warning_scope} warning, ${reached(o)} of ${total} zones reached, false-alarm weight ${o.effects.false_alarm_weight}`;
}

function Ladder({ ladder, total, scenario }: { ladder: R['ladder']; total: number; scenario: Scenario }) {
  const same = ladder.filter((s) => s.same).length;
  const stamp = (time: string) => `${scenario.timesteps.find((t) => t.time === time)?.approx ? '≈' : ''}${time}`;
  return (
    <div className="cr-rk-ladder">
      <p className="cr-rk-tag">Decision by decision · your call beside the record&apos;s</p>
      <p className="cr-rk-note">
        On the three things each option codes: its warning scope (none, targeted, province-wide), the at-risk zones
        it reaches by warning or protective action, and its false-alarm weight (0 to 2, game design). Where you made
        the record&apos;s call, the pair fuses: {same} of {ladder.length} here.
      </p>
      <div className="cr-rk-rung cr-rk-rung-head" aria-hidden>
        <span>Time</span><span>Scope</span><span>Zones</span><span>False alarm</span>
      </div>
      <ol className="cr-rk-rungs">
        {ladder.map((s) => (
          <li key={s.id} className={`cr-rk-rung${s.same ? ' is-same' : ' is-apart'}`}>
            <span className="cr-rk-rung-time">{stamp(s.time)}</span>
            <span className="cr-sr">
              {s.same ? `You made the record's call: ${describe(s.you, total)}.` : `You: ${describe(s.you, total)}. The record: ${describe(s.record, total)}.`}
            </span>
            {(['scope', 'zones', 'weight'] as const).map((k) => (
              <span key={k} className={`cr-rk-pair-cell is-${k}`} aria-hidden>
                <span className="cr-rk-pair-row is-you"><Glyph kind="you" size={9} /><Meter kind={k} o={s.you} total={total} /></span>
                {!s.same && <span className="cr-rk-pair-row is-record"><Glyph kind="record" size={9} /><Meter kind={k} o={s.record} total={total} /></span>}
                {s.same && <span className="cr-rk-fused">same call</span>}
              </span>
            ))}
          </li>
        ))}
      </ol>
      <p className="cr-rk-key" aria-hidden>
        Upper row (disc) yours, lower row (square, lighter) the record’s · Scope: {SCOPES.map((x, i) => `${i} = ${x}`).join(' · ')} · Zones: one pip per at-risk zone · False alarm: one segment per 0.5
      </p>
    </div>
  );
}

/* ── Why minutes matter ─────────────────────────────────────────────────── */

function MinutesMatter({ scenario, cite }: { scenario: Scenario; cite: Cite }) {
  const m = scenario.scoring.minutes_matter;
  if (!m?.length) return null;
  return (
    <aside className="cr-rk-context" aria-labelledby="cr-rk-context-h">
      <p id="cr-rk-context-h" className="cr-rk-tag">Why minutes matter · context, not a calculation</p>
      <p className="cr-rk-context-lede">
        From other places and other days. These lines say why the minutes above are worth counting; nothing here
        converts this run&apos;s minutes into lives.
      </p>
      <ul>
        {m.map((e, i) => (
          <li key={i}>
            <p className="cr-rk-context-about">{e.about}</p>
            <blockquote><q>{e.quote}</q> {cite(e.citation)}</blockquote>
            {e.caveat && <p className="cr-rk-context-caveat">{e.caveat}</p>}
            <p className="cr-rk-context-cred">{e.publisher} · licence {e.license} · read {e.as_of}</p>
          </li>
        ))}
      </ul>
    </aside>
  );
}
