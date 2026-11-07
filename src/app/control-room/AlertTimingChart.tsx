'use client';

/**
 * The debrief's one chart: a single shared time axis with two lanes — the
 * player's day above, the officials' below — against the documented impact
 * window. One axis, marks labelled in text as well as tone, ember reserved
 * for the impact band (a status, never a series). Everything drawn is either
 * the player's own log or a cited fact of the record.
 *
 * Craft notes: a key sits above the plate (shape, not colour, carries
 * warning / no warning); marks that fall close together keep a paper ring so
 * neither swallows the other; every mark has a hit target larger than itself
 * and a hover read-out. The "Your day beside theirs" list above the chart is
 * its table view, so the read-out is a pointer convenience, not the only way
 * in.
 */
import { useState } from 'react';
import type { Scenario } from './types';
import type { Choice } from './scoring';

const minutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};
const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

const PAD = { left: 24, right: 24, top: 34, bottom: 30 };
const LANE_YOU = 84;
const LANE_THEY = 134;

type Tip = { x: number; y: number; time: string; who: string; text: string; note: string };

/** `compact` redraws the plate at phone width (rather than shrinking the
 *  720-unit plate until its labels are unreadable): fewer hour labels,
 *  larger type, same marks. */
export default function AlertTimingChart({ scenario, choices, compact = false }: {
  scenario: Scenario; choices: Choice[]; compact?: boolean;
}) {
  const [tip, setTip] = useState<Tip | null>(null);
  const W = compact ? 360 : 720;
  const H = compact ? 200 : 196;
  const labelEvery = compact ? 3 : 2;
  const t0 = Math.floor(minutes(scenario.clock.start) / 60) * 60;
  const impactStart = minutes(scenario.scoring.impact.time);
  const window = scenario.scoring.impact.window_minutes ?? 60;
  const t1 = Math.ceil(Math.max(minutes(scenario.clock.end), impactStart + window) / 60) * 60 + 30;
  const x = (m: number) => PAD.left + ((m - t0) / (t1 - t0)) * (W - PAD.left - PAD.right);

  const yourFirst = choices.find((c) => c.option.effects.warning_scope !== 'none');
  const theirAlertTime = scenario.scoring.historical_first_public_alert;
  const theirAlert = minutes(theirAlertTime);

  const hours: number[] = [];
  for (let m = t0; m <= t1; m += 60) hours.push(m);
  // Hour labels on whole multiples of the step (06:00, 09:00, 12:00…), all
  // centred on their tick, so the first label never crowds the second.
  const labelled = (m: number) => (m / 60) % labelEvery === 0;

  const impactMid = x(impactStart + window / 2);
  const show = (t: Tip) => setTip(t);
  const hide = () => setTip(null);

  return (
    <figure className={`cr-timing${compact ? ' is-compact' : ''}`}>
      <div className="cr-timing-key" aria-hidden>
        <span><svg viewBox="0 0 12 12"><circle cx="6" cy="6" r="4.5" className="cr-timing-dot is-alert" /></svg>warning issued</span>
        <span><svg viewBox="0 0 12 12"><circle cx="6" cy="6" r="3.5" className="cr-timing-dot" /></svg>decision, no warning</span>
        <span><svg viewBox="0 0 14 12"><rect x="1" y="1" width="12" height="10" className="cr-timing-impact" /></svg>impact window</span>
      </div>
      <div className="cr-timing-plot">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" onPointerLeave={hide}
          aria-label={`Timeline comparing your first warning${yourFirst ? ` at ${yourFirst.timestep.time}` : ' (you never alerted)'} with the official alert at ${theirAlertTime} and the impact at ${scenario.scoring.impact.time}`}>
          {/* impact window — the status band everything is measured against */}
          <rect className="cr-timing-impact" x={x(impactStart)} y={PAD.top} width={x(impactStart + window) - x(impactStart)} height={H - PAD.top - PAD.bottom} />
          <text className="cr-timing-impact-label" x={impactMid} y={PAD.top - 8} textAnchor="middle">
            {`IMPACT ${hhmm(impactStart)}`}
          </text>

          {/* axis */}
          <line className="cr-timing-axis" x1={PAD.left} y1={H - PAD.bottom} x2={W - PAD.right} y2={H - PAD.bottom} />
          {hours.map((m) => (
            <g key={m}>
              <line className="cr-timing-tick" x1={x(m)} y1={H - PAD.bottom} x2={x(m)} y2={H - PAD.bottom + (labelled(m) ? 5 : 3)} />
              {labelled(m) && (
                <text className="cr-timing-hour" x={x(m)} y={H - PAD.bottom + 18} textAnchor="middle">{hhmm(m)}</text>
              )}
            </g>
          ))}

          {/* YOUR lane: every decision, warnings filled */}
          <text className="cr-timing-lane" x={PAD.left} y={LANE_YOU + 22}>YOU</text>
          <line className="cr-timing-lanerail" x1={PAD.left} y1={LANE_YOU} x2={W - PAD.right} y2={LANE_YOU} />
          {yourFirst && (() => {
            const fx = x(minutes(yourFirst.timestep.time));
            const flip = fx > W * (compact ? 0.5 : 0.62); // keep the label inside the plate
            return (
              <g className="cr-timing-flag">
                <line x1={fx} y1={LANE_YOU - 9} x2={fx} y2={LANE_YOU - 30} />
                <text x={flip ? fx - 5 : fx + 5} y={LANE_YOU - 22} textAnchor={flip ? 'end' : 'start'}>
                  {`YOU ALERT ${yourFirst.timestep.time} · ${yourFirst.option.effects.warning_scope.toUpperCase()}`}
                </text>
              </g>
            );
          })()}
          {!yourFirst && (
            <text className="cr-timing-flag-muted" x={W - PAD.right} y={LANE_YOU - 22} textAnchor="end">YOU NEVER ALERTED</text>
          )}
          {choices.map((c) => {
            const m = minutes(c.timestep.time);
            const alerted = c.option.effects.warning_scope !== 'none';
            const cx = x(m);
            const t: Tip = {
              x: cx, y: LANE_YOU, time: c.timestep.time, who: 'You', text: c.option.label,
              note: alerted ? `Warning · ${c.option.effects.warning_scope}` : 'No warning',
            };
            return (
              <g key={c.timestep.id} className="cr-timing-mark" onPointerEnter={() => show(t)}>
                {/* paper ring keeps near-coincident marks apart */}
                <circle className="cr-timing-ring" cx={cx} cy={LANE_YOU} r={(alerted ? 6 : 4.5) + 2} />
                <circle className={`cr-timing-dot${alerted ? ' is-alert' : ''}`} cx={cx} cy={LANE_YOU} r={alerted ? 6 : 4.5} />
                <circle className="cr-timing-hit" cx={cx} cy={LANE_YOU} r={13} />
              </g>
            );
          })}

          {/* THEIR lane: the one documented alert */}
          <text className="cr-timing-lane" x={PAD.left} y={LANE_THEY + 22}>THEY</text>
          <line className="cr-timing-lanerail is-they" x1={PAD.left} y1={LANE_THEY} x2={W - PAD.right} y2={LANE_THEY} />
          <g className="cr-timing-flag is-they">
            <line x1={x(theirAlert)} y1={LANE_THEY + 9} x2={x(theirAlert)} y2={LANE_THEY + 26} />
            <text x={x(theirAlert) - 6} y={LANE_THEY + 23} textAnchor="end">{`THEY ALERT ${theirAlertTime}`}</text>
          </g>
          <g className="cr-timing-mark" onPointerEnter={() => show({
            x: x(theirAlert), y: LANE_THEY, time: theirAlertTime, who: 'They',
            text: 'First public alert on the record', note: 'Warning',
          })}>
            <circle className="cr-timing-ring" cx={x(theirAlert)} cy={LANE_THEY} r={8} />
            <circle className="cr-timing-dot is-alert is-they" cx={x(theirAlert)} cy={LANE_THEY} r={6} />
            <circle className="cr-timing-hit" cx={x(theirAlert)} cy={LANE_THEY} r={13} />
          </g>
        </svg>
        {tip && (
          <div className={`cr-timing-tip${tip.x > W * 0.6 ? ' is-left' : ''}`} aria-hidden
            style={{ left: `${(tip.x / W) * 100}%`, top: `${(tip.y / H) * 100}%` }}>
            <span className="cr-timing-tip-head">{tip.time} · {tip.who}</span>
            <span className="cr-timing-tip-text">{tip.text}</span>
            <span className="cr-timing-tip-note">{tip.note}</span>
          </div>
        )}
      </div>
      <figcaption className="cr-timing-caption">
        The shaded band is the documented impact window — {scenario.scoring.impact.label}.
        Each decision is listed in full under <em>Your day beside theirs</em>.
      </figcaption>
    </figure>
  );
}
