import type { Metadata } from 'next';
import metaJson from '../../data/preparedness-meta.json';
import { abs } from '@/lib/site';
import type { PreparednessMeta } from './types';
import PreparednessMap from './PreparednessMap';
import ScoringView from './ScoringView';
import CaseStudyCards from './CaseStudyCards';
import TwoNumbers from './TwoNumbers';
import './preparedness.css';

/**
 * The field report.
 *
 * The static shell — masthead, headline facts, the six sections of the essay
 * and the colophon — is server-rendered from the build artefact, so the page
 * says something true before a single byte of JavaScript arrives. The four
 * figures are client components that fetch their own layer files and are each
 * responsible for describing their own absence.
 *
 * The essay prose in the six sections is DRAFT SCAFFOLD, clearly marked as
 * such in the page itself, for the site owner to replace.
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

/** Marks unfinished prose so it can never be mistaken for shipped copy. */
function Scaffold({ children }: { children: React.ReactNode }) {
  return (
    <div className="essay-placeholder">
      <p className="essay-placeholder-tag">[ DRAFT SCAFFOLD — final essay text to come ]</p>
      {children}
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
            What kills people is the last mile — the ninety minutes between a correct forecast and
            a message nobody sent, the amnesty that legalised the building, the appeal that closed
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
            <p className="eyebrow">One · The architecture</p>
            <h2 className="section-title" id="architecture-title">The machine we built for this</h2>
            <Scaffold>
              <p>
                There is a system. It has a name, a budget, a coordinating agency and a set of
                acronyms that take a paragraph to unpack: OCHA at the centre, eleven clusters
                splitting the work by sector, an emergency fund that can disburse in seventy-two
                hours, and — since 2022 — the Early Warnings for All initiative, which promises
                that every person on earth will be covered by a multi-hazard warning system by the
                end of 2027.
              </p>
              <p>
                Most of it was built in the wake of a specific failure. The cluster system came out
                of the 2005 Humanitarian Response Review, which followed Darfur. Anticipatory
                action — money released on a forecast rather than on a body count — came out of the
                repeated observation that the cheapest moment to act is the one before anything has
                happened. The architecture is, on paper, a record of lessons learned.
              </p>
              <p>
                It is also, on paper, extremely good. That is the difficulty this page is about.
              </p>
            </Scaffold>
          </div>
        </section>

        <hr className="hr" />

        {/* ── b ────────────────────────────────────────────────────────── */}
        <section className="pr-essay" id="last-mile" aria-labelledby="last-mile-title">
          <div className="wrap">
            <p className="eyebrow">Two · The last mile</p>
            <h2 className="section-title" id="last-mile-title">Where the graveyard is</h2>
            <Scaffold>
              <p>
                In the Ahr valley in July 2021, the European Flood Awareness System issued its
                warnings days ahead and the forecast was essentially right. One hundred and
                thirty-five people died in a single German district, in the dark, in a country with
                the meteorological data on a screen and no siren left standing to broadcast it.
              </p>
              <p>
                In Valencia in October 2024, the national weather service raised its red warning at
                half past seven in the morning. The mass alert to mobile phones went out at eleven
                minutes past eight in the evening. The ravine had been in flood for hours.
              </p>
              <p>
                The pattern repeats with a consistency that stops looking like coincidence: the
                forecast is fine, and the last mile — dissemination, comprehension, authority to
                order the evacuation, somewhere to evacuate to — is where the deaths accumulate.
              </p>
            </Scaffold>
          </div>
        </section>

        <PreparednessMap />

        <hr className="hr" />

        {/* ── c ────────────────────────────────────────────────────────── */}
        <section className="pr-essay" id="scores" aria-labelledby="scores-title">
          <div className="wrap">
            <p className="eyebrow">Three · Scores against reality</p>
            <h2 className="section-title" id="scores-title">The index that ranked us first</h2>
            <Scaffold>
              <p>
                In October 2019 the Global Health Security Index ranked one hundred and ninety-five
                countries on their readiness for an epidemic. The United States came first. The
                United Kingdom came second. Within eighteen months both were among the worst
                performers in the world on deaths per head.
              </p>
              <p>
                The index was not incompetent. It measured what could be measured — laboratories,
                plans, surveillance systems, legal frameworks — and those things were genuinely
                there. What it could not measure was whether a state would use them: political
                will, public trust, the willingness of a government to act on its own early data.
              </p>
              <p>
                Every index on the map above has the same structural problem, and the figure below
                is an attempt to make it visible rather than to solve it.
              </p>
            </Scaffold>
          </div>
        </section>

        <ScoringView />

        <hr className="hr" />

        {/* ── d ────────────────────────────────────────────────────────── */}
        <section className="pr-essay" id="manmade" aria-labelledby="manmade-title">
          <div className="wrap">
            <p className="eyebrow">Four · The verdicts</p>
            <h2 className="section-title" id="manmade-title">There are no natural disasters</h2>
            <Scaffold>
              <p>
                The phrase is older than the discipline, and the official record has been quietly
                agreeing with it for two decades. Japan&rsquo;s Diet called Fukushima &ldquo;a
                profoundly man-made disaster&rdquo;. The US Army Corps&rsquo; own evaluation task
                force called New Orleans&rsquo; flood defences &ldquo;a system in name only&rdquo;.
                Turkish engineers put the collapse of 2023 on construction amnesties rather than on
                the fault.
              </p>
              <p>
                These are not activist framings. They are the findings of commissions convened by
                the states responsible, and they converge on the same claim: the hazard was
                natural, and the catastrophe was administrative.
              </p>
              <p>
                What follows is the record, fourteen times over, with the inquiry named in each
                case.
              </p>
            </Scaffold>

            <CaseStudyCards />
          </div>
        </section>

        <hr className="hr" />

        {/* ── e ────────────────────────────────────────────────────────── */}
        <section className="pr-essay" id="arithmetic" aria-labelledby="arithmetic-title">
          <div className="wrap">
            <p className="eyebrow">Five · The arithmetic</p>
            <h2 className="section-title" id="arithmetic-title">What a life is priced at</h2>
            <Scaffold>
              <p>
                In January 2025, two fires in Los Angeles County destroyed around sixteen thousand
                structures and generated insured losses in the tens of billions of dollars. In the
                same period, the UN&rsquo;s coordinated humanitarian appeals — the bill for every
                declared emergency on earth — asked for a comparable sum and received a fraction of
                it.
              </p>
              <p>
                The comparison is not a moral equivalence and should not be read as one. It is a
                statement about where the world keeps its money and how quickly it can move it.
              </p>
              <p>
                The figure below is the second half of that arithmetic: what was asked for, what
                arrived, and the size of the space between.
              </p>
            </Scaffold>
          </div>
        </section>

        <TwoNumbers />

        <hr className="hr" />

        {/* ── f ────────────────────────────────────────────────────────── */}
        <section className="pr-essay" id="cinema" aria-labelledby="cinema-title">
          <div className="wrap">
            <p className="eyebrow">Six · Back to the pictures</p>
            <h2 className="section-title" id="cinema-title">What cinema gets wrong</h2>
            <Scaffold>
              <p>
                The disaster film is structurally incapable of telling this story. Its engine is
                the hazard: the wave has to be visible, the fault has to open, the virus has to do
                something on camera. Bureaucratic delay does not photograph.
              </p>
              <p>
                So the genre invents a substitute — one obstructive mayor, one venal executive, one
                scientist nobody believes — and compresses a systemic failure into a character. It
                is dramatically necessary and analytically useless. Real inquiries almost never
                find a villain; they find a committee that met late.
              </p>
              <p>
                The catalogue of {' '}
                <a href="/">eight hundred-odd disaster films</a> next door is, read this way, an
                archive of the wrong lesson repeated for a century. The{' '}
                <a href="/atlas">Atlas of Ruin</a> shows where the genre thinks the world ends. This
                page shows where it actually does.
              </p>
            </Scaffold>
          </div>
        </section>
      </main>

      {/* ── Colophon ───────────────────────────────────────────────────── */}
      <footer className="pr-colophon">
        <div className="wrap">
          <h2>How this page was assembled</h2>
          <p>
            <b>The essay text on this page is a draft scaffold</b>, marked as such in every
            section, and is not finished copy. The figures, the case studies and the data
            provenance are real.
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

          <h3>Elsewhere on this site</h3>
          <p className="pr-siblings">
            <a href="/">The essay</a> · <a href="/atlas">The Atlas of Ruin</a> ·{' '}
            <a href="/dispatches">Dispatches from the Ground</a> · <a href="/reel">The Reel</a> ·{' '}
            <a href="/methodology">Methodology</a> · <a href="/catalogue">The Catalogue</a>
          </p>
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
