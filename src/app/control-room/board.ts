/**
 * The board's state, derived — shared by the log (ControlRoomGame) and the
 * picture stage (PictureStage). Pure functions of the record and the
 * player's own calls; nothing here invents a state.
 */
import type { Option, Scenario, Timestep } from './types';
import type { Choice } from './scoring';
import { itemState, STATE_RANK, vocabFor, type ZoneState } from './hazards';

export const stamp = (t: Timestep) => `${t.approx ? '≈' : ''}${t.time}`;

export function warnedBy(scenario: Scenario, option: Option): string[] {
  const e = option.effects;
  if (e.warning_scope === 'province') return scenario.scoring.at_risk_zones.map((z) => z.id);
  if (e.warning_scope === 'targeted' || e.protective) return e.zones;
  return [];
}

/**
 * What the wall map shows: zone states lit only by cited information already
 * revealed and the zones the player's own choices have warned. Which state an
 * item lights is the hazard's default for its kind (flood: forecast → watch,
 * gauge → signal, field report → flooding; fire: forecast → red flag, sensor
 * and field report → fire reported) unless the item names its own
 * board_state — "burning" only where the cited text says so, "none" where a
 * zoned report is not about the hazard at all (a pole down is not a fire).
 * The board only ever escalates; it never invents a state.
 */
export function deriveBoard(scenario: Scenario, uptoIndex: number, choices: Choice[], uptoItem?: number) {
  const vocab = vocabFor(scenario);
  const zoneStates: Record<string, ZoneState> = {};
  // The board's marks restate cited items too: where the record first places
  // the hazard (`origin`, one per zone) and a wind direction a forecast states
  // (`wind`, held from the first item that states it, as of the latest).
  const origins: Record<string, string> = {};
  let wind = null as { from: string; by: string } | null;
  // Picture mode plays an hour one slip at a time: `uptoItem` stops decision
  // `uptoIndex` after its first `uptoItem` items.
  scenario.timesteps.slice(0, uptoIndex + 1).forEach((t, ti) => {
    const items = ti === uptoIndex && uptoItem !== undefined ? t.info_available.slice(0, uptoItem) : t.info_available;
    for (const info of items) {
      if (info.origin && info.zones?.length === 1 && !origins[info.zones[0]]) {
        origins[info.zones[0]] = info.origin === true ? `BY ${stamp(t)}` : info.origin;
      }
      if (info.wind) wind = { from: info.wind.from, by: stamp(t) };
      const state = itemState(info, vocab);
      if (!state) continue;
      for (const z of info.zones ?? []) {
        if (STATE_RANK[state] > STATE_RANK[zoneStates[z] ?? 'quiet']) zoneStates[z] = state;
      }
    }
  });
  const warnedZones = new Set<string>();
  for (const c of choices) warnedBy(scenario, c.option).forEach((z) => warnedZones.add(z));
  return { zoneStates, warnedZones: Array.from(warnedZones), origins, wind };
}

