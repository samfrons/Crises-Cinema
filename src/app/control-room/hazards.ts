/**
 * Per-hazard vocabulary for the desk. The board's machinery is hazard-neutral
 * (zones go quiet → watch → signal → impact); what those states are CALLED,
 * which kind of cited item lights which state by default, and the words the
 * briefing and debrief use, depend on the hazard. A fire scenario must never
 * say "gauge alert" or "flooding".
 */
import type { InfoItem, Scenario } from './types';

export type ZoneState = 'quiet' | 'watch' | 'signal' | 'impact';
export const STATE_RANK: Record<ZoneState, number> = { quiet: 0, watch: 1, signal: 2, impact: 3 };

export type HazardFamily = 'water' | 'fire';

type Kind = InfoItem['kind'];

export type HazardVocab = {
  family: HazardFamily;
  /** Board state names, in plain words (shown on the plate, the legend and the list). */
  states: Record<ZoneState, string>;
  /** Which state a zoned item lights when it carries no explicit board_state. */
  kindState: Partial<Record<Kind, Exclude<ZoneState, 'quiet'>>>;
  /** The slip header for each item kind. */
  kindLabel: Record<Kind, string>;
  /** "You will see only what officials could see — …" */
  feeds: string;
  /** What the at-risk areas are called in the debrief. */
  zoneNoun: string;
  desk: string;
  /** The board's origin mark, in the legend: where the record first places … */
  originNoun: string;
};

const KIND_LABEL: Record<Kind, string> = {
  forecast: 'Forecast',
  gauge: 'Gauge',
  message: 'Message',
  media: 'Media',
  field_report: 'From the field',
};

const VOCAB: Record<HazardFamily, HazardVocab> = {
  water: {
    family: 'water',
    states: { quiet: 'quiet', watch: 'red warning', signal: 'gauge alert', impact: 'flooding' },
    kindState: { forecast: 'watch', gauge: 'signal', field_report: 'impact' },
    kindLabel: KIND_LABEL,
    feeds: 'forecasts, gauge readings, messages',
    zoneNoun: 'basins',
    desk: 'civil-protection desk',
    originNoun: 'the flooding',
  },
  fire: {
    family: 'fire',
    // A field report of fire is a report, not proof the zone is alight: only
    // items that say so carry board_state "impact" ("burning") in the data.
    states: { quiet: 'quiet', watch: 'red flag', signal: 'fire reported', impact: 'burning' },
    kindState: { forecast: 'watch', gauge: 'signal', field_report: 'signal' },
    kindLabel: { ...KIND_LABEL, gauge: 'Sensor' },
    feeds: 'forecasts, fire reports, satellite passes, messages',
    zoneNoun: 'zones',
    desk: 'emergency-management desk',
    originNoun: 'the fire',
  },
};

export function hazardFamily(hazard: string): HazardFamily {
  const h = hazard.toLowerCase();
  return /fire|bushfire|wildland/.test(h) ? 'fire' : 'water';
}

export const vocabFor = (scenario: Pick<Scenario, 'hazard'>): HazardVocab => VOCAB[hazardFamily(scenario.hazard)];

/** The state a cited item lights on its zones, or null if it lights none. */
export function itemState(info: InfoItem, vocab: HazardVocab): Exclude<ZoneState, 'quiet'> | null {
  if (info.board_state === 'none') return null;
  return info.board_state ?? vocab.kindState[info.kind] ?? null;
}

/** A compass point as words, for the board's wind mark ("east winds"). The
 *  build only lets an item carry `wind` when its text says this direction. */
export const COMPASS_WORD: Record<string, string> = {
  N: 'north', NE: 'north-east', E: 'east', SE: 'south-east', S: 'south', SW: 'south-west', W: 'west', NW: 'north-west',
};
/** Degrees the wind blows TOWARDS, clockwise from north (an east wind blows west). */
export const COMPASS_TOWARD: Record<string, number> = {
  N: 180, NE: 225, E: 270, SE: 315, S: 0, SW: 45, W: 90, NW: 135,
};
