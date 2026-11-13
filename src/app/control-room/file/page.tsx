import type { Metadata } from 'next';
import { Fragment } from 'react';
import essayJson from '../../../data/essay.json';
import { abs } from '@/lib/site';
import Elsewhere from '@/app/components/Elsewhere';
import { inWords, WPM } from '../summary';
import { FOLDER_IDS, folderWord, isFolder, type FolderId } from './folders';
import { XREFS, STAMPS, checkFile, type XRef } from './xrefs';
import FolderControls from './FolderControls';
import '../control-room.css';
import './file.css';

/**
 * The desk officer's file — /control-room/file.
 *
 * The preparedness essay, filed for reading inside the Control Room's world:
 * a cover sheet, then one folder per section, each a native disclosure with
 * the section's paragraphs as memos, its [n] marks resolving to the same
 * numbered sources as /preparedness, one stamped line, and cross-reference
 * slips out to the desk and to the figures.
 *
 * Single source of truth: every word of the essay printed here comes from
 * src/data/essay.json (bundled from data/essay/last-mile.json by
 * scripts/build-essay.mjs) at build, exactly as /preparedness prints it.
 * The page adds interface copy around the text and never edits it; the
 * stamps are checked verbatim against it (xrefs.ts), and the build stops if
 * they drift. Server-rendered throughout: the only script is the folder
 * controls, and every folder's text is in the HTML whether open or shut.
 */

type EssayParagraph = { text: string; cites: string[] };
type EssaySourceT = { id: string; label: string; url: string | null };
type EssaySectionT = { id: string; eyebrow: string; title: string; paragraphs: EssayParagraph[] };
type Essay = { status: 'draft' | 'ready'; updated: string; sources: EssaySourceT[]; sections: EssaySectionT[] };

const essay = (essayJson as unknown as Record<string, Essay>)['last-mile'];
const sections = essay.sections.filter((s) => isFolder(s.id));
if (sections.length !== FOLDER_IDS.length) {
  throw new Error(`control-room/file: expected ${FOLDER_IDS.length} essay sections a–f, found ${sections.length}`);
}
checkFile(sections);

/** Sources arrive ordered by first citation, so [n] is the list position —
 *  the same number the reader meets on /preparedness. */
const srcNumber = new Map(essay.sources.map((x, i) => [x.id, i + 1]));
const draft = essay.status === 'draft';

const words = (s: EssaySectionT) => s.paragraphs.reduce((n, p) => n + p.text.split(/\s+/).filter(Boolean).length, 0);
const minutes = (s: EssaySectionT) => Math.max(1, Math.round(words(s) / WPM));
const totalMinutes = Math.max(1, Math.round(sections.reduce((n, s) => n + words(s), 0) / WPM));
const citedIn = (s: EssaySectionT) => new Set(s.paragraphs.flatMap((p) => p.cites)).size;

const title = 'The Desk Officer’s File — The Control Room';
const description =
  'The Last Mile essay, filed for reading at the Control Room desk: six folders on why warnings fail '
  + 'at the last mile, every paragraph cited, each cross-referenced to the real days you can play.';

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: abs('/control-room/file') },
  openGraph: {
    title,
    description,
    url: abs('/control-room/file'),
    type: 'article',
    siteName: 'Disasters by the Decade',
  },
  twitter: { card: 'summary_large_image', title, description },
};

function Cites({ ids }: { ids: string[] }) {
  if (!ids.length) return null;
  return (
    <sup className="cr-cite cf-cite">
      {ids.map((id) => {
        const n = srcNumber.get(id);
        const label = essay.sources.find((x) => x.id === id)?.label ?? id;
        return n ? (
          <a key={id} href={`#file-src-${id}`} title={label} aria-label={`Source ${n}`}>[{n}]</a>
        ) : null;
      })}
    </sup>
  );
}

const SLIP_GLYPH: Record<XRef['kind'], string> = {
  desk: '◉',
  research: '◌',
  figure: '▦',
  page: '→',
};

function Slip({ x }: { x: XRef }) {
  return (
    <aside className={`cf-slip cf-slip-${x.kind}`} aria-label={`Cross-reference: ${x.title}`}>
      <p className="cf-slip-tag"><span className="cf-slip-glyph" aria-hidden>{SLIP_GLYPH[x.kind]}</span> {x.tag}</p>
      <p className="cf-slip-title">{x.title}</p>
      <p className="cf-slip-body">{x.body}</p>
      <a className="cf-slip-go" href={x.href}>{x.cta} <span aria-hidden>→</span></a>
    </aside>
  );
}

function Folder({ s, index }: { s: EssaySectionT; index: number }) {
  const id = s.id as FolderId;
  const n = index + 1;
  const stamp = STAMPS[id];
  const slips = XREFS[id];
  const next = sections[index + 1];
  return (
    <details className="cf-folder" id={`file-${id}`} open={index === 0}>
      <summary className="cf-tab">
        <span className="cf-tab-label">
          <span className="cf-tab-file">File {id.toUpperCase()}</span>
          <span className="cf-tab-eyebrow">{s.eyebrow}</span>
        </span>
        <h2 className="cf-folder-title">{s.title}</h2>
        <span className="cf-tab-meta">
          {inWords(s.paragraphs.length)} memos · {citedIn(s)} sources · about {minutes(s)} min
          <span className="cf-tab-state" aria-hidden />
        </span>
      </summary>

      <div className="cf-folder-body">
        {s.paragraphs.map((p, j) => (
          <Fragment key={j}>
            <div className="cf-memo" style={{ '--j': j } as React.CSSProperties}>
              <p className="cf-memo-no" aria-hidden>¶ {n}.{j + 1}</p>
              <p className="cf-memo-text">
                {p.text}
                <Cites ids={p.cites} />
              </p>
            </div>
            {stamp.para === j && (
              // A repeat of a sentence printed just above: aria-hidden so a
              // screen reader hears the paragraph once.
              <figure className="cf-stamp" aria-hidden>
                <p className="cf-stamp-mark">Marked · ¶ {n}.{j + 1}</p>
                <blockquote className="cf-stamp-line">{stamp.sentence}</blockquote>
              </figure>
            )}
            {slips.filter((x) => x.after === j).map((x) => <Slip key={x.href + x.title} x={x} />)}
          </Fragment>
        ))}

        <p className="cf-next">
          {next ? (
            <a href={`#file-${next.id}`}>
              <span className="cf-next-tag">Next folder · {folderWord(next.id as FolderId)}</span>
              <span className="cf-next-title">{next.title} <span aria-hidden>→</span></span>
            </a>
          ) : (
            <a href="/control-room">
              <span className="cf-next-tag">End of the file</span>
              <span className="cf-next-title">Back to the desk <span aria-hidden>→</span></span>
            </a>
          )}
        </p>
      </div>
    </details>
  );
}

export default function DeskOfficersFile() {
  return (
    <div className="cr-page cf-page">
      <a className="skip" href="#file">Skip to the file</a>

      <header className="cr-masthead cf-masthead">
        <div className="wrap">
          <p className="cr-kicker rise rise-1">
            <a href="/control-room">← The Control Room</a>
            <span aria-hidden>·</span>
            <span>Filed at the desk</span>
          </p>
          <h1 className="cr-title cf-title rise rise-2">
            <span className="l1">The Desk Officer&rsquo;s File</span>
            <span className="l2">The argument behind these days, in six folders</span>
          </h1>
          <p className="cr-lede rise rise-3">
            Both days now on the desk end the same way: the forecast was there, and the warning reached
            people after the danger did. This is the file a desk officer would want read before the next
            shift. It is the
            Last Mile essay, folder by folder, with a slip wherever a claim is one you can hold on the
            desk yourself.
          </p>
          <p className="cf-mast-meta rise rise-4">
            {inWords(sections.length)} folders · {essay.sources.length} sources · about {totalMinutes} min to read
          </p>
        </div>
      </header>

      <main id="file" className="cf-desk" tabIndex={-1}>
        <div className="wrap cf-wrap">
          <section className="cf-cover" aria-labelledby="cf-cover-h">
            <CoverArt />
            {draft && <p className="cf-draft">Draft — cited, for your edit</p>}
            <h2 id="cf-cover-h" className="cf-cover-h">Cover sheet</h2>
            <dl className="cf-cover-dl">
              <div>
                <dt>What this is</dt>
                <dd>
                  The same essay as <a href="/preparedness">The Last Mile</a>, filed for reading at the desk:
                  one folder per section, nothing rewritten. The figures stay on that page; slips here
                  point to them.
                </dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>{draft ? `A cited draft, updated ${essay.updated}, for the site owner’s edit.` : `Updated ${essay.updated}.`}</dd>
              </div>
              <div>
                <dt>How to read it</dt>
                <dd>
                  [n] is a source, numbered as on The Last Mile. A stamped line repeats one sentence of
                  its folder. A slip is a cross-reference, in our words, to a day on the desk or a figure.
                </dd>
              </div>
            </dl>

            <nav className="cf-index" aria-labelledby="cf-index-h">
              <h3 id="cf-index-h" className="cf-index-h">In this file</h3>
              <ol>
                {sections.map((s) => (
                  <li key={s.id}>
                    <a href={`#file-${s.id}`}>
                      <span className="cf-index-file">File {s.id.toUpperCase()}</span>
                      <span className="cf-index-title">{s.title}</span>
                      <span className="cf-index-eyebrow">{s.eyebrow}</span>
                    </a>
                  </li>
                ))}
              </ol>
            </nav>
            <FolderControls />
          </section>

          <div className="cf-folders">
            {sections.map((s, i) => <Folder key={s.id} s={s} index={i} />)}
          </div>

          <section className="cf-sources" aria-labelledby="file-sources">
            <h2 id="file-sources" className="cf-sources-h">Sources for this file</h2>
            <p className="cf-sources-note">Numbered as on The Last Mile: [n] here is [n] there.</p>
            <ol>
              {essay.sources.map((x, i) => (
                <li key={x.id} id={`file-src-${x.id}`}>
                  <span className="cr-src-num">[{i + 1}]</span>{' '}
                  {x.url ? <a href={x.url} rel="noopener noreferrer">{x.label}</a> : x.label}
                </li>
              ))}
            </ol>
          </section>
        </div>
      </main>

      <footer className="cr-colophon">
        <div className="wrap">
          <p>
            <b>How this file was made.</b> Every word of the essay here is printed from{' '}
            <code>data/essay/last-mile.json</code>, the single file that The Last Mile also renders, checked
            by <code>scripts/build-essay.mjs</code> so that a paragraph carrying a number must cite a source
            that exists. The stamped lines repeat a sentence of their folder, and the page will not build if
            one stops matching the text. The slips are interface copy; the times, dates and decision numbers
            they print are read from the Control Room&rsquo;s own scenario bundle, which carries their
            citations.
          </p>
          <p>
            <b>What it does not do.</b> The file adds no figure of its own and no claim the essay does not
            make. It is a draft, and says so on its cover. Where the essay sets a correlation, it is an
            association, never a cause; where it sets two days of the desk side by side, the essay itself
            notes that two is a small number.
          </p>
          <Elsewhere current="/control-room" />
        </div>
      </footer>
    </div>
  );
}

/** The cover sheet's drawing: the desk at night, in the route's ink line —
 *  a lamp over a stack of tabbed folders, and a telephone.
 *  Pure decoration: it encodes nothing (the stack is not a count; the file's
 *  folder count is printed in the masthead), so it is hidden from assistive
 *  technology. */
function CoverArt() {
  return (
    <svg className="cf-cover-art" viewBox="0 0 240 190" aria-hidden focusable="false">
      {/* the pool of light the lamp throws across the desk */}
      <path className="cf-art-light" d="M120 86L52 176h132L156 86z" />
      {/* the desk's edge */}
      <path d="M4 176h232" />
      {/* a stack of folders, the top one's tabs set a step along */}
      <g className="cf-art-stack">
        <path d="M18 176v-10h126v10z" />
        <path d="M22 166v-10h120v10z" />
        <path d="M16 156v-10h128v10z" />
        <path d="M22 146v-10h118v10z" />
        <path d="M18 136v-12h124v12z" />
        <path d="M26 124v-7h24v7M56 124v-7h24v7M86 124v-7h24v7" />
        <path d="M30 130h56M30 133.5h36" strokeDasharray="2 3" />
      </g>
      {/* the telephone, on the desk beside the stack */}
      <path d="M154 176l4-11h28l4 11z" />
      <path d="M152 163c0-7 10-10 20-10s20 3 20 10l-5 3h-30z" />
      <circle cx="172" cy="170" r="2.6" />
      {/* the lamp: weighted base, two arms at their pivots, the shade */}
      <path d="M200 176c0-5 5-7 15-7s15 2 15 7z" />
      <path d="M215 169L198 112L150 62" />
      <circle cx="215" cy="169" r="2.6" />
      <circle cx="198" cy="112" r="2.6" />
      <path d="M152 56L116 86h42z" />
      <circle cx="152" cy="58" r="2.6" />
    </svg>
  );
}
