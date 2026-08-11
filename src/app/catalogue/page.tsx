import type { Metadata } from 'next';
import { FAMILIES, family } from '@/lib/taxonomy';
import { abs } from '@/lib/site';
import { DECADES, summary } from './films';
import './catalogue.css';

/**
 * The static catalogue, split one page per decade.
 *
 * The essay's explorer is the good way to read this data — it filters,
 * searches and shows the posters. It is also a client component that fetches
 * /data/films.json after hydration, which makes the catalogue invisible to
 * anything that does not run scripts: assistant fetchers, reader modes, search
 * crawlers, and any reader whose JavaScript failed.
 *
 * A single page holding all 831 films came to 1.7MB once Next had inlined its
 * hydration payload alongside the markup — large enough that the fetchers this
 * is meant for would truncate it, which would have reintroduced the original
 * problem in a new place. Fourteen decade pages each stay small enough to be
 * read whole, and give crawlers fourteen entry points instead of one.
 */

const title = `The Catalogue — all ${summary.total} disaster films, ${summary.firstYear}–${summary.lastYear}`;
const description =
  `Every one of the ${summary.total} films behind Disasters by the Decade, one page per decade and ` +
  'categorised by what goes wrong — with director, country, rating and plot. Plain HTML, no scripts.';

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: abs('/catalogue') },
  openGraph: { title, description, url: abs('/catalogue'), type: 'article', siteName: 'Disasters by the Decade' },
  twitter: { card: 'summary_large_image', title, description },
};

export default function CatalogueIndex() {
  return (
    <div className="cat-page">
      <a className="skip" href="#decades">Skip to the decades</a>

      <header className="cat-masthead">
        <div className="wrap">
          <p className="cat-kicker">
            The full index · <a href="/">← Back to Disasters by the Decade</a>
          </p>
          <h1 className="cat-title">The Catalogue</h1>
          <p className="cat-lede">
            All {summary.total} films, {summary.firstYear}–{summary.lastYear}, filed under what
            actually goes wrong in them and split one page per decade. The <a href="/">essay</a> is
            the better way to read this — it filters, searches and shows the posters. These pages are
            the same data with nothing between you and it.
          </p>

          <ul className="cat-legend">
            {FAMILIES.map((f) => (
              <li key={f.id}>
                <span className="cat-swatch" style={{ background: f.color }} aria-hidden="true" />
                {f.label}
                <span className="cat-legend-n">{summary.byFamily[f.id] ?? 0}</span>
              </li>
            ))}
          </ul>
        </div>
      </header>

      <main className="wrap cat-main" id="decades">
        <ol className="cat-index">
          {DECADES.map(({ decade, slug, films, row }) => (
            <li key={decade} className="cat-index-item">
              <a href={`/catalogue/${slug}`}>
                <span className="cat-index-decade">{slug}</span>
                <span className="cat-index-n">
                  {`${films.length} film${films.length === 1 ? '' : 's'}`}
                </span>
                <span className="cat-index-meta">
                  {row?.dominant ? `mostly ${family(row.dominant).label.toLowerCase()}` : '—'}
                  {row?.meanRating === null || row?.meanRating === undefined
                    ? ''
                    : ` · mean ${row.meanRating.toFixed(1)}`}
                </span>
              </a>
            </li>
          ))}
        </ol>
      </main>

      <footer className="cat-foot">
        <div className="wrap">
          <p>
            Built {summary.generated}. Ratings, posters and plot summaries from TMDB. The same
            catalogue as JSON: <a href="/data/films.json">/data/films.json</a>. The aggregate picture
            in plain text: <a href="/llms.txt">/llms.txt</a>. How these categories were made:{' '}
            <a href="/methodology">the methodology</a>.
          </p>
        </div>
      </footer>
    </div>
  );
}
