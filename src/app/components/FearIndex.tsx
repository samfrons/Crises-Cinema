'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { FAMILY_IDS, type FamilyId, type Film, type Summary } from '@/lib/taxonomy';
import DecadeChart, { type Mode } from './DecadeChart';
import CategoryRail from './CategoryRail';
import StoryNotes from './StoryNotes';
import Explorer from './Explorer';

/**
 * Owns the three pieces of state the whole essay shares: which categories are
 * showing, which decade is open, and the search query. The chart draws from
 * build-time aggregates so it renders with the document; the film list arrives
 * afterwards and only the explorer waits on it.
 */
export default function FearIndex({ summary }: { summary: Summary }) {
  const [mode, setMode] = useState<Mode>('count');
  const [active, setActive] = useState<Set<FamilyId>>(() => new Set(FAMILY_IDS));
  const [decade, setDecade] = useState(1970);
  const [query, setQuery] = useState('');
  const [films, setFilms] = useState<Film[] | null>(null);
  const explorerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    let live = true;
    fetch('/data/films.json')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`films.json ${r.status}`))))
      .then((d: Film[]) => { if (live) setFilms(d); })
      .catch((err) => console.error('Could not load the film catalogue:', err));
    return () => { live = false; };
  }, []);

  const toggle = useCallback((id: FamilyId) => {
    setActive((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      // Never leave every category off — that just empties the page.
      return next.size ? next : new Set([id]);
    });
  }, []);

  const goToDecade = useCallback((d: number) => {
    setDecade(d);
    setQuery('');
    explorerRef.current?.scrollIntoView({
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      block: 'start',
    });
  }, []);

  return (
    <>
      <section id="reel">
        <div className="wrap">
          <div className="chart-head">
            <div>
              <p className="eyebrow">The reel · {summary.firstYear}–{summary.lastYear}</p>
              <h2 className="section-title">One frame per decade</h2>
              <p className="lede" style={{ marginBottom: 0 }}>
                Every film in the set, stacked by what it was afraid of. Switch to shares to
                see the mix rather than the volume — the early frames hold so few films that
                counts alone hide them.
              </p>
            </div>
            <div className="toggle" role="group" aria-label="Chart measure">
              <button aria-pressed={mode === 'count'} onClick={() => setMode('count')}>How many</button>
              <button aria-pressed={mode === 'share'} onClick={() => setMode('share')}>What share</button>
            </div>
          </div>

          <DecadeChart
            decades={summary.decades}
            active={active}
            mode={mode}
            selected={decade}
            onSelect={goToDecade}
            films={films}
          />

          <CategoryRail
            active={active}
            byFamily={summary.byFamily}
            decades={summary.decades}
            onToggle={toggle}
            onReset={() => setActive(new Set(FAMILY_IDS))}
          />
        </div>
      </section>

      <hr className="hr" />

      <section id="notes">
        <div className="wrap">
          <p className="eyebrow">Notes in the margin</p>
          <h2 className="section-title">Five things the data says out loud</h2>
          <p className="lede">
            Pick one to open that decade below.
          </p>
          <StoryNotes onPick={goToDecade} />
        </div>
      </section>

      <hr className="hr" />

      <section id="explorer" ref={explorerRef}>
        <div className="wrap">
          <p className="eyebrow">The catalogue</p>
          <h2 className="section-title">Go decade by decade</h2>
          <p className="lede">
            {summary.total} films, {summary.withRating} of them rated. Ratings and posters come
            from TMDB; box office is only recorded for {summary.withBoxOffice}.
          </p>
          <Explorer
            decades={summary.decades}
            films={films}
            active={active}
            selected={decade}
            onSelect={setDecade}
            query={query}
            onQuery={setQuery}
          />
        </div>
      </section>
    </>
  );
}
