/**
 * The file's connective tissue: cross-reference slips and stamped lines.
 *
 * Server-only. Two kinds of addition sit beside the essay's verbatim text,
 * and neither may change it:
 *
 *  - Cross-reference slips. Interface copy in the house voice, pointing from
 *    a paragraph to the desk (a playable day, a decision) or to a figure on
 *    /preparedness. Every time, date, title and decision number a desk slip
 *    prints is READ from the scenario bundle (src/data/scenarios.json), never
 *    typed here, and a slip that names a day or a decision the bundle does
 *    not hold throws — so a renamed step fails the build rather than the
 *    reader.
 *
 *  - Stamped lines. One sentence per folder, repeated as an annotation. The
 *    sentence is quoted from the folder's own paragraph and checked against
 *    src/data/essay.json at build: if the essay is edited and the sentence
 *    no longer appears verbatim, the build stops. The stamp can never drift
 *    into a second version of the text.
 */
import scenariosData from '../../../data/scenarios.json';
import type { Scenario, ScenarioBundle, Timestep } from '../types';
import { tzLabel } from '../summary';
import { deskHref, type FolderId } from './folders';

export type XRef = {
  /** Printed after this paragraph (0-based) of the folder. */
  after: number;
  /** What the slip points at: a day you can play, one in research, a figure, a page. */
  kind: 'desk' | 'research' | 'figure' | 'page';
  tag: string;
  title: string;
  body: string;
  href: string;
  cta: string;
};

export type Stamp = { para: number; sentence: string };

const bundle = scenariosData as unknown as ScenarioBundle;

function day(id: string): Scenario {
  const s = bundle.playable.find((x) => x.id === id);
  if (!s) throw new Error(`control-room/file: cross-reference to "${id}", which is not a playable day in src/data/scenarios.json`);
  return s;
}
function stubDay(id: string) {
  const s = bundle.stubs.find((x) => x.id === id);
  if (!s) throw new Error(`control-room/file: cross-reference to "${id}", which is not a stub in src/data/scenarios.json`);
  return s;
}
function step(s: Scenario, id: string): { t: Timestep; n: number } {
  const i = s.timesteps.findIndex((t) => t.id === id);
  if (i < 0) throw new Error(`control-room/file: ${s.id} has no decision "${id}"`);
  return { t: s.timesteps[i], n: i + 1 };
}
const at = (t: Timestep) => `${t.approx ? '≈' : ''}${t.time}`;
const longDate = (iso: string) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

function lahaina(folder: FolderId, after: number): XRef {
  const s = day('lahaina-2023');
  const { t, n } = step(s, 't5');
  return {
    after,
    kind: 'desk',
    tag: 'You can hold this desk',
    title: `${s.title} — Lahaina, ${longDate(s.date)}`,
    body: `Decision ${n} of ${s.timesteps.length} comes at ${at(t)} ${tzLabel(s)}. The record logs the first public alert at ${s.scoring.historical_first_public_alert}. Take the desk at ${s.clock.start} and the clock will bring you to that call; it does not skip ahead.`,
    href: deskHref(s.id, folder, t.id),
    cta: `Take the desk — to decision ${n}`,
  };
}

function valencia(folder: FolderId, after: number): XRef {
  const s = day('valencia-dana-2024');
  const first = step(s, 't1');
  const { t, n } = step(s, 't6');
  return {
    after,
    kind: 'desk',
    tag: 'You can hold this desk',
    title: `${s.title} — Valencia, ${longDate(s.date)}`,
    body: `The day opens at ${at(first.t)} ${tzLabel(s)} on decision ${first.n} of ${s.timesteps.length}. Decision ${n}, at ${at(t)}, is the last call on the desk before the alert reaches the phones at ${s.scoring.historical_first_public_alert}.`,
    href: deskHref(s.id, folder, t.id),
    cta: `Take the desk — to decision ${n}`,
  };
}

function katrina(after: number): XRef {
  const s = stubDay('katrina-2005');
  return {
    after,
    kind: 'research',
    tag: 'In research for the desk',
    title: `${s.title} — ${s.location.split(',')[0]}, ${longDate(s.date)}`,
    body: 'This day sits on the desk as schema only, locked until every fact in it carries a source. The build enforces it: nothing is played from memory.',
    href: '/control-room#cr-select-title',
    cta: 'See it locked on the desk',
  };
}

export const XREFS: Record<FolderId, XRef[]> = {
  a: [
    {
      after: 2,
      kind: 'page',
      tag: 'Cross-reference · the desk',
      title: 'The machine, drawn as a chain',
      body: 'Every day in the Control Room draws this architecture as the warning chain: forecast office, your desk, then sirens, phones, broadcast, posts. A link lights only when the record says it carried a warning.',
      href: '/control-room',
      cta: 'To the desk',
    },
  ],
  b: [
    katrina(0),
    lahaina('b', 1),
    valencia('b', 2),
    {
      after: 3,
      kind: 'figure',
      tag: 'Cross-reference · The Last Mile, Figure 1',
      title: 'Preparedness, by whichever measure you trust',
      body: 'The indices behind this argument, country by country, on a map you can switch between them. A layer the site could not load is drawn as missing, never estimated.',
      href: '/preparedness#map',
      cta: 'To Figure 1',
    },
  ],
  c: [
    {
      after: 3,
      kind: 'figure',
      tag: 'Cross-reference · The Last Mile, Figure 2',
      title: 'What happened, and what was promised',
      body: 'Outcomes already on the record, set beside capacity as the states report it. The weights are shown, and yours to set.',
      href: '/preparedness#scoring',
      cta: 'To Figure 2',
    },
  ],
  d: [
    {
      after: 0,
      kind: 'desk',
      tag: 'Cross-reference · the debrief',
      title: 'The inquiry said',
      body: 'Every day on the desk closes on a debrief: your calls beside what officials did, then the inquiry’s findings, quoted or paraphrased and cited. Hold Lahaina to the end of the record to read them there.',
      href: deskHref('lahaina-2023', 'd'),
      cta: 'Take the Lahaina desk',
    },
    {
      after: 2,
      kind: 'figure',
      tag: 'Cross-reference · The Last Mile',
      title: 'The inquiries, in their own words',
      body: 'The case files: each event with its named inquiry and what that inquiry found, quoted or paraphrased from the report.',
      href: '/preparedness#cases',
      cta: 'To the case files',
    },
  ],
  e: [
    {
      after: 0,
      kind: 'figure',
      tag: 'Cross-reference · The Last Mile, Figure 3',
      title: 'Asked for, and received',
      body: 'The appeal record, year by year. Where a figure could not be fetched from a machine-readable source, the plate says so instead of filling it from the news.',
      href: '/preparedness#two-numbers',
      cta: 'To Figure 3',
    },
  ],
  f: [
    {
      after: 1,
      kind: 'page',
      tag: 'Cross-reference · the desk',
      title: 'No villain to beat',
      body: 'The Control Room is built on this folder. You wait for traffic like the officials did; the clock does not wait for you; and no option is drawn as the right one. Afterwards the log says what officials did, and says plainly where the record is silent.',
      href: '/control-room',
      cta: 'Hold a desk',
    },
    {
      after: 2,
      kind: 'page',
      tag: 'Cross-reference · the site',
      title: 'The Atlas of Ruin',
      body: 'Where the films put the end of the world, mapped.',
      href: '/atlas',
      cta: 'To the Atlas',
    },
  ],
};

/** One sentence per folder, stamped in the margin. Verbatim; checked. */
export const STAMPS: Record<FolderId, Stamp> = {
  a: { para: 2, sentence: 'On paper, then, the architecture is extremely good, and in one coastal country it demonstrably worked.' },
  b: { para: 3, sentence: 'The last mile is the commonest graveyard in the record, not the only one.' },
  c: { para: 3, sentence: 'The defensible reading is not that the scores are useless; it is that they may measure capacity against the hazards they were built for while rich countries die of one nobody scored.' },
  d: { para: 0, sentence: 'These are parliamentary and investigative findings, not verdicts.' },
  e: { para: 0, sentence: 'The humanitarian system’s own scorecard falls as its bill rises.' },
  f: { para: 1, sentence: 'Bureaucratic delay does not photograph, and the film’s substitute for it, one obstructive mayor, is dramatically necessary and analytically useless.' },
};

/** Throws unless every stamp is a verbatim sentence of its folder, and every
 *  slip hangs off a paragraph that exists. Called by the page at build. */
export function checkFile(sections: { id: string; paragraphs: { text: string }[] }[]) {
  for (const s of sections) {
    const id = s.id as FolderId;
    const st = STAMPS[id];
    if (!st) throw new Error(`control-room/file: no stamp for folder "${s.id}"`);
    const para = s.paragraphs[st.para];
    if (!para || !para.text.includes(st.sentence)) {
      throw new Error(`control-room/file: folder "${s.id}" stamp is no longer verbatim in paragraph ${st.para + 1} of src/data/essay.json`);
    }
    for (const x of XREFS[id] ?? []) {
      if (x.after < 0 || x.after >= s.paragraphs.length) {
        throw new Error(`control-room/file: folder "${s.id}" slip "${x.title}" hangs off paragraph ${x.after + 1}, which does not exist`);
      }
    }
  }
}
