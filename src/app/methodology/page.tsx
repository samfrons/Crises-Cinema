import type { Metadata } from 'next';
import summaryData from '../../data/summary.json';
import type { Summary } from '@/lib/taxonomy';
import { DISASTER_TAXONOMY, THEMES } from './data';
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
      <a className="skip" href="#taxonomy">Skip to the taxonomy</a>

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
            even <em>made of</em>? This page keeps the answer the project started with — two
            planning maps, one for what goes wrong on screen and one for what the story is
            about once it has — next to an honest account of which parts of that thinking
            actually made it into {summary.total} rows of real data, and which stayed
            conceptual.
          </p>
        </div>
      </header>

      <main id="main">
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

            <a className="md-back" href="/">← Back to the decades</a>
          </div>
        </section>
      </main>
    </div>
  );
}
