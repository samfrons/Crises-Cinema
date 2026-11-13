/**
 * The scorecard, kept as you go: what the game's scoring reads off each
 * call the moment it is made, and where the run stands so far. Game design,
 * labelled as such, and set apart from the record (a dashed rule, the data
 * face, no ember). It says nothing the debrief's ladder does not: the same
 * three things each option codes — warning scope, at-risk zones reached,
 * false-alarm weight — drawn with the same meters, so the debrief's
 * decision-by-decision ladder reads as the sum of slips the player has
 * already seen.
 *
 * Every figure is a value the option already carries, or scoreRun() on the
 * calls made so far. Nothing here is a count of people, and the impact time
 * is named only on a call at or after it, when the log has already shown it.
 */
import type { Option, Scenario } from './types';
import { reached, scoreRun, type Choice } from './scoring';
import { Meter } from './Reckoning';
import { stamp } from './board';

const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};
const warns = (o: Option) => o.effects.warning_scope !== 'none';
const SCOPE_WORD: Record<string, string> = { none: 'none', targeted: 'targeted', province: 'province-wide' };

/** Where the run stands after the calls in `made` (in order). */
export function standing(scenario: Scenario, made: Choice[]) {
  const s = scoreRun(scenario, made);
  const total = scenario.scoring.at_risk_zones.length;
  const first = made.find((c) => warns(c.option));
  const counted = made.filter((c) => c.timestep.historical_option_id !== null);
  return {
    first: first ? stamp(first.timestep) : null,
    zones: Math.round(s.coverage * total),
    total,
    weight: s.falseAlarmWeight,
    same: counted.filter((c) => !c.event.divergedFromHistory).length,
    of: counted.length,
  };
}

const fmtWeight = (w: number) => (Number.isInteger(w) ? String(w) : w.toFixed(1));

/** The run so far, in one line of the data face. */
export function RunLine({ scenario, made, className = '' }: { scenario: Scenario; made: Choice[]; className?: string }) {
  const r = standing(scenario, made);
  return (
    <p className={`cr-ledger-run ${className}`}>
      <span className="cr-ledger-run-k">Your run so far</span>
      <span>First warning <b>{r.first ?? 'not yet sent'}</b></span>
      <span>
        <span className="cr-ledger-pips" aria-hidden>
          {Array.from({ length: r.total }, (_, k) => <i key={k} className={k < r.zones ? 'on' : ''} />)}
        </span>
        <b>{r.zones} of {r.total}</b> zones covered
      </span>
      <span>False-alarm weight <b>{fmtWeight(r.weight)}</b></span>
      <span>As on the day <b>{r.same} of {r.of}</b></span>
    </p>
  );
}

/** One call, as the scorecard reads it, and the run with it counted. */
export default function Ledger({ scenario, choices, index, compact = false }: {
  scenario: Scenario; choices: Choice[]; index: number; compact?: boolean;
}) {
  const c = choices[index];
  if (!c) return null;
  const o = c.option;
  const total = scenario.scoring.at_risk_zones.length;
  const n = reached(o);
  const isFirst = warns(o) && !choices.slice(0, index).some((x) => warns(x.option));
  const impact = scenario.scoring.impact.time;
  const late = toMin(c.timestep.time) >= toMin(impact);
  const made = choices.slice(0, index + 1);

  if (compact) {
    return (
      <p className="cr-ledger is-compact">
        <span className="cr-ledger-tag">Scorecard · game design</span>
        <span className="cr-ledger-line">
          scope {SCOPE_WORD[o.effects.warning_scope]} · {n} of {total} zones · false-alarm weight {fmtWeight(o.effects.false_alarm_weight)}
          {isFirst ? ' · your first warning' : ''}
        </span>
      </p>
    );
  }

  return (
    <div className="cr-ledger" role="group" aria-label="The scorecard, game design">
      <p className="cr-ledger-tag">The scorecard <span className="cr-ledger-tag-sub">· game design, not the record</span></p>
      <dl className="cr-ledger-grid">
        <div>
          <dt>Scope</dt>
          <dd><Meter kind="scope" o={o} total={total} /> <span className="cr-ledger-v">{SCOPE_WORD[o.effects.warning_scope]}</span></dd>
        </div>
        <div>
          <dt>Zones reached</dt>
          <dd><Meter kind="zones" o={o} total={total} /> <span className="cr-ledger-v">{n} of {total}</span></dd>
        </div>
        <div>
          <dt>False-alarm weight</dt>
          <dd><Meter kind="weight" o={o} total={total} /> <span className="cr-ledger-v">{fmtWeight(o.effects.false_alarm_weight)}</span></dd>
        </div>
      </dl>
      {isFirst && (
        <p className="cr-ledger-flag">Your first warning. The lead-time mark is measured from this call.</p>
      )}
      {late && (o.effects.warning_scope !== 'none' || o.effects.protective) && (
        <p className="cr-ledger-note">This call comes at or after the documented impact ({impact}); coverage counts only calls before it.</p>
      )}
      <RunLine scenario={scenario} made={made} />
    </div>
  );
}
