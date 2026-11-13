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

/**
 * When the officials' public warnings came before this clock opened: how many
 * calendar days before the scenario day, and that date in words. The day's
 * HH:MM first alert is then this day's figure only, and the debrief says so
 * rather than letting it stand as the officials' lead time.
 */
export function alertBeforeClock(scenario: Scenario) {
  const a = scenario.alert_predates_clock;
  if (!a) return null;
  const day = (iso: string) => Date.parse(`${iso}T00:00:00Z`);
  const days = Math.round((day(scenario.date) - day(a.date)) / 86_400_000);
  const longDate = new Date(day(a.date)).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
  const weekday = new Date(day(a.date)).toLocaleDateString('en-GB', { weekday: 'long', timeZone: 'UTC' });
  const short = new Date(day(a.date)).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }).toUpperCase();
  return { ...a, days, longDate, weekday, short, span: days === 1 ? 'the day before' : `${days} days before` };
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

/* ── The reckoning ────────────────────────────────────────────────────────
   Arithmetic on cited clock times, nothing else: when you first warned, when
   the record first warned, when the desk's own record first gave grounds to
   warn (the benchmark, a game-design hypothesis authored in the scenario
   data), each against the documented impact. Minutes and scope only: no
   figure here is, or converts into, a count of lives. */

export type LaneMark = {
  /** HH:MM of the first warning on this lane, or null if it never warned. */
  time: string | null;
  /** Minutes before impact (positive) or after it (negative); null = never. */
  lead: number | null;
};

export type ZoneRow = {
  id: string;
  label: string;
  /** Decision time of the first warning reaching this zone, per lane. */
  you: string | null;
  record: string | null;
  bench: string | null;
};

export type StepRung = {
  id: string;
  time: string;
  label: string;
  /** The same option on both sides: the pair fuses. */
  same: boolean;
  you: Option | null;
  record: Option | null;
};

const SCOPE_RANK: Record<string, number> = { none: 0, targeted: 1, province: 2 };
export const scopeRank = (o: Option | null) => (o ? SCOPE_RANK[o.effects.warning_scope] ?? 0 : 0);
/** Zones an option reaches, as the coverage score counts them. */
export const reached = (o: Option | null) =>
  o && (o.effects.warning_scope !== 'none' || o.effects.protective) ? o.effects.zones.length : 0;
const warns = (o: Option | null | undefined) => !!o && o.effects.warning_scope !== 'none';

export function reckon(scenario: Scenario, choices: Choice[]) {
  const impact = minutes(scenario.scoring.impact.time);
  const lead = (t: string | null) => (t === null ? null : impact - minutes(t));
  const histOpt = (t: Timestep) => t.options.find((o) => o.id === t.historical_option_id) ?? null;
  const yourOpt = (t: Timestep) => choices.find((c) => c.timestep.id === t.id)?.option ?? null;

  const yourFirst = choices.find((c) => warns(c.option));
  const you: LaneMark & { scope: string | null } = {
    time: yourFirst?.timestep.time ?? null,
    lead: lead(yourFirst?.timestep.time ?? null),
    scope: yourFirst?.option.effects.warning_scope ?? null,
  };
  const recordTime = scenario.scoring.historical_first_public_alert;
  const record: LaneMark = { time: recordTime, lead: lead(recordTime) };

  const calls = [...scenario.scoring.benchmark].sort((a, b) => a.time.localeCompare(b.time));
  const benchTime = calls[0]?.time ?? null;
  const bench: LaneMark = { time: benchTime, lead: lead(benchTime) };

  const firstFor = (z: string, pick: (t: Timestep) => Option | null) =>
    scenario.timesteps.find((t) => { const o = pick(t); return warns(o) && o!.effects.zones.includes(z); })?.time ?? null;
  const zones: ZoneRow[] = scenario.scoring.at_risk_zones.map((z) => ({
    id: z.id,
    label: z.label,
    you: firstFor(z.id, yourOpt),
    record: firstFor(z.id, histOpt),
    bench: calls.find((c) => c.zones.includes(z.id))?.time ?? null,
  }));

  const ladder: StepRung[] = scenario.timesteps.map((t) => {
    const y = yourOpt(t);
    const r = histOpt(t);
    return { id: t.id, time: t.time, label: t.time_label, same: !!y && !!r && y.id === r.id, you: y, record: r };
  });

  /** Minutes between two lanes: positive = `a` came earlier than `b`. */
  const gap = (a: LaneMark, b: LaneMark) => (a.lead === null || b.lead === null ? null : a.lead - b.lead);
  return {
    impact: scenario.scoring.impact.time,
    window: scenario.scoring.impact.window_minutes ?? null,
    you, record, bench, calls, zones, ladder,
    youVsBench: gap(you, bench),
    recordVsBench: gap(record, bench),
    /** The record warned at or before the benchmark: the success inversion. */
    recordMetMark: record.lead !== null && bench.lead !== null && record.lead >= bench.lead,
  };
}

/** The best marks the scoring rules allow on this desk (game design, not
 *  history): the earliest warning on offer at all, and the earliest one whose
 *  option carries no false-alarm weight. */
export function bestMarks(scenario: Scenario) {
  const impact = minutes(scenario.scoring.impact.time);
  const first = (ok: (o: Option) => boolean) => {
    for (const t of scenario.timesteps) {
      const o = t.options.find((x) => warns(x) && ok(x));
      if (o) return { time: t.time, lead: impact - minutes(t.time), option: o };
    }
    return null;
  };
  const weights = Array.from(new Set(scenario.timesteps.flatMap((t) => t.options.map((o) => o.effects.false_alarm_weight)))).sort((a, b) => a - b);
  return { earliest: first(() => true), earliestClean: first((o) => o.effects.false_alarm_weight === 0), weights };
}

/** "3 h 25 min" from a signed minute count (sign dropped). */
export function span(mins: number): string {
  const abs = Math.abs(mins);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return h ? `${h} h${m ? ` ${m} min` : ''}` : `${m} min`;
}
