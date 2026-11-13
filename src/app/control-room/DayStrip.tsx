'use client';

/**
 * The day as a strip of tape along the bottom edge of the console. During
 * play the right-hand edge fades into nothing on purpose: the player is not
 * shown when the day "ends", only how far into it they are. Faint marks are
 * the hours; a tick is a decision point already passed (a taller ember notch
 * where the player left the historical path); the ember needle is now. Once
 * the log is closed the fog lifts and the rail runs to the end of the record.
 * Decorative — the console states the same position in words.
 */
import type { Scenario } from './types';
import type { Choice } from './scoring';

const minutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

export default function DayStrip({ scenario, currentIndex, choices, ended }: {
  scenario: Scenario; currentIndex: number; choices: Choice[]; ended: boolean;
}) {
  const start = minutes(scenario.clock.start);
  const steps = scenario.timesteps;
  // The visible span runs a little past the last decision the player has seen,
  // so the needle never touches the fogged edge and the end stays unrevealed.
  const seen = currentIndex >= 0 ? minutes(steps[currentIndex].time) : start;
  const span = ended
    ? minutes(scenario.clock.end) - start + 20
    : Math.max(seen - start + 90, 150);
  const x = (m: number) => Math.min(100, ((m - start) / span) * 100);
  const now = ended ? minutes(scenario.clock.end) : seen;

  const hours: number[] = [];
  for (let h = Math.ceil(start / 60) * 60; h < start + span; h += 60) hours.push(h);

  // Every mark moves on transform alone (a full-width carrier translated by a
  // percentage of the rail, the elapsed bar scaled from its left edge), so the
  // needle's sweep during the advance beat never asks for layout.
  const at = (m: number) => ({ transform: `translateX(${x(m)}%)` });
  return (
    <div className={`cr-daystrip${ended ? ' is-ended' : ''}`} aria-hidden>
      <div className="cr-daystrip-rail">
        <div className="cr-daystrip-elapsed" style={{ transform: `scaleX(${x(now) / 100})` }} />
        {hours.map((h) => (
          <span key={h} className="cr-daystrip-hour" style={at(h)} />
        ))}
        {steps.slice(0, currentIndex + 1).map((t, i) => (
          <span
            key={t.id}
            className={`cr-daystrip-tick${choices[i]?.event.divergedFromHistory ? ' is-diverged' : ''}`}
            style={at(minutes(t.time))}
          />
        ))}
        <span className="cr-daystrip-needle" style={at(now)} />
        {!ended && <div className="cr-daystrip-fog" />}
      </div>
    </div>
  );
}
