/**
 * The interpretive layer, kept apart from the historical record on purpose.
 *
 * Nothing here simulates a counterfactual: the score measures the player's
 * choices *against* the real clock — how far ahead of the documented impact
 * their first warning would have gone out, which at-risk basins any warning
 * covered, and how much they alerted on weak signals — plus plain divergence
 * from the historical path. The debrief labels all of this as game design,
 * not as a claim about lives saved.
 */
import type { Scenario, Timestep, Option } from './types';
import type { ChoiceEvent, SessionScore } from './telemetry';

export type Choice = { timestep: Timestep; option: Option; event: ChoiceEvent };

const minutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

export function scoreRun(scenario: Scenario, choices: Choice[]): SessionScore {
  const impactMin = minutes(scenario.scoring.impact.time);

  // Lead time: from the player's first population warning (any scope) to the
  // documented impact. Positive = ahead of the flood; null = never warned.
  const firstWarning = choices.find((c) => c.option.effects.warning_scope !== 'none');
  const leadTimeMinutes = firstWarning ? impactMin - minutes(firstWarning.timestep.time) : null;

  // Coverage: share of the scenario's at-risk zones reached by any warning or
  // protective action taken before the impact time.
  const covered = new Set<string>();
  for (const c of choices) {
    if (minutes(c.timestep.time) >= impactMin) break;
    if (c.option.effects.warning_scope !== 'none' || c.option.effects.protective) {
      for (const z of c.option.effects.zones) covered.add(z);
    }
  }
  const zones = scenario.scoring.at_risk_zones;
  const coverage = zones.length ? covered.size / zones.length : 0;

  const falseAlarmWeight = choices.reduce((sum, c) => sum + c.option.effects.false_alarm_weight, 0);
  const divergence = choices.filter((c) => c.event.divergedFromHistory).length;

  return { leadTimeMinutes, coverage, falseAlarmWeight, divergence };
}

export function historicalLeadTime(scenario: Scenario): number {
  return minutes(scenario.scoring.impact.time) - minutes(scenario.scoring.historical_first_public_alert);
}

export function formatLead(mins: number | null): string {
  if (mins === null) return 'no warning sent';
  if (mins === 0) return 'at the moment of impact';
  const abs = Math.abs(mins);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  const span = h ? `${h} h ${m ? `${m} min` : ''}`.trim() : `${m} min`;
  return mins > 0 ? `${span} before impact` : `${span} after impact`;
}
