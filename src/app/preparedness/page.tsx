import type { Metadata } from 'next';
import metaJson from '../../data/preparedness-meta.json';
import essayJson from '../../data/essay.json';
import { abs } from '@/lib/site';
import type { PreparednessMeta } from './types';
import PreparednessMap from './PreparednessMap';
import ScoringView from './ScoringView';
import CaseStudyCards from './CaseStudyCards';
import TwoNumbers from './TwoNumbers';
import './preparedness.css';
import Elsewhere from '@/app/components/Elsewhere';

/**
 * The field report.
 *
 * The static shell — masthead, headline facts, the six sections of the essay
 * and the colophon — is server-rendered from the build artefact, so the page
 * says something true before a single byte of JavaScript arrives. The four
 * figures are client components that fetch their own layer files and are each
 * responsible for describing their own absence.
 *
 * The essay prose in the six sections is a cited DRAFT for the site owner,
 * marked as such in the page itself. It is not written here: it lives in
 * data/essay/last-mile.json (validated by scripts/build-essay.mjs, bundled to
 * src/data/essay.json) so the page and a later in-game edition share one
 * source. Every paragraph's citations resolve to the numbered list in the
 * colophon.
 */

const meta = metaJson as unknown as PreparednessMeta;

const loaded = meta?.layersLoaded ?? [];
const stubbed = meta?.layersStubbed ?? [];
const appealYears = meta?.appealYears ?? [];
const countryCount = meta?.countryCount ?? 0;

const title = 'The Last Mile — Disasters by the Decade';
const description =
  'A field report on global disaster preparedness: six international indices mapped across '
  + `${countryCount || 170}-odd countries, fourteen official inquiries into what actually failed, `
  + 'and the gap between what the humanitarian system asks for and what it is given.';

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: abs('/preparedness') },
  openGraph: {
    title,
    description,
    url: abs('/preparedness'),
    type: 'article',
    siteName: 'Disasters by the Decade',
  },
  twitter: { card: 'summary_large_image', title, description },
};

type EssayParagraph = { text: string; cites: string[] };
type EssaySourceT = { id: string; label: string; url: string | null };
type EssaySectionT = { id: string; eyebrow: string; title: string; paragraphs: EssayParagraph[] };
type Essay = { status: 'draft' | 'ready'; updated: string; sources: EssaySourceT[]; sections: EssaySectionT[] };

const essay = (essayJson as unknown as Record<string, Essay>)['last-mile'];
/** Sources arrive ordered by first citation, so [n] is the list position. */
const srcNumber = new Map(essay.sources.map((x, i) => [x.id, i + 1]));
const section = (id: string) => essay.sections.find((x) => x.id === id)!;

/** Superscript citation marks, the same idiom as the Control Room's. */
function Cites({ ids }: { ids: string[] }) {
  if (!ids.length) return null;
  return (
    <sup className="pr-cite">
      {ids.map((id) => {
        const n = srcNumber.get(id);
        const label = essay.sources.find((x) => x.id === id)?.label ?? id;
        return n ? (
          <a key={id} href={`#essay-src-${id}`} title={label} aria-label={`Source ${n}`}>[{n}]</a>
        ) : null;
      })}
    </sup>
  );
}

/** The essay prose for one section, boxed and labelled as a draft while status is "draft". */
function EssayBody({ id }: { id: string }) {
  const paras = section(id).paragraphs.map((p, i) => (
    <p key={i}>
      {p.text}
      <Cites ids={p.cites} />
    </p>
  ));
  if (essay.status !== 'draft') return <div className="essay-body">{paras}</div>;
  return (
    <div className="essay-placeholder">
      <p className="essay-placeholder-tag">[ DRAFT — cited, for your edit ]</p>
      {paras}
    </div>
  );
}

export default function PreparednessPage() {
  const appealSpan = appealYears.length
    ? `${Math.min(...appealYears)}–${Math.max(...appealYears)}`
    : '—';

  return (
    <div className="pr-page">
      <a className="skip" href="#main">Skip to the report</a>

      <header className="pr-masthead">
        <div className="wrap">
          <p className="pr-kicker rise rise-1">
            A Crises Cinema field report · <a href="/">← Back to Disasters by the Decade</a>
          </p>
          <h1 className="pr-title rise rise-2">
            <span className="l1">The Last Mile</span>
            <span className="l2">Everything works until the warning has to reach a person</span>
          </h1>
          <p className="pr-lede rise rise-3">
            The films on the rest of this site are about the hazard: the wave, the fault, the
            virus, the fire on the ridge. The record says the hazard is rarely what kills people.
            What kills people is the last mile — the alert that reached the phones forty-six
            minutes after the first homes caught, the amnesty that legalised the building, the appeal that closed
            at sixty per cent. This page maps the machinery we built to close that mile, scores it
            against what actually happened, and prints the verdicts of the inquiries that examined
            the wreckage.
          </p>

          <dl className="pr-facts rise rise-4">
            <div>
              <dt>Indices mapped</dt>
              <dd>
                <span className="big">{loaded.length || '—'}</span>
                <span className="sub">
                  {stubbed.length
                    ? `${stubbed.length} more stubbed, licence pending`
                    : 'all layers ingested'}
                </span>
              </dd>
            </div>
            <div>
              <dt>Countries scored</dt>
              <dd>
                <span className="big">{countryCount || '—'}</span>
                <span className="sub">
                  173 of them have geometry on the map; Antarctica is dropped, having no
                  population to warn
                </span>
              </dd>
            </div>
            <div>
              <dt>Case studies</dt>
              <dd>
                <span className="big">14</span>
                <span className="sub">2004 to 2025, each with its named inquiry</span>
              </dd>
            </div>
            <div>
              <dt>Appeal record</dt>
              <dd>
                <span className="big">{appealSpan}</span>
                <span className="sub">
                  {appealYears.length
                    ? 'asked for against received, every year'
                    : 'funding layer pending'}
                </span>
              </dd>
            </div>
          </dl>
        </div>
      </header>

      <main id="main">
        {/* ── a ────────────────────────────────────────────────────────── */}
        <section className="pr-essay" id="architecture" aria-labelledby="architecture-title">
          <div className="wrap">
            <p className="eyebrow">{section('a').eyebrow}</p>
            <h2 className="section-title" id="architecture-title">{section('a').title}</h2>
            <EssayBody id="a" />
          </div>
        </section>

        <hr className="hr" />

        {/* ── b ────────────────────────────────────────────────────────── */}
        <section className="pr-essay" id="last-mile" aria-labelledby="last-mile-title">
          <div className="wrap">
            <p className="eyebrow">{section('b').eyebrow}</p>
            <h2 className="section-title" id="last-mile-title">{section('b').title}</h2>
            <EssayBody id="b" />
          </div>
        </section>

        <PreparednessMap />

        <hr className="hr" />

        {/* ── c ────────────────────────────────────────────────────────── */}
        <section className="pr-essay" id="scores" aria-labelledby="scores-title">
          <div className="wrap">
            <p className="eyebrow">{section('c').eyebrow}</p>
            <h2 className="section-title" id="scores-title">{section('c').title}</h2>
            <EssayBody id="c" />
          </div>
        </section>

        <ScoringView />

        <hr className="hr" />

        {/* ── d ────────────────────────────────────────────────────────── */}
        <section className="pr-essay" id="manmade" aria-labelledby="manmade-title">
          <div className="wrap">
            <p className="eyebrow">{section('d').eyebrow}</p>
            <h2 className="section-title" id="manmade-title">{section('d').title}</h2>
            <EssayBody id="d" />

            <CaseStudyCards />
          </div>
        </section>

        <hr className="hr" />

        {/* ── e ────────────────────────────────────────────────────────── */}
        <section className="pr-essay" id="arithmetic" aria-labelledby="arithmetic-title">
          <div className="wrap">
            <p className="eyebrow">{section('e').eyebrow}</p>
            <h2 className="section-title" id="arithmetic-title">{section('e').title}</h2>
            <EssayBody id="e" />
          </div>
        </section>

        <TwoNumbers />

        <hr className="hr" />

        {/* ── f ────────────────────────────────────────────────────────── */}
        <section className="pr-essay" id="cinema" aria-labelledby="cinema-title">
          <div className="wrap">
            <p className="eyebrow">{section('f').eyebrow}</p>
            <h2 className="section-title" id="cinema-title">{section('f').title}</h2>
            <EssayBody id="f" />
          </div>
        </section>
      </main>

      {/* ── Colophon ───────────────────────────────────────────────────── */}
      <footer className="pr-colophon">
        <div className="wrap">
          <h2>How this page was assembled</h2>
          <p>
            <b>The essay text on this page is a cited draft</b>, marked as such in every section,
            for the site owner to edit. Each paragraph carries numbered sources, listed below; a
            claim with no source here is a claim this draft declined to make. Wherever a number is
            our own arithmetic, or a correlation computed from the layers on this page, the text
            says so, and a correlation is an association, never a cause.
          </p>
          <p>
            Every number on this page is fetched at runtime from{' '}
            <code>/data/preparedness/</code>, written by a build script from public sources. A
            source the pipeline cannot license or reach ships as a stub, and the page renders the
            absence rather than an estimate: no interpolation, no carrying a value forward from
            last year, no borrowing a neighbour&rsquo;s score. Where a layer is missing you will
            see hatching and a sentence explaining what is missing and how to get it.
            {loaded.length || stubbed.length ? (
              <>
                {' '}This build has {loaded.length} layer{loaded.length === 1 ? '' : 's'} loaded
                {stubbed.length ? ` and ${stubbed.length} stubbed` : ''}
                {meta?.generated ? `, generated ${meta.generated}` : ''}.
              </>
            ) : null}
          </p>

          <h3>The sources</h3>
          <dl className="pr-sources">
            <div>
              <dt>INFORM Risk Index</dt>
              <dd>European Commission Joint Research Centre and the Inter-Agency Standing Committee. Open data.</dd>
            </div>
            <div>
              <dt>ND-GAIN Country Index</dt>
              <dd>University of Notre Dame Global Adaptation Initiative. Open data, attribution required.</dd>
            </div>
            <div>
              <dt>EM-DAT</dt>
              <dd>
                Centre for Research on the Epidemiology of Disasters, UCLouvain.{' '}
                <b>Non-commercial use only</b> — redistribution of the underlying records is
                restricted, so this page carries derived country aggregates and links back to the
                source rather than republishing it.
              </dd>
            </div>
            <div>
              <dt>IDMC Global Internal Displacement Database</dt>
              <dd>Internal Displacement Monitoring Centre, Norwegian Refugee Council. Creative Commons.</dd>
            </div>
            <div>
              <dt>IHR States Parties Self-Assessment (SPAR)</dt>
              <dd>World Health Organization. Self-reported by member states — a declaration of capacity, not a measurement of it.</dd>
            </div>
            <div>
              <dt>Sendai Framework Monitor / MHEWS</dt>
              <dd>UNDRR and WMO. Reported coverage of multi-hazard early warning, target G.</dd>
            </div>
            <div>
              <dt>Humanitarian appeals</dt>
              <dd>UN OCHA Financial Tracking Service, with the Global Humanitarian Overview. Open data.</dd>
            </div>
            <div>
              <dt>Base map</dt>
              <dd>Natural Earth 1:110m admin-0 boundaries, public domain, projected equirectangular at build time.</dd>
            </div>
          </dl>

          <h3 id="essay-sources">Sources for this essay</h3>
          <ol className="pr-essay-sources">
            {essay.sources.map((x, i) => (
              <li key={x.id} id={`essay-src-${x.id}`}>
                <span className="pr-src-num">[{i + 1}]</span>{' '}
                {x.url ? <a href={x.url} rel="noopener noreferrer">{x.label}</a> : x.label}
              </li>
            ))}
          </ol>
          <p className="pr-built">
            Draft updated {essay.updated}. Prose and sources live in one file,{' '}
            <code>data/essay/last-mile.json</code>, checked by <code>scripts/build-essay.mjs</code>:
            every paragraph with a number must cite a source that exists.
          </p>

          <Elsewhere current="/preparedness" tone="dark" />
          <p className="pr-built">
            Case-study cards are editorial drafts written from the public record and pending the
            site owner&rsquo;s review. Inquiry findings are quoted or paraphrased from the named
            reports; casualty figures are the naming institution&rsquo;s and several remain
            contested.
          </p>
        </div>
      </footer>
    </div>
  );
}
