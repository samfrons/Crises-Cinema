'use client';

/**
 * The day as a strip of tape across the top of the desk. During play the
 * right-hand edge fades into nothing on purpose: the player is not shown when
 * the day "ends", only how far into it they are. Ticks mark the decision
 * points already passed; the ember needle is now.
 */
import type { Scenario } from './types';

const minutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

export default function DayStrip({ scenario, currentIndex }: { scenario: Scenario; currentIndex: number }) {
  const start = minutes(scenario.clock.start);
  // The visible span runs a little past the last decision the player has seen,
  // so the needle never touches the fogged edge and the end stays unrevealed.
  const seen = minutes(scenario.timesteps[currentIndex].time);
  const span = Math.max(seen - start + 90, 150);
  const x = (t: string) => ((minutes(t) - start) / span) * 100;

  return (
    <div className="cr-daystrip" aria-hidden>
      <div className="cr-daystrip-rail">
        <div className="cr-daystrip-elapsed" style={{ width: `${x(scenario.timesteps[currentIndex].time)}%` }} />
        {scenario.timesteps.slice(0, currentIndex + 1).map((t, i) => (
          <span
            key={t.id}
            className={`cr-daystrip-tick${i === currentIndex ? ' is-now' : ''}`}
            style={{ left: `${x(t.time)}%` }}
          />
        ))}
        <div className="cr-daystrip-fog" />
      </div>
      <div className="cr-daystrip-labels">
        <span>{scenario.clock.start}</span>
        <span className="cr-daystrip-unknown">· · ·</span>
      </div>
    </div>
  );
}
