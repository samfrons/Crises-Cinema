import Hero from './components/Hero';
import FearIndex from './components/FearIndex';
import summaryData from '../data/summary.json';
import type { Summary } from '@/lib/taxonomy';

// Aggregates are computed at build time by scripts/build-data.mjs, so the hero
// and the chart render as static HTML. Only the film catalogue is fetched.
const summary = summaryData as unknown as Summary;

export default function Page() {
  return (
    <>
      <a className="skip" href="#reel">Skip to the chart</a>

      <Hero summary={summary} />
      <hr className="hr" />

      <main id="main">
        <FearIndex summary={summary} />
      </main>

      <footer className="colophon">
        <div className="wrap">
          <div>
            <h2>About this</h2>
            <p>
              Disaster movies are a guilty pleasure turned scholarly pursuit. Each era’s
              on-screen catastrophes track its anxieties with uncanny precision, so charting
              them is less a film buff’s hobby than a seismograph of the shared psyche —
              a timeline of cultural tremors, one mushroom cloud at a time.
            </p>
            <p>
              It is also, admittedly, a personal guide to cinematic Armageddon. In the world of
              disaster movies the end is only the beginning of understanding.
            </p>
            <p>
              <a
                href="/atlas"
                style={{
                  fontFamily: 'var(--data)',
                  fontSize: 11.5,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  color: 'var(--paper)',
                  textDecoration: 'none',
                  borderBottom: '1px solid var(--ember)',
                  paddingBottom: 2,
                }}
              >
                See where it all happens — the Atlas of Ruin →
              </a>
            </p>
            <p>
              <a
                href="/reel"
                style={{
                  fontFamily: 'var(--data)',
                  fontSize: 11.5,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  color: 'var(--paper)',
                  textDecoration: 'none',
                  borderBottom: '1px solid var(--ember)',
                  paddingBottom: 2,
                }}
              >
                Watch the first reels — ten public-domain films, 1900–1930 →
              </a>
            </p>
          </div>

          <div>
            <h3>How the categories were made</h3>
            <p>
              The source data labelled these films with 105 different disaster types, 49 main
              categories and 191 subcategories — much of it inconsistent, some of it mangled by
              a bad comma-split. Those were consolidated into eleven families under four
              headings. Each film’s original, finer label is still what appears on its card.
            </p>
            <p>
              Judgement calls were made. A film with a stated cause is filed under that cause
              rather than its setting, so Mad Max: Fury Road counts as Atomic and not as a
              post-apocalyptic film. Where the source contradicts itself, the more specific
              signal wins.
            </p>
            <p>
              <a
                href="/methodology"
                style={{
                  fontFamily: 'var(--data)',
                  fontSize: 11.5,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  color: 'var(--paper)',
                  textDecoration: 'none',
                  borderBottom: '1px solid var(--ember)',
                  paddingBottom: 2,
                }}
              >
                Read the full methodology →
              </a>
            </p>
          </div>

          <div>
            <h3>The data</h3>
            <dl>
              <dt>Films</dt>
              <dd>{summary.total}, released {summary.firstYear}–{summary.lastYear}</dd>
              <dt>With a rating</dt>
              <dd>{summary.withRating}</dd>
              <dt>With box office</dt>
              <dd>{summary.withBoxOffice} — the rest unrecorded</dd>
              <dt>Most common origin</dt>
              <dd>{summary.countries[0]?.[0]} ({summary.countries[0]?.[1]} films)</dd>
              <dt>Ratings &amp; posters</dt>
              <dd>TMDB</dd>
              <dt>Data built</dt>
              <dd>{summary.generated}</dd>
            </dl>
            <p>
              {/* The explorer above loads its films after paint, so this static
                  index is the version that survives a reader with no scripts —
                  and the one search engines and assistants actually read. */}
              <a
                href="/catalogue"
                style={{
                  fontFamily: 'var(--data)',
                  fontSize: 11.5,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  color: 'var(--paper)',
                  textDecoration: 'none',
                  borderBottom: '1px solid var(--ember)',
                  paddingBottom: 2,
                }}
              >
                Browse all {summary.total} films as a plain index →
              </a>
            </p>
          </div>
        </div>
      </footer>
    </>
  );
}
