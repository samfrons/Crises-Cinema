import type { Metadata } from 'next';
import dispatchesData from '../../data/dispatches.json';
import landData from '../../../data/land-dots.json';
import { family } from '@/lib/taxonomy';
import { monthLabel } from '@/lib/months';
import DispatchesView, { type Dispatches } from './DispatchesView';
import './dispatches.css';

// The snapshot is fetched from the Arctic Shift archive of Reddit by
// scripts/build-dispatches.mjs and committed, so the page builds with no
// network and no keys. The land grid is the same one the atlas rasterises.
const data = {
  ...(dispatchesData as unknown as Omit<Dispatches, 'land'>),
  land: landData as Dispatches['land'],
} as Dispatches;

const title = 'Dispatches from the Ground — Disasters by the Decade';
const description =
  `The control group for a site about disaster movies: ${data.totalIndexed.toLocaleString()} real ` +
  `disaster posts from ${data.subs.length} corners of Reddit since ${data.indexAfter.slice(0, 4)}, ` +
  `pinned to ${data.places.length} places on a map you can play through time — with the actual ` +
  'footage, filed into the same eleven families as the films.';

export const metadata: Metadata = {
  title,
  description,
  openGraph: { title, description, type: 'article', siteName: 'Disasters by the Decade' },
  twitter: { card: 'summary_large_image', title, description },
};

export default function DispatchesPage() {
  const topPlace: Dispatches['places'][number] | undefined = data.places[0];
  const mixed = data.subs.filter((s) => s.mixed).length;

  return (
    <div className="dis-page">
      <a className="skip" href="#map">Skip to the map</a>

      <header className="dis-masthead">
        <div className="wrap">
          <p className="dis-kicker rise rise-1">
            The control group · <a href="/">← Back to Disasters by the Decade</a>
          </p>
          <h1 className="dis-title rise rise-2">
            <span className="l1">Dispatches from the Ground</span>
            <span className="l2">The disasters that actually happened</span>
          </h1>
          <p className="dis-lede rise rise-3">
            The rest of this site charts catastrophe as Hollywood imagined it. This page charts
            the real thing, as witnessed: {data.totalIndexed.toLocaleString()} posts from the
            corners of Reddit where people upload the tornado on their street and the fire on
            their ridge — pinned to the map, played through time, and filed into the{' '}
            <em>same eleven families as the films</em>. The fiction and the footage, finally on
            one taxonomy.
          </p>

          <dl className="dis-facts rise rise-4">
            <div>
              <dt>Dispatches indexed</dt>
              <dd><span className="big">{data.totalIndexed.toLocaleString()}</span></dd>
            </div>
            <div>
              <dt>Subreddits watched</dt>
              <dd><span className="big">{data.subs.length}</span></dd>
            </div>
            {topPlace && (
              <div>
                <dt>Loudest place</dt>
                <dd>
                  <span className="big">{topPlace.label}</span>
                  <span className="sub">{topPlace.total.toLocaleString()} post{topPlace.total === 1 ? '' : 's'} on record</span>
                </dd>
              </div>
            )}
            {data.peakMonth && (
              <div>
                <dt>Busiest month</dt>
                <dd>
                  <span className="big">{monthLabel(data.peakMonth.m)}</span>
                  <span className="sub">{data.peakMonth.n.toLocaleString()} posts in one month</span>
                </dd>
              </div>
            )}
          </dl>
        </div>
      </header>

      <DispatchesView data={data} />

      <footer className="dis-colophon">
        <div className="wrap">
          <h2>How the wire was tapped</h2>
          <p>
            The posts come from the Arctic Shift public archive of Reddit — every post to the{' '}
            {data.subs.length} subreddits below, {data.indexAfter.slice(0, 4)} to present, titles
            and vote counts as archived. A post lands on the map only when its own title names a
            real place, matched against the same kind of hand-built gazetteer the{' '}
            <a href="/atlas">Atlas of Ruin</a> uses for films; that standard leaves{' '}
            {(data.totalIndexed - data.located).toLocaleString()} dispatches off the map, ending
            their worlds somewhere unnamed.
          </p>
          <p>
            The ontology is inherited, not invented: each single-hazard subreddit is filed into
            one of the film taxonomy&rsquo;s eleven families, and the {mixed} general wires have
            each post classified from its title with the same kind of keyword rules that sorted
            the films. Where a title resists classification it stays Unsorted rather than guessed.
            Scores are the archive&rsquo;s snapshot, not live; removed posts are dropped from the
            evidence wall.
          </p>
          <p>
            These dispatches show disasters as they land; for who was ready for them — risk
            indices, official inquiries and the funding arithmetic — see{' '}
            <a href="/preparedness">the preparedness essay</a>.
          </p>

          <div className="table-scroll">
            <table className="counts dis-sub-table">
              <thead>
                <tr><th>Subreddit</th><th>Filed under</th><th>Posts since 2012</th><th>What it covers</th></tr>
              </thead>
              <tbody>
                {data.subs.map((s) => (
                  <tr key={s.name}>
                    <td>
                      <a href={`https://www.reddit.com/r/${s.name}/`} target="_blank" rel="noreferrer">
                        r/{s.name}
                      </a>
                    </td>
                    <td>
                      <i className="dis-swatch" style={{ background: family(s.family).color }} />
                      {family(s.family).label}{s.mixed ? ' (mixed — filed per post)' : ''}
                    </td>
                    <td>{s.total.toLocaleString()}</td>
                    <td className="dis-gloss">{s.gloss}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="dis-built">
            Snapshot built {data.generated} · refresh with <code>npm run build:dispatches</code> ·
            full sausage-making in the <a href="/methodology">methodology</a>
          </p>
        </div>
      </footer>
    </div>
  );
}
