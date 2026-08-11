import films from '../../../public/data/films.json';
import summaryData from '../../data/summary.json';
import type { DecadeRow, Film, Summary } from '@/lib/taxonomy';

/**
 * Shared loading and grouping for the static catalogue.
 *
 * Both halves of /catalogue read the same build artefact the interactive
 * explorer fetches at runtime, so the static index can never describe a
 * different set of films than the essay does.
 */

export const summary = summaryData as unknown as Summary;

const catalogue = films as unknown as Film[];

export interface DecadeGroup {
  decade: number;
  /** The URL segment and the display label, e.g. "1970s". */
  slug: string;
  films: Film[];
  row: DecadeRow | undefined;
}

function group(): DecadeGroup[] {
  const buckets: Record<number, Film[]> = {};
  for (const f of catalogue) {
    const d = Math.floor(f.y / 10) * 10;
    (buckets[d] ||= []).push(f);
  }
  return Object.keys(buckets)
    .map(Number)
    .sort((a, b) => b - a) // Newest first: the dense end of the dataset leads.
    .map((decade) => ({
      decade,
      slug: `${decade}s`,
      films: buckets[decade].sort((a, b) => a.y - b.y || a.t.localeCompare(b.t)),
      row: summary.decades.find((d) => d.decade === decade),
    }));
}

/** Computed once at module load; the data is frozen at build time. */
export const DECADES: DecadeGroup[] = group();

export const findDecade = (slug: string) => DECADES.find((d) => d.slug === slug);
