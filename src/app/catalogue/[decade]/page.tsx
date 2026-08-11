import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { country, family, money, orDash, tmdbUrl } from '@/lib/taxonomy';
import { abs } from '@/lib/site';
import { DECADES, findDecade, summary } from '../films';
import '../catalogue.css';

/**
 * One decade of the catalogue as static HTML — no scripts, no async data.
 *
 * Every decade is prerendered at build time and listed in the sitemap, so a
 * crawler or an assistant reaches any film in two hops from the essay.
 */

interface Props {
  params: { decade: string };
}

/** Fourteen decade pages, fixed at build time. Anything else 404s. */
export function generateStaticParams() {
  return DECADES.map(({ slug }) => ({ decade: slug }));
}

export const dynamicParams = false;

export function generateMetadata({ params }: Props): Metadata {
  const group = findDecade(params.decade);
  if (!group) return {};

  const dominant = group.row?.dominant ? family(group.row.dominant).label.toLowerCase() : null;
  const title = `${group.slug} — ${group.films.length} disaster films | The Catalogue`;
  const description =
    `Every disaster film in the ${group.slug} from Disasters by the Decade: ${group.films.length} titles` +
    `${dominant ? `, mostly ${dominant}` : ''}, with director, country, rating and plot.`;

  return {
    title,
    description,
    alternates: { canonical: abs(`/catalogue/${group.slug}`) },
    openGraph: {
      title,
      description,
      url: abs(`/catalogue/${group.slug}`),
      type: 'article',
      siteName: 'Disasters by the Decade',
    },
    twitter: { card: 'summary_large_image', title, description },
  };
}

export default function DecadePage({ params }: Props) {
  const group = findDecade(params.decade);
  if (!group) notFound();

  const { slug, films, row } = group;
  const index = DECADES.findIndex((d) => d.slug === slug);
  const newer = DECADES[index - 1];
  const older = DECADES[index + 1];
  const mean = row?.meanRating ?? null;

  return (
    <div className="cat-page">
      <a className="skip" href="#films">Skip to the films</a>

      <header className="cat-masthead cat-masthead-tight">
        <div className="wrap">
          <p className="cat-kicker">
            <a href="/catalogue">← The Catalogue</a> · <a href="/">the essay</a>
          </p>
          <h1 className="cat-title">{slug}</h1>
          <p className="cat-decade-meta">
            {/* One interpolation, not three: React separates adjacent text nodes
                with comment markers, which HTML-to-text converters — the tools
                reading this page — turn into "90 film s of 831". */}
            {`${films.length} film${films.length === 1 ? '' : 's'} of ${summary.total}`}
            {row?.dominant ? ` · mostly ${family(row.dominant).label.toLowerCase()}` : ''}
            {mean === null ? '' : ` · mean rating ${mean.toFixed(1)}`}
            {row?.topRated ? ` · best rated ${row.topRated.t} (${row.topRated.r}/10)` : ''}
          </p>
        </div>
      </header>

      <main className="wrap cat-main" id="films">
        <ol className="cat-list">
          {films.map((f) => {
            const fam = family(f.f);
            const facts = [
              orDash(f.d) === '—' ? null : `Dir. ${f.d}`,
              country(f.c) === '—' ? null : country(f.c),
              f.r === null ? null : `${f.r}/10`,
              f.b === null ? null : money(f.b),
            ].filter(Boolean);

            return (
              <li key={`${f.t}-${f.y}-${f.id ?? ''}`} className="cat-film">
                <h2 className="cat-film-title">
                  {f.id ? (
                    <a href={tmdbUrl(f.id)} rel="noopener noreferrer nofollow">{f.t}</a>
                  ) : (
                    f.t
                  )}{' '}
                  <span className="cat-year">{f.y}</span>
                </h2>

                <p className="cat-tags">
                  <span className="cat-tag" style={{ borderColor: fam.color, color: fam.color }}>
                    {fam.label}
                  </span>
                  <span className="cat-sub">{orDash(f.s)}</span>
                </p>

                {f.p ? <p className="cat-plot">{f.p}</p> : null}
                {facts.length > 0 ? <p className="cat-facts">{facts.join(' · ')}</p> : null}
              </li>
            );
          })}
        </ol>
      </main>

      <nav className="cat-pager wrap" aria-label="Other decades">
        {older ? <a href={`/catalogue/${older.slug}`}>← {older.slug}</a> : <span />}
        <a href="/catalogue">All decades</a>
        {newer ? <a href={`/catalogue/${newer.slug}`}>{newer.slug} →</a> : <span />}
      </nav>

      <footer className="cat-foot">
        <div className="wrap">
          <p>
            Built {summary.generated}. Ratings and plot summaries from TMDB. The same catalogue as
            JSON: <a href="/data/films.json">/data/films.json</a>. How these categories were made:{' '}
            <a href="/methodology">the methodology</a>.
          </p>
        </div>
      </footer>
    </div>
  );
}
