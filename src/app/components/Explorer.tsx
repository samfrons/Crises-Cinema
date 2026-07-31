'use client';

import { useMemo, useState } from 'react';
import {
  family, decadeLabel, votes,
  type DecadeRow, type FamilyId, type Film,
} from '@/lib/taxonomy';
import { FilmCard, FilmSheet } from './FilmViews';

interface Props {
  decades: DecadeRow[];
  films: Film[] | null;
  active: Set<FamilyId>;
  selected: number;
  onSelect: (decade: number) => void;
  query: string;
  onQuery: (q: string) => void;
  total: number;
}

const PAGE = 24;

export default function Explorer({
  decades, films, active, selected, onSelect, query, onQuery, total,
}: Props) {
  const [open, setOpen] = useState<Film | null>(null);
  const [limit, setLimit] = useState(PAGE);

  const searching = query.trim().length > 0;
  const row = decades.find((d) => d.decade === selected) ?? decades[decades.length - 1];

  // A search looks across the whole century; otherwise we stay in the decade.
  const results = useMemo(() => {
    if (!films) return null;
    const q = query.trim().toLowerCase();
    return films
      .filter((f) => active.has(f.f))
      .filter((f) => (searching
        ? f.t.toLowerCase().includes(q) || f.s.toLowerCase().includes(q) || (f.d ?? '').toLowerCase().includes(q)
        : Math.floor(f.y / 10) * 10 === row.decade))
      .sort((a, b) => (searching ? b.v - a.v : a.y - b.y || a.t.localeCompare(b.t)));
  }, [films, active, query, searching, row.decade]);

  const visible = results?.slice(0, limit) ?? null;

  return (
    <>
      <div className="ex-controls">
        <div className="search">
          <label htmlFor="film-search" className="skip">Search films</label>
          <input
            id="film-search"
            type="search"
            placeholder={`Search ${total} films, subjects, directors…`}
            value={query}
            onChange={(e) => { onQuery(e.target.value); setLimit(PAGE); }}
          />
          {searching && (
            <button className="clear" onClick={() => onQuery('')} aria-label="Clear search">✕</button>
          )}
        </div>
        <p className="ex-count">
          {results === null
            ? 'loading the catalogue…'
            : searching
              ? `${results.length} match${results.length === 1 ? '' : 'es'} across all decades`
              : `${results.length} film${results.length === 1 ? '' : 's'} in the ${decadeLabel(row.decade)}`}
        </p>
      </div>

      <div className="decades" role="group" aria-label="Choose a decade">
        {decades.map((d) => (
          <button
            key={d.decade}
            aria-pressed={!searching && d.decade === row.decade}
            onClick={() => { onSelect(d.decade); onQuery(''); setLimit(PAGE); }}
          >
            {decadeLabel(d.decade)}
          </button>
        ))}
      </div>

      {!searching && <DecadeFacts row={row} />}

      {visible === null ? (
        <p className="loading">Loading the catalogue…</p>
      ) : visible.length === 0 ? (
        <p className="empty">
          Nothing here. {searching
            ? <>No film matches <b>{query}</b> in the categories you have showing.</>
            : <>Every category is filtered out of the {decadeLabel(row.decade)}.</>}
        </p>
      ) : (
        <>
          <div className="films">
            {visible.map((f) => (
              <FilmCard key={`${f.t}-${f.y}`} film={f} onOpen={setOpen} />
            ))}
          </div>
          {results && results.length > visible.length && (
            <button
              className="reset"
              style={{ marginTop: 22, fontSize: 12 }}
              onClick={() => setLimit((n) => n + PAGE * 2)}
            >
              Show {Math.min(PAGE * 2, results.length - visible.length)} more of {results.length}
            </button>
          )}
        </>
      )}

      {open && <FilmSheet film={open} onClose={() => setOpen(null)} />}
    </>
  );
}

function DecadeFacts({ row }: { row: DecadeRow }) {
  const dominant = row.dominant ? family(row.dominant) : null;
  const dominantN = row.dominant ? row.counts[row.dominant] ?? 0 : 0;

  return (
    <dl className="facts">
      <div className="fact">
        <dt>Films on record</dt>
        <dd>
          <span className="fact-big">{row.total}</span>
          {row.meanRating !== null && <span className="sub">averaging {row.meanRating}/10</span>}
        </dd>
      </div>
      <div className="fact">
        <dt>What it feared most</dt>
        <dd>
          {dominant ? (
            <>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <i style={{ width: 11, height: 11, borderRadius: 2, background: dominant.color, flex: 'none' }} />
                {dominant.label}
              </span>
              <span className="sub">
                {dominantN} of {row.total} · {Math.round((dominantN / row.total) * 100)}%
              </span>
            </>
          ) : '—'}
        </dd>
      </div>
      <div className="fact">
        <dt>Best reviewed</dt>
        <dd>
          {row.topRated ? (
            <>{row.topRated.t}<span className="sub">{row.topRated.r.toFixed(1)}/10 · {row.topRated.y}</span></>
          ) : '—'}
        </dd>
      </div>
      <div className="fact">
        <dt>Most watched</dt>
        <dd>
          {row.mostSeen ? (
            <>{row.mostSeen.t}<span className="sub">{votes(row.mostSeen.v)} · {row.mostSeen.y}</span></>
          ) : '—'}
        </dd>
      </div>
      {row.topGrossing && (
        <div className="fact">
          <dt>Top grossing</dt>
          <dd>{row.topGrossing.t}<span className="sub">{row.topGrossing.b} · {row.topGrossing.y}</span></dd>
        </div>
      )}
    </dl>
  );
}
