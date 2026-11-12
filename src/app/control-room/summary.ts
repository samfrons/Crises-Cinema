/**
 * What the select screen needs to know about each day, and nothing more —
 * computed on the server so the page ships card summaries, not the whole
 * scenario bundle; the full scenario is loaded only once a day is picked.
 * Shared, server-safe helpers (no 'use client') live here too.
 */
import type { Scenario, ScenarioBundle, ScenarioStub } from './types';

/** The clock's zone as players read it: an IANA region ("Pacific/Honolulu")
 *  becomes its short name on the scenario's date ("HST"); a name that is
 *  already short ("CET") is shown as given. */
export function tzLabel(s: Pick<Scenario, 'clock' | 'date'>) {
  const tz = s.clock.timezone;
  if (!tz.includes('/')) return tz;
  try {
    const part = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'short' })
      .formatToParts(new Date(`${s.date}T12:00:00Z`))
      .find((p) => p.type === 'timeZoneName')?.value;
    return part && !/^GMT/.test(part) ? part : tz;
  } catch {
    return tz;
  }
}

/* Reading time, stated honestly. What the card promises is not a guess: it
   is the words the day puts in front of the player (the briefing, every slip
   and option, the record's answer on the historical path, the debrief's
   lines), at 200 words a minute. */
export const WPM = 200;
const BRIEFING_WORDS = 110; // the briefing's fixed paragraph
const wordsIn = (x?: string | null) => (x ? x.split(/\s+/).filter(Boolean).length : 0);
export function readingMinutes(s: Scenario) {
  let w = BRIEFING_WORDS + wordsIn(s.location);
  for (const t of s.timesteps) {
    for (const i of t.info_available) w += wordsIn(i.text);
    for (const o of t.options) w += wordsIn(o.label) + wordsIn(o.detail);
    const h = t.options.find((o) => o.id === t.historical_option_id)?.consequence;
    if (h?.known) w += wordsIn(h.text);
  }
  for (const h of s.historical_path) w += wordsIn(h.action);
  for (const f of s.inquiry_findings) w += wordsIn(f.quote) + wordsIn(f.translation);
  for (const k of s.takeaways ?? []) w += wordsIn(k.text);
  return Math.max(1, Math.round(w / WPM));
}

const NUMBER_WORDS = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve'];
export const inWords = (n: number) => NUMBER_WORDS[n] ?? String(n);

/** The shape the desk's memory reads a day by: its decisions, their option
 *  ids and the officials' call. A full Scenario satisfies it too. */
export type RunShape = {
  id: string;
  timesteps: { id: string; historical_option_id: string | null; options: { id: string }[] }[];
};

export type ScenarioCard = RunShape & {
  title: string;
  date: string;
  location: string;
  hazard: string;
  clock: Scenario['clock'];
  tz: string;
  minutes: number;
};

export type CardBundle = { playable: ScenarioCard[]; stubs: ScenarioStub[] };

/* The order the days are dealt on the select screen (the bundle itself is in
   file-name order). The three last-mile failures first, the two most recent
   leading; then Odisha last, as the counter-example: the same machinery,
   working. A day not listed here follows, in bundle order. */
const CARD_ORDER = ['lahaina-2023', 'valencia-dana-2024', 'katrina-2005', 'odisha-phailin-2013'];
const cardRank = (id: string) => {
  const i = CARD_ORDER.indexOf(id);
  return i < 0 ? CARD_ORDER.length : i;
};

export function toCards(bundle: ScenarioBundle): CardBundle {
  const dealt = [...bundle.playable].sort((a, b) => cardRank(a.id) - cardRank(b.id));
  return {
    playable: dealt.map((s) => ({
      id: s.id,
      title: s.title,
      date: s.date,
      location: s.location,
      hazard: s.hazard,
      clock: s.clock,
      tz: tzLabel(s),
      minutes: readingMinutes(s),
      timesteps: s.timesteps.map((t) => ({
        id: t.id,
        historical_option_id: t.historical_option_id,
        options: t.options.map((o) => ({ id: o.id })),
      })),
    })),
    stubs: bundle.stubs,
  };
}
