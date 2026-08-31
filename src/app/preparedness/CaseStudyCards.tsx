'use client';

/*
 * The fourteen case studies as cards, each ending in the films the catalogue
 * already holds on the same subject.
 *
 * The cross-link is deliberately crude and says so: a case study declares
 * which of the eleven film families it belongs to and, optionally, a title
 * pattern worth surfacing first. Films matching the pattern lead; the rest of
 * the family fills in by rating. There is no claim that any of these films is
 * *about* the event — only that Hollywood filed the same hazard under the same
 * heading, which is the comparison this whole page is making.
 */

import { useEffect, useMemo, useState } from 'react';
import { family, type Film } from '@/lib/taxonomy';
import { CASE_STUDIES, type CaseStudy } from './caseStudies';

const decadeSlug = (y: number) => `${Math.floor(y / 10) * 10}s`;

function relatedFilms(cs: CaseStudy, films: Film[]): Film[] {
  const pool = films.filter(
    (f) => cs.families.includes(f.f) && typeof f.r === 'number' && (f.v ?? 0) >= 40,
  );
  const byRating = (a: Film, b: Film) => (b.r ?? 0) - (a.r ?? 0);
  const named = cs.titleMatch
    ? pool.filter((f) => cs.titleMatch!.test(f.t)).sort(byRating)
    : [];
  const rest = pool.filter((f) => !named.includes(f)).sort(byRating);
  return [...named, ...rest].slice(0, 3);
}

function Card({ cs, films }: { cs: CaseStudy; films: Film[] | null }) {
  const related = useMemo(() => (films ? relatedFilms(cs, films) : []), [cs, films]);

  return (
    <article className="pr-case" id={`case-${cs.id}`}>
      <header className="pr-case-head">
        <p className="pr-case-year">
          {cs.year}
          {cs.global && <span className="pr-badge">global</span>}
        </p>
        <h3 className="pr-case-title">{cs.title}</h3>
        <p className="pr-case-place">{cs.place}</p>
        <p className="pr-case-toll">{cs.toll}</p>
      </header>

      <div className="pr-case-body">
        <div className="pr-case-block">
          <h4>What happened</h4>
          <p>{cs.happened}</p>
        </div>
        <div className="pr-case-block">
          <h4>What worked</h4>
          <p>{cs.worked}</p>
        </div>
        <div className="pr-case-block">
          <h4>What failed</h4>
          <p>{cs.failed}</p>
        </div>
        <div className="pr-case-block pr-case-verdict">
          <h4>What the inquiry concluded</h4>
          <p>{cs.inquiry}</p>
        </div>
      </div>

      <details className="pr-case-sources">
        <summary>Sources ({cs.sources.length})</summary>
        <ul>
          {cs.sources.map((s) => <li key={s}>{s}</li>)}
        </ul>
      </details>

      {related.length > 0 && (
        <div className="pr-case-films">
          <h4>Filed under the same heading in the catalogue</h4>
          <ul>
            {related.map((f) => {
              const fam = family(f.f);
              return (
                <li key={`${f.t}-${f.y}`}>
                  <a href={`/catalogue/${decadeSlug(f.y)}`}>
                    <i style={{ background: fam.color }} aria-hidden />
                    <span className="pr-film-t">{f.t}</span>
                    <span className="pr-film-y">
                      {f.y}
                      {typeof f.r === 'number' ? ` · ★ ${f.r.toFixed(1)}` : ''}
                    </span>
                  </a>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </article>
  );
}

export default function CaseStudyCards() {
  const [films, setFilms] = useState<Film[] | null>(null);

  useEffect(() => {
    let liveRef = true;
    fetch('/data/films.json')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`films.json ${r.status}`))))
      .then((d: Film[]) => { if (liveRef) setFilms(d); })
      .catch(() => { /* the cross-links are a garnish; the cards stand alone */ });
    return () => { liveRef = false; };
  }, []);

  return (
    <div className="pr-cases" id="cases">
      <p className="eyebrow">Fourteen events, and what the record says</p>
      <h3 className="pr-cases-title">The inquiries, in their own words</h3>
      <p className="pr-note">
        Each card names the commission, committee or evaluation that examined the event, because
        the verdicts are the argument. Where there is no independent inquiry — Myanmar — that is
        recorded as the finding. Casualty figures are the naming institution&rsquo;s; several are
        contested, and the cards say which.
      </p>
      <div className="pr-case-grid">
        {CASE_STUDIES.map((cs) => <Card key={cs.id} cs={cs} films={films} />)}
      </div>
    </div>
  );
}
