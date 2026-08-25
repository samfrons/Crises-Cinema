import type { Metadata } from 'next';
import atlasData from '../../data/atlas.json';
import AtlasView, { type Atlas } from './AtlasView';
import './atlas.css';

const atlas = atlasData as unknown as Atlas;

const title = 'The Atlas of Ruin — Disasters by the Decade';
const description =
  `Where the world ends, according to Hollywood: ${atlas.pinnedFilms} disaster films pinned to ` +
  `${atlas.places.length} named places on a retro territory map — plus the ${atlas.spaceTotal} ` +
  'films whose catastrophe leaves Earth altogether.';

export const metadata: Metadata = {
  title,
  description,
  openGraph: { title, description, type: 'article', siteName: 'Disasters by the Decade' },
  twitter: { card: 'summary_large_image', title, description },
};

export default function AtlasPage() {
  const topPlace = atlas.places[0];

  return (
    <div className="atlas-page">
      <a className="skip" href="#territories">Skip to the map</a>

      <header className="at-masthead">
        <div className="wrap">
          <p className="at-kicker rise rise-1">
            The territories · <a href="/">← Back to Disasters by the Decade</a>
          </p>
          <h1 className="at-title rise rise-2">
            <span className="l1">The Atlas of Ruin</span>
            <span className="l2">Where the world ends, by name</span>
          </h1>
          <p className="at-lede rise rise-3">
            Every film in the catalogue was asked one question: <em>where does your catastrophe
            happen?</em> The {atlas.pinnedFilms} that answer with a real place are pinned below,
            exactly where their synopses put them. The {atlas.spaceTotal} that answer
            &ldquo;not on Earth&rdquo; get a chart of their own.
          </p>

          <dl className="at-facts rise rise-4">
            <div>
              <dt>Places named</dt>
              <dd><span className="big">{atlas.places.length}</span></dd>
            </div>
            <div>
              <dt>Films pinned</dt>
              <dd><span className="big">{atlas.pinnedFilms}</span></dd>
            </div>
            <div>
              <dt>Most struck</dt>
              <dd>
                <span className="big">{topPlace.label}</span>
                <span className="sub">{topPlace.films.length} films and counting</span>
              </dd>
            </div>
            <div>
              <dt>Leave Earth entirely</dt>
              <dd><span className="big">{atlas.spaceTotal}</span></dd>
            </div>
          </dl>
        </div>
      </header>

      <AtlasView atlas={atlas} />

      <footer className="at-colophon">
        <div className="wrap">
          <h2>How the pins were placed</h2>
          <p>
            A film lands on this map only when its own title or synopsis names a real place —
            a gazetteer of about 130 cities, countries, mountains and oceans is matched against
            the text, and when a synopsis names both a city and its country, the city wins.
            Where a synopsis name-drops a place the story never visits (a premiere, a
            nationality), the pin is struck by hand.
          </p>
          <p>
            That standard leaves {atlas.total - atlas.located} of the {atlas.total} films off
            the map: their synopses end the world somewhere unnamed. The setting is not the
            country of origin — that is a different map, told in the{' '}
            <a href="/#explorer">catalogue</a>. Full sausage-making in the{' '}
            <a href="/methodology">methodology</a>.
          </p>
        </div>
      </footer>
    </div>
  );
}
