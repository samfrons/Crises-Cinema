import type { Metadata } from 'next';
import summaryData from '../../data/summary.json';
import type { Summary } from '@/lib/taxonomy';
import { DISASTER_TAXONOMY, THEMES, CLASSIFICATION_PASSES, THEME_CROSSMAP, PIPELINE } from './data';
import './methodology.css';

const summary = summaryData as unknown as Summary;

const title = 'Methodology — Disasters by the Decade';
const description =
  'How this project mapped the disaster-movie genre, and how that map narrowed down to ' +
  'the eleven families, plot-language tally, and decade breakdowns actually shipped in the data.';

export const metadata: Metadata = {
  title,
  description,
  openGraph: { title, description, type: 'article', siteName: 'Disasters by the Decade' },
  twitter: { card: 'summary_large_image', title, description },
};

export default function MethodologyPage() {
  return (
    <div className="md-page">
      <a className="skip" href="#motivation">Skip to the content</a>

      <header className="md-masthead">
        <div className="wrap">
          <p className="md-kicker">
            Behind the numbers · <a href="/">← Back to Disasters by the Decade</a>
          </p>
          <h1 className="md-mast-title">
            <span className="l1">Methodology</span>
          </h1>
          <p className="md-lede">
            Before there was a dataset, there was a bigger question: what is a disaster movie
            even <em>made of</em>? This page is the answer the project started with, kept next
            to an honest account of how much of it actually made it into the chart.
          </p>
        </div>
      </header>

      <main id="main">
        <section className="md-section" id="motivation">
          <div className="wrap">
            <p className="eyebrow">Why this exists</p>
            <h2 className="section-title">More than a leaderboard of catastrophes</h2>
            <p className="md-p">
              The project&apos;s founding note put it more ambitiously than a methodology page
              usually allows, so here it is close to verbatim:
            </p>
            <blockquote className="md-quote">
              This project aims to go beyond mere classification of disaster movies. We seek to
              distill meaningful lessons and insights from these films, bridging the gap between
              entertainment and education. By analyzing disaster narratives through the lenses of
              storytelling, science, and social impact, we will uncover valuable takeaways that
              can inform, inspire, and potentially save all of humankind.
            </blockquote>
            <p className="md-p">
              What follows is the honest gap between that ambition and {summary.total} rows of
              real data: two genre maps sketched out before a single film was logged, three
              rewritten attempts at getting a language model to classify against them, and the
              much narrower set of families, tallies, and decade breakdowns that actually made
              it into the chart.
            </p>
          </div>
        </section>

        <hr className="hr" />

        <section className="md-section" id="taxonomy">
          <div className="wrap">
            <p className="eyebrow">Map one</p>
            <h2 className="section-title">The full disaster taxonomy</h2>
            <p className="md-p">
              The genre&apos;s causes, mapped before a single film was logged — nine top-level
              branches, most split further into the specific hazard. The shipped site never
              tags a film against this full tree; instead, each branch below shows which of the
              eleven families in the live chart it was folded into, and why.
            </p>

            <div className="md-tree">
              {DISASTER_TAXONOMY.map((branch) => (
                <article className="md-branch" key={branch.label}>
                  <h3>{branch.label}</h3>

                  {branch.sub ? (
                    <div className="md-sub-grid">
                      {branch.sub.map((s) => (
                        <div className="md-sub" key={s.label}>
                          <h4>{s.label}</h4>
                          <ul>
                            {s.items.map((it) => <li key={it}>{it}</li>)}
                          </ul>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <ul className="md-flat">
                      {branch.items?.map((it) => <li key={it}>{it}</li>)}
                    </ul>
                  )}

                  <p className="md-shipped">
                    <span>In the shipped chart</span> {branch.shipped}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <hr className="hr" />

        <section className="md-section" id="classification">
          <div className="wrap">
            <p className="eyebrow">Turning a map into labels</p>
            <h2 className="section-title">Three passes at the same films</h2>
            <p className="md-p">
              The raw DisasterType, MainCategory, and Subcategory fields didn&apos;t come from a
              single pass — they came from feeding film lists to a GPT model against a
              classification prompt, rewritten at least three times as the project&apos;s
              thinking changed. None of the three schemes below is what ships today; a given raw
              record reflects whichever pass happened to classify it, which is exactly the
              inconsistency <a href="#data">the eleven-family reconciliation</a> exists to
              untangle.
            </p>

            <div className="md-passes">
              {CLASSIFICATION_PASSES.map((p) => (
                <article className="md-pass" key={p.name}>
                  <h3>{p.name}</h3>
                  <p className="md-pass-cats">{p.categories.join(' · ')}</p>
                  {p.addedFields.length > 0 && (
                    <ul className="md-flat md-pass-fields">
                      {p.addedFields.map((f) => <li key={f}>{f}</li>)}
                    </ul>
                  )}
                  <p className="md-status">{p.note}</p>
                </article>
              ))}
            </div>

            <p className="md-p" style={{ marginTop: 8 }}>
              The relationship from planning document to live bar chart, in five steps:
            </p>
            <div className="md-pipeline">
              {PIPELINE.map((stage, i) => (
                <div className="md-pipe-item" key={stage.label}>
                  <div className="md-pipe-stage">
                    <h4>Stage {i + 1}</h4>
                    <p className="md-pipe-label">{stage.label}</p>
                    <p className="md-pipe-detail">{stage.detail}</p>
                  </div>
                  {i < PIPELINE.length - 1 && <div className="md-pipe-arrow">↓</div>}
                </div>
              ))}
            </div>
          </div>
        </section>

        <hr className="hr" />

        <section className="md-section" id="themes">
          <div className="wrap">
            <p className="eyebrow">Map two</p>
            <h2 className="section-title">Themes and elements</h2>
            <p className="md-p">
              The second map isn&apos;t about what destroys the world — it&apos;s about what the
              film is actually doing with that destruction: its tone, its themes, the shape of
              its plot, who it follows and what they learn. Most of this framework stayed
              conceptual; TMDB doesn&apos;t carry fields for tone or character arc, and this
              project didn&apos;t hand-tag {summary.total} films against them. Each branch says
              plainly whether — and how — it made it into the data.
            </p>

            <div className="md-theme-list">
              {THEMES.map((t) => (
                <article className="md-theme" key={t.label}>
                  <h3>{t.label}</h3>

                  {t.group ? (
                    <div className="md-sub-grid">
                      {t.group.map((g) => (
                        <div className="md-sub" key={g.label}>
                          <h4>{g.label}</h4>
                          <ul>
                            {g.items.map((it) => <li key={it}>{it}</li>)}
                          </ul>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <ul className="md-flat">
                      {t.items?.map((it) => <li key={it}>{it}</li>)}
                    </ul>
                  )}

                  <p className="md-status">{t.status}</p>
                </article>
              ))}
            </div>

            <p className="md-p" style={{ marginTop: 40 }}>
              A later, separate pass tried a different cut on the same question: instead of
              elements within a story, ten themes cross-mapped directly against the disaster
              categories most likely to carry them.
            </p>
            <div className="md-cross-grid">
              {THEME_CROSSMAP.map((c) => (
                <article className="md-cross" key={c.label}>
                  <h4>{c.label}</h4>
                  <p className="md-cross-related">{c.related}</p>
                  <ul className="md-flat">
                    {c.items.map((it) => <li key={it}>{it}</li>)}
                  </ul>
                </article>
              ))}
            </div>
            <p className="md-status" style={{ marginTop: 18 }}>
              Also conceptual — no film in the dataset is tagged against these ten themes. Kept
              here because it&apos;s a genuinely different lens than the map above: themes tied
              to cause, rather than themes tied to story structure.
            </p>
          </div>
        </section>

        <hr className="hr" />

        <section className="md-section" id="data">
          <div className="wrap">
            <p className="eyebrow">What actually shipped</p>
            <h2 className="section-title">From raw fields to eleven families</h2>
            <p className="md-p">
              The real source data — not the planning maps above — labelled these films with
              105 different free-text disaster types, 49 main categories and 191 subcategories,
              much of it inconsistent and some of it mangled by a bad comma-split. Those got
              consolidated into the eleven families in the live chart, under a three-tier
              matching pass: unambiguous named hazards first (Titanic&apos;s DisasterType reads
              &quot;Natural Disaster,&quot; but only the iceberg fragment tells you what
              actually happens), then specific hand-written signals, then generic category
              labels only when nothing more concrete was on record.
            </p>
            <p className="md-p">
              Judgement calls were made throughout, and the rule was consistent: a film with a
              stated cause is filed under that cause rather than its setting, so <i>Mad Max:
              Fury Road</i> counts as Atomic and not as a post-apocalyptic film. Where the
              source contradicted itself, the more specific signal won. The full matching logic
              — every regex, in order, with the reasoning for why it&apos;s ordered that way —
              is public:{' '}
              <a
                href="https://github.com/samfrons/data-viz/blob/crisescinema/scripts/taxonomy.mjs"
                target="_blank"
                rel="noreferrer"
              >
                scripts/taxonomy.mjs on GitHub ↗
              </a>
              .
            </p>
            <p className="md-p">
              The plot-language breakdown on the main page runs the same honesty standard: it
              counts words in each film&apos;s own TMDB plot summary, not a hand-assigned
              verdict on how the story ends. Ratings, posters, and plot summaries come from
              TMDB; where the dataset carries box office, it&apos;s recorded for{' '}
              {summary.withBoxOffice} of {summary.total} films — the rest went unrecorded at
              the source.
            </p>
          </div>
        </section>

        <hr className="hr" />

        <section className="md-section" id="whatif">
          <div className="wrap">
            <p className="eyebrow">The bigger ambition</p>
            <h2 className="section-title">The &quot;what if&quot; framework</h2>
            <p className="md-p">
              The classification work was always meant to serve a larger idea: reimagine how a
              film&apos;s fictional catastrophe could have been prevented or mitigated, then
              translate that fictional fix into an actual strategy — technological innovation,
              social cooperation, environmental stewardship, psychological resilience — worth
              taking seriously off screen. The premise was to use the familiar territory of film
              to make daunting real-world risks more approachable, for policymakers and
              storytellers alike.
            </p>
            <p className="md-status">
              This is the part of the project that never left the page. Nothing here is computed
              or scored per film; no alternate ending has been drafted, let alone translated into
              a real-world strategy. It&apos;s the reason the site&apos;s own analysis leans
              toward what these {summary.total} films reveal in aggregate — the plot-language
              tally, the shift in which countries make them, which decades got the darkest —
              rather than any single film&apos;s plot taken in isolation.
            </p>

            <a className="md-back" href="/">← Back to the decades</a>
          </div>
        </section>
      </main>
    </div>
  );
}
