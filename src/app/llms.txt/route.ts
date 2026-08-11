import summaryData from '../../data/summary.json';
import { FAMILIES, GROUPS, decadeLabel, family, type Summary } from '@/lib/taxonomy';
import { SITE_URL, abs } from '@/lib/site';

/**
 * /llms.txt — the site in plain text, for a reader that does not run scripts.
 *
 * The essay's headline numbers are server-rendered, but the interactive views
 * hydrate on the client and the 831-film catalogue is fetched from
 * /data/films.json after paint. An assistant fetching the page sees the HTML
 * and none of the JavaScript, so it can report the thesis but not the data
 * behind it. This route hands over the whole aggregate picture in one request,
 * and points at /catalogue for the film-by-film list.
 *
 * Generated from the same build artefact the page renders from, so the two can
 * never drift apart.
 */

export const dynamic = 'force-static';

const summary = summaryData as unknown as Summary;

const pad = (s: string, n: number) => s.padEnd(n);

function build(): string {
  const { total, firstYear, lastYear, generated } = summary;
  const [peakYear, peakCount] = summary.peakYear;

  const groupTotals = GROUPS.map((g) => ({
    ...g,
    n: FAMILIES.filter((f) => f.group === g.id)
      .reduce((sum, f) => sum + (summary.byFamily[f.id] ?? 0), 0),
  })).sort((a, b) => b.n - a.n);

  const families = [...FAMILIES]
    .map((f) => ({ ...f, n: summary.byFamily[f.id] ?? 0 }))
    .sort((a, b) => b.n - a.n);

  const share = (n: number) => `${((n / total) * 100).toFixed(1)}%`;

  const lines: string[] = [];
  const L = (s = '') => lines.push(s);

  L('# Disasters by the Decade — According to Hollywood');
  L();
  L(`> A data essay on ${total} disaster films released between ${firstYear} and ${lastYear},`);
  L('> classified by what actually goes wrong in them, then counted decade by decade.');
  L(`> Canonical URL: ${SITE_URL}/`);
  L(`> Data built: ${generated}. Ratings, posters and plot summaries from TMDB.`);
  L();
  L('This file exists because the essay is interactive: the charts and the film');
  L('explorer hydrate in the browser and the catalogue is loaded asynchronously,');
  L('so a fetch of the HTML alone under-reports the content. Everything below is');
  L('the same data the page draws from.');
  L();

  L('## Pages');
  L();
  L(`- [The essay](${abs('/')}): the thesis, the fear index and the decade chart.`);
  L(`- [Catalogue](${abs('/catalogue')}): all ${total} films as plain HTML, one page per decade at /catalogue/1970s and so on — no scripts required.`);
  L(`- [Methodology](${abs('/methodology')}): how ${total} messy records became eleven families, and what was thrown out.`);
  L(`- [The First Reels](${abs('/reel')}): ten public-domain disaster films, 1900–1930, with their licensing paperwork.`);
  L(`- [films.json](${abs('/data/films.json')}): the machine-readable catalogue the explorer fetches.`);
  L();

  L('## The finding');
  L();
  L(`Sorted by cause, the planet still takes top billing: ${groupTotals[0].n} of ${total} films`);
  L(`(${share(groupTotals[0].n)}) blame ${groupTotals[0].label.toLowerCase()}, against ${groupTotals[1].n} (${share(groupTotals[1].n)}) for`);
  L(`${groupTotals[1].label.toLowerCase()}. The single busiest year on record is ${peakYear}, with ${peakCount} films.`);
  L(`${summary.withRating} films carry a rating; ${summary.withBoxOffice} have box office on record.`);
  L();

  L('## Categories');
  L();
  L('Eleven families under four headings. A film with a stated cause is filed');
  L('under that cause rather than its setting.');
  L();
  for (const g of groupTotals) {
    L(`### ${g.label} — ${g.n} films (${share(g.n)})`);
    L(`${g.gloss}`);
    L();
    for (const f of families.filter((x) => x.group === g.id)) {
      L(`- ${pad(f.label, 16)} ${pad(String(f.n), 4)} ${pad(share(f.n), 7)} ${f.gloss}`);
    }
    L();
  }

  L('## By decade');
  L();
  L('decade  films  dominant category   mean rating  best rated');
  for (const d of summary.decades) {
    const dom = d.dominant ? family(d.dominant).label : '—';
    const rating = d.meanRating === null ? '—' : d.meanRating.toFixed(1);
    const top = d.topRated ? `${d.topRated.t} (${d.topRated.y}, ${d.topRated.r}/10)` : '—';
    L(`${pad(decadeLabel(d.decade), 8)}${pad(String(d.total), 7)}${pad(dom, 20)}${pad(rating, 13)}${top}`);
  }
  L();

  L('## Where they were made');
  L();
  for (const [name, n] of summary.countries.slice(0, 12)) {
    L(`- ${pad(name, 24)} ${n}`);
  }
  L();

  L('## How the endings read');
  L();
  L('Plot summaries scored for survival language against annihilation language.');
  L();
  L('category         with plot  survives  ends');
  for (const row of summary.plotLanguage) {
    L(
      `${pad(family(row.family).label, 17)}${pad(String(row.withPlot), 11)}` +
      `${pad(`${row.survivalPct}%`, 10)}${row.annihilationPct}%`,
    );
  }
  L();

  L('## Terms');
  L();
  L('Built by Sam Frons as part of StoryTimeMaps (https://storytimemaps.com).');
  L('Freely quotable with attribution and a link back to the canonical URL.');
  L();

  return lines.join('\n');
}

export function GET() {
  return new Response(build(), {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}
