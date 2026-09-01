'use client';

/**
 * The debrief's one chart: a single shared time axis with two lanes — the
 * player's day above, the officials' below — against the documented impact
 * window. One axis, marks labelled in text as well as tone, ember reserved
 * for the impact band (a status, never a series). Everything drawn is either
 * the player's own log or a cited fact of the record.
 */
import type { Scenario } from './types';
import type { Choice } from './scoring';

const minutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};
const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

const W = 720;
const H = 190;
const PAD = { left: 14, right: 14, top: 30, bottom: 30 };
const LANE_YOU = 78;
const LANE_THEY = 128;

export default function AlertTimingChart({ scenario, choices }: { scenario: Scenario; choices: Choice[] }) {
  const t0 = Math.floor(minutes(scenario.clock.start) / 60) * 60;
  const impactStart = minutes(scenario.scoring.impact.time);
  const window = scenario.scoring.impact.window_minutes ?? 60;
  const t1 = Math.ceil(Math.max(minutes(scenario.clock.end), impactStart + window) / 60) * 60 + 30;
  const x = (m: number) => PAD.left + ((m - t0) / (t1 - t0)) * (W - PAD.left - PAD.right);

  const yourFirst = choices.find((c) => c.option.effects.warning_scope !== 'none');
  const theirAlert = minutes(scenario.scoring.historical_first_public_alert);

  const hours: number[] = [];
  for (let m = t0; m <= t1; m += 60) hours.push(m);

  return (
    <figure className="cr-timing">
      <svg viewBox={`0 0 ${W} ${H}`} role="img"
        aria-label={`Timeline comparing your first warning with the official alert at ${scenario.scoring.historical_first_public_alert} and the impact at ${scenario.scoring.impact.time}`}>
        {/* impact window — the status band everything is measured against */}
        <rect className="cr-timing-impact" x={x(impactStart)} y={PAD.top} width={x(impactStart + window) - x(impactStart)} height={H - PAD.top - PAD.bottom}>
          <title>{`${hhmm(impactStart)}–${hhmm(impactStart + window)} — ${scenario.scoring.impact.label}`}</title>
        </rect>
        <text className="cr-timing-impact-label" x={x(impactStart) - 6} y={PAD.top + 10} textAnchor="end">IMPACT →</text>

        {/* axis */}
        <line className="cr-timing-axis" x1={PAD.left} y1={H - PAD.bottom} x2={W - PAD.right} y2={H - PAD.bottom} />
        {hours.map((m) => (
          <g key={m}>
            <line className="cr-timing-tick" x1={x(m)} y1={H - PAD.bottom} x2={x(m)} y2={H - PAD.bottom + 5} />
            {(m / 60) % 2 === 0 && (
              <text className="cr-timing-hour" x={x(m)} y={H - PAD.bottom + 18} textAnchor="middle">{hhmm(m)}</text>
            )}
          </g>
        ))}

        {/* YOUR lane: every decision, warnings filled */}
        <text className="cr-timing-lane" x={PAD.left} y={LANE_YOU - 18}>YOU</text>
        <line className="cr-timing-lanerail" x1={PAD.left} y1={LANE_YOU} x2={W - PAD.right} y2={LANE_YOU} />
        {choices.map((c) => {
          const m = minutes(c.timestep.time);
          const alerted = c.option.effects.warning_scope !== 'none';
          return (
            <circle key={c.timestep.id} className={`cr-timing-dot${alerted ? ' is-alert' : ''}`} cx={x(m)} cy={LANE_YOU} r={alerted ? 6 : 4}>
              <title>{`${c.timestep.time} — ${c.option.label}`}</title>
            </circle>
          );
        })}
        {yourFirst && (() => {
          const fx = x(minutes(yourFirst.timestep.time));
          const flip = fx > W * 0.62; // keep the label inside the plate
          return (
            <g className="cr-timing-flag">
              <line x1={fx} y1={LANE_YOU - 8} x2={fx} y2={LANE_YOU - 34} />
              <text x={flip ? fx - 5 : fx + 5} y={LANE_YOU - 26} textAnchor={flip ? 'end' : 'start'}>
                {`YOU ALERT ${yourFirst.timestep.time} (${yourFirst.option.effects.warning_scope.toUpperCase()})`}
              </text>
            </g>
          );
        })()}
        {!yourFirst && (
          <text className="cr-timing-flag-muted" x={W - PAD.right} y={LANE_YOU - 24} textAnchor="end">YOU NEVER ALERTED</text>
        )}

        {/* THEIR lane: the one documented alert */}
        <text className="cr-timing-lane" x={PAD.left} y={LANE_THEY - 18}>THEY</text>
        <line className="cr-timing-lanerail is-they" x1={PAD.left} y1={LANE_THEY} x2={W - PAD.right} y2={LANE_THEY} />
        <g className="cr-timing-flag is-they">
          <circle className="cr-timing-dot is-alert is-they" cx={x(theirAlert)} cy={LANE_THEY} r={6}>
            <title>{`${scenario.scoring.historical_first_public_alert} — the ES-Alert to every phone in the province`}</title>
          </circle>
          <line x1={x(theirAlert)} y1={LANE_THEY + 8} x2={x(theirAlert)} y2={LANE_THEY + 28} />
          <text x={x(theirAlert) - 5} y={LANE_THEY + 24} textAnchor="end">{`THEY ALERT ${scenario.scoring.historical_first_public_alert}`}</text>
        </g>
      </svg>
      <figcaption className="cr-timing-caption">
        Filled marks are warnings; open marks are decisions without one. The hatched band is the documented
        impact window — {scenario.scoring.impact.label}.
      </figcaption>
    </figure>
  );
}
