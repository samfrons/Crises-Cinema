'use client';

import { useEffect, useRef } from 'react';
import { country, family, money, orDash, posterUrl, tmdbUrl, votes, type Film } from '@/lib/taxonomy';

export function FilmCard({ film, onOpen }: { film: Film; onOpen: (f: Film) => void }) {
  const fam = family(film.f);
  return (
    <button className="film" onClick={() => onOpen(film)} aria-label={`${film.t}, ${film.y}. Open details.`}>
      {film.th ? (
        <img
          className="film-poster"
          src={posterUrl(film.th, 'w94_and_h141_bestv2')}
          alt=""
          width={52}
          height={78}
          loading="lazy"
        />
      ) : (
        <span className="film-poster none" aria-hidden="true">no<br />poster</span>
      )}
      <span className="film-body">
        <h3>{film.t}</h3>
        <span className="yr">{film.y}</span>
        <span className="tag">
          <i style={{ background: fam.color }} />
          <span>{film.s}</span>
        </span>
        {film.p && <p className="blurb">{film.p}</p>}
        <span className="meta">
          {film.r !== null ? <span className="rt">{film.r.toFixed(1)}/10</span> : <span>unrated</span>}
          {film.b ? <span>{money(film.b)}</span> : null}
        </span>
      </span>
    </button>
  );
}

export function FilmSheet({ film, onClose }: { film: Film; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const fam = family(film.f);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div className="sheet" role="presentation" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sheet-card" role="dialog" aria-modal="true" aria-label={`${film.t}, ${film.y}`}>
        <button ref={closeRef} className="sheet-x" onClick={onClose} aria-label="Close">✕</button>

        <div className="sheet-top">
          {film.th && (
            <img src={posterUrl(film.th, 'w185')} alt={`Poster for ${film.t}`} width={116} height={174} />
          )}
          <div>
            <h2>{film.t}</h2>
            <p style={{ margin: 0, fontFamily: 'var(--data)', fontSize: 12, color: 'var(--ink-soft)' }}>
              {film.y} · {fam.label}
            </p>
            <p style={{ margin: '10px 0 0', fontFamily: 'var(--data)', fontSize: 11.5, display: 'flex', alignItems: 'center', gap: 7 }}>
              <i style={{ width: 10, height: 10, borderRadius: 2, background: fam.color, display: 'inline-block' }} />
              {film.s}
            </p>
          </div>
        </div>

        {film.p && <p className="sheet-plot">{film.p}</p>}

        <dl>
          <div>
            <dt>Rating</dt>
            <dd>{film.r !== null ? `${film.r.toFixed(1)} / 10` : '—'}</dd>
          </div>
          <div>
            <dt>Audience</dt>
            <dd>{film.v > 0 ? votes(film.v) : '—'}</dd>
          </div>
          <div>
            <dt>Box office</dt>
            <dd>{film.b ? money(film.b) : 'not recorded'}</dd>
          </div>
          <div>
            <dt>Director</dt>
            <dd>{orDash(film.d)}</dd>
          </div>
          <div>
            <dt>Country</dt>
            <dd>{country(film.c)}</dd>
          </div>
        </dl>

        {film.id && (
          <a className="sheet-link" href={tmdbUrl(film.id)} target="_blank" rel="noreferrer">
            Look it up on TMDB ↗
          </a>
        )}
      </div>
    </div>
  );
}
