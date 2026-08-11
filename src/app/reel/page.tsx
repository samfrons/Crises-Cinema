import type { Metadata } from 'next';
import ReelCascade from './ReelCascade';
import reelData from '../../data/reel.json';
import { licenseLabel, type ReelManifest } from '@/lib/reel';
import { abs } from '@/lib/site';
import './reel.css';

const manifest = reelData as unknown as ReelManifest;
const { clips, rejected } = manifest;

const title = 'The First Reels — Disasters by the Decade';
const description =
  'Ten public-domain disaster films, 1900–1930, streamed from the Internet Archive ' +
  'with their paperwork attached. A companion reel to Disasters by the Decade.';

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: abs('/reel') },
  openGraph: { title, description, url: abs('/reel'), type: 'article', siteName: 'Disasters by the Decade' },
  twitter: { card: 'summary_large_image', title, description },
};

export default function ReelPage() {
  const datasetCount = clips.filter((c) => c.kind === 'dataset').length;
  const first = clips[0]?.year;
  const last = clips[clips.length - 1]?.year;

  return (
    <div className="rl-page">
      <a className="skip" href="#r1">Skip to the first reel</a>

      <header className="rl-masthead">
        <div className="wrap">
          <p className="rl-kicker rise rise-1">
            From the vault · <a href="/">← A companion to Disasters by the Decade</a>
          </p>
          <h1 className="rl-mast-title rise rise-2">
            <span className="l1">The First Reels</span>
            <span className="l2">Disaster, before it was a genre</span>
          </h1>
          <p className="rl-lede rise rise-3">
            The oldest films on the list are old enough to belong to everyone. Of the{' '}
            <em>18</em> released before 1931, <em>{datasetCount}</em> could be found and cleared —
            they run here, <em>{first}</em> to <em>{last}</em>, with one reel of raw archive
            footage, every frame in the US public domain and streamed straight from the Internet
            Archive with its paperwork attached. The earliest are not fiction at all: a tripod
            set down in the wreckage, eight days after the storm. Then the studios noticed what
            a crowd will pay to watch.
          </p>
          <div className="rl-mast-foot rise rise-4">
            <span><b>{datasetCount}</b> films from the dataset</span>
            <span><b>{clips.length - datasetCount}</b> reel of adjacent archive footage</span>
            <span><b>9</b> films searched &amp; not cleared — see the paperwork</span>
            <span><a href="#r1">House lights down ↓</a></span>
          </div>
        </div>
      </header>

      <main id="main">
        <ReelCascade clips={clips} />

        <section className="rl-papers" id="papers">
          <div className="wrap">
            <p className="rl-kicker">House lights up</p>
            <h2>The paperwork</h2>
            <p className="lede-p">
              An Internet Archive license tag is a claim, not a clearance — the same search that
              found these reels also returned a 1989 documentary tagged as public domain. So
              nothing here shipped on a tag. Every clip had to pass all four tests: released
              before 1931, which makes it US public domain by age in 2026; an item date that
              corroborates the release year; no YouTube rips or trailer-dump collections; and a
              playable file. License tags were recorded as supporting evidence only.
            </p>
            <p className="lede-p">
              The dataset holds 18 films released before 1931. Nine cleared. Nine did not — they
              are listed below, because what was left out is as much a part of the method as what
              got in. Famous “public domain” disaster titles from later decades (
              <i>Night of the Living Dead</i>, <i>The Last Man on Earth</i>…) are lapsed-renewal
              cases that need title-by-title verification, so none of them appear here.
            </p>

            <div className="rl-ledger-scroll">
              <table className="rl-ledger">
                <thead>
                  <tr>
                    <th scope="col">Reel</th>
                    <th scope="col">Film</th>
                    <th scope="col">Year</th>
                    <th scope="col">Source item</th>
                    <th scope="col">Tag on item</th>
                    <th scope="col">Basis for clearance</th>
                  </tr>
                </thead>
                <tbody>
                  {clips.map((c, i) => (
                    <tr key={c.id}>
                      <td className="dim">{String(i + 1).padStart(2, '0')}</td>
                      <td>
                        {c.title}
                        {c.kind === 'archive' ? <span className="dim"> · archive footage</span> : null}
                      </td>
                      <td>{c.year}</td>
                      <td className="src-cell">
                        <a href={c.source.itemUrl} target="_blank" rel="noreferrer">
                          {c.source.identifier}
                        </a>
                      </td>
                      <td className="dim">{licenseLabel(c.source.licenseUrl)}</td>
                      <td>Published {c.year} — PD by age</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="rl-rejects">
              <h3>Searched, not cleared</h3>
              <p>
                The other nine pre-1931 films in the dataset, and why they are not on this page.
              </p>
              <ul>
                {rejected.films.map((f) => (
                  <li key={`${f.title}|${f.year}`}>
                    <b>{f.title}</b>
                    <span className="yr">{f.year}</span> — {f.reason}
                  </li>
                ))}
              </ul>

              <details>
                <summary>Specific archive items turned down ({rejected.items.length})</summary>
                <ul>
                  {rejected.items.map((r) => (
                    <li key={r.identifier}>
                      <a href={r.itemUrl} target="_blank" rel="noreferrer">{r.identifier}</a>
                      {' — '}{r.reason}
                    </li>
                  ))}
                </ul>
              </details>
            </div>

            <a className="rl-back" href="/">← Back to the decades</a>
          </div>
        </section>
      </main>
    </div>
  );
}
