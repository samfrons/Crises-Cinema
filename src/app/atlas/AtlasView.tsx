'use client';

/*
 * The two plates of the atlas.
 *
 *   Plate 1 — the territories: a dotted equirectangular world (the dots are
 *   pre-rasterised at build time into a single stroked path), with one pin
 *   per named place, area-scaled by film count. Ink is the data colour;
 *   ember is reserved for the hover/selected state, per the site rule.
 *
 *   Plate 2 — off the map: the films that leave Earth, on a chart of dashed
 *   orbits swung around an Earth tucked into the corner, drawn white-on-ink
 *   like the plate got flipped to its negative.
 *
 * Selecting a pin on either plate opens its dossier — the film list —
 * directly beneath that plate. One selection at a time across both.
 */

import { useMemo, useState } from 'react';
import { family, posterUrl, tmdbUrl } from '@/lib/taxonomy';

export interface AtlasFilm {
  t: string;
  y: number;
  f: string;
  r: number | null;
  th: string | null;
  id: string | null;
}

export interface AtlasPlace {
  id: string;
  label: string;
  lat: number;
  lon: number;
  films: AtlasFilm[];
}

export interface AtlasRealm {
  id: string;
  label: string;
  blurb: string;
  dist: number;
  films: AtlasFilm[];
}

export interface Atlas {
  generated: string;
  total: number;
  located: number;
  pinnedFilms: number;
  spaceTotal: number;
  places: AtlasPlace[];
  realms: AtlasRealm[];
  land: { cols: number; rows: number; lon0: number; lat0: number; step: number; cells: number[] };
}

type Selection = { kind: 'place' | 'realm'; id: string } | null;

/* ── Plate 1 geometry ─────────────────────────────────────────────────── */

const MAP_W = 1000;

function useMapGeometry(land: Atlas['land']) {
  return useMemo(() => {
    const cell = MAP_W / land.cols;
    const h = cell * land.rows;
    // All land dots as one path of zero-length segments with round caps —
    // thousands of <circle>s collapsed into a single element.
    let d = '';
    for (const idx of land.cells) {
      const x = ((idx % land.cols) + 0.5) * cell;
      const y = (Math.floor(idx / land.cols) + 0.5) * cell;
      d += `M${x.toFixed(1)} ${y.toFixed(1)}h0`;
    }
    const project = (lat: number, lon: number) => ({
      x: ((lon - land.lon0) / (land.step * land.cols)) * MAP_W,
      y: ((land.lat0 - lat) / (land.step * land.rows)) * h,
    });
    return { h, cell, d, project };
  }, [land]);
}

/** Pin area grows with the film count; radius is the square root. */
const pinR = (n: number) => 3.4 + Math.sqrt(n) * 2.1;

/* ── Tooltip ──────────────────────────────────────────────────────────── */

interface Tip {
  x: number; // 0..1 of plate width
  y: number; // 0..1 of plate height
  label: string;
  films: AtlasFilm[];
}

function PlateTip({ tip }: { tip: Tip }) {
  const flipX = tip.x > 0.62;
  const flipY = tip.y > 0.6;
  return (
    <div
      className="tip at-tip"
      style={{
        left: `${tip.x * 100}%`,
        top: `${tip.y * 100}%`,
        transform: `translate(${flipX ? 'calc(-100% - 14px)' : '14px'}, ${flipY ? 'calc(-100% - 10px)' : '12px'})`,
      }}
    >
      <div className="tip-h">{tip.label}</div>
      <div className="tip-n">{tip.films.length} film{tip.films.length === 1 ? '' : 's'}</div>
      <ul>
        {tip.films.slice(0, 5).map((f) => (
          <li key={`${f.t}${f.y}`}>{f.y} · {f.t}</li>
        ))}
        {tip.films.length > 5 && <li>… and {tip.films.length - 5} more</li>}
      </ul>
    </div>
  );
}

/* ── The dossier: the films behind a selected pin ─────────────────────── */

function Dossier({
  eyebrow, label, films, dark, onClose,
}: {
  eyebrow: string;
  label: string;
  films: AtlasFilm[];
  dark?: boolean;
  onClose: () => void;
}) {
  return (
    <div className={`at-dossier${dark ? ' dark' : ''}`}>
      <div className="at-dossier-head">
        <p className="at-dossier-eyebrow">{eyebrow}</p>
        <h3>
          {label}
          <span className="ct">{films.length} film{films.length === 1 ? '' : 's'}</span>
        </h3>
        <button type="button" className="at-dossier-x" onClick={onClose} aria-label="Close film list">
          ×
        </button>
      </div>
      <ul className="at-films">
        {films.map((f) => {
          const fam = family(f.f);
          const inner = (
            <>
              {f.th
                ? <img src={posterUrl(f.th, 'w92')} alt="" loading="lazy" />
                : <span className="at-noposter" aria-hidden>NO STILL</span>}
              <span className="at-film-body">
                <b>{f.t}</b>
                <span className="at-film-meta">
                  <i style={{ background: fam.color }} />
                  {f.y} · {fam.label}{f.r ? ` · ★ ${f.r.toFixed(1)}` : ''}
                </span>
              </span>
            </>
          );
          return (
            <li key={`${f.t}${f.y}`}>
              {f.id
                ? <a href={tmdbUrl(f.id)} target="_blank" rel="noreferrer">{inner}</a>
                : <span className="at-film-still">{inner}</span>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ── Plate 1: the territories ─────────────────────────────────────────── */

function WorldPlate({
  atlas, selection, onSelect,
}: {
  atlas: Atlas;
  selection: Selection;
  onSelect: (s: Selection) => void;
}) {
  const { h, d, project } = useMapGeometry(atlas.land);
  const [tip, setTip] = useState<Tip | null>(null);

  const pins = useMemo(
    () => atlas.places.map((p) => ({ ...p, ...project(p.lat, p.lon), r: pinR(p.films.length) })),
    [atlas.places, project],
  );

  // Label the biggest pins that fit: walk in count order, try above the pin
  // then below it, keep the first spot that hits neither the plate edge nor
  // a label already placed. Width is estimated from the character count.
  const labels = useMemo(() => {
    type Label = { id: string; x: number; y: number; anchor: string; text: string };
    const kept: (Label & { w: number })[] = [];
    for (const p of pins) {
      if (kept.length >= 13) break;
      const text = p.label.toUpperCase();
      const w = text.length * 6.6;
      for (const y of [p.y - p.r - 6, p.y + p.r + 14]) {
        if (y < 12 || y > h - 4) continue;
        let x = p.x;
        let anchor = 'middle';
        if (x - w / 2 < 6) { anchor = 'start'; x = Math.max(6, p.x - p.r); }
        else if (x + w / 2 > MAP_W - 6) { anchor = 'end'; x = Math.min(MAP_W - 6, p.x + p.r); }
        const x0 = anchor === 'start' ? x : anchor === 'end' ? x - w : x - w / 2;
        const clear = kept.every((q) => {
          const q0 = q.anchor === 'start' ? q.x : q.anchor === 'end' ? q.x - q.w : q.x - q.w / 2;
          return x0 + w + 8 < q0 || q0 + q.w + 8 < x0 || Math.abs(q.y - y) > 15;
        });
        if (clear) { kept.push({ id: p.id, x, y, anchor, text, w }); break; }
      }
    }
    return kept;
  }, [pins, h]);

  const selected = selection?.kind === 'place'
    ? atlas.places.find((p) => p.id === selection.id) ?? null
    : null;

  return (
    <section className="at-plate-section" id="territories">
      <div className="wrap">
        <div className="at-plate-head">
          <p className="eyebrow">Plate No. 1 · The territories</p>
          <h2 className="section-title">Every named ground zero</h2>
          <p className="at-plate-note">
            One pin per place; the pin grows with the body count of films. Touch a pin for
            the films, press it for the full dossier.
          </p>
        </div>

        <figure className="at-plate">
          <div className="at-map-wrap">
            <div className="at-scroll">
            <div className="at-inner">
            <svg
              viewBox={`0 0 ${MAP_W} ${h}`}
              role="img"
              aria-label={`World map of film settings: ${atlas.places.length} places, from ${atlas.places[0].label} (${atlas.places[0].films.length} films) down.`}
            >
              {/* land */}
              <path className="at-land" d={d} />

              {/* pins, smallest drawn last so little ones stay clickable */}
              {[...pins].reverse().map((p) => {
                const isSel = selection?.kind === 'place' && selection.id === p.id;
                return (
                  <g
                    key={p.id}
                    className={`at-pin${isSel ? ' sel' : ''}`}
                    tabIndex={0}
                    role="button"
                    aria-label={`${p.label}, ${p.films.length} film${p.films.length === 1 ? '' : 's'}`}
                    aria-pressed={isSel}
                    onMouseEnter={() => setTip({ x: p.x / MAP_W, y: p.y / h, label: p.label, films: p.films })}
                    onMouseLeave={() => setTip(null)}
                    onFocus={() => setTip({ x: p.x / MAP_W, y: p.y / h, label: p.label, films: p.films })}
                    onBlur={() => setTip(null)}
                    onClick={() => onSelect(isSel ? null : { kind: 'place', id: p.id })}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onSelect(isSel ? null : { kind: 'place', id: p.id });
                      }
                    }}
                  >
                    <circle className="at-pin-hit" cx={p.x} cy={p.y} r={Math.max(p.r + 6, 12)} />
                    <circle className="at-pin-dot" cx={p.x} cy={p.y} r={p.r} />
                    {isSel && <circle className="at-pin-halo" cx={p.x} cy={p.y} r={p.r + 5.5} />}
                  </g>
                );
              })}

              {/* labels over everything */}
              {labels.map((l) => (
                <text key={l.id} className="at-pin-label" x={l.x} y={l.y} textAnchor={l.anchor}>
                  {l.text}
                </text>
              ))}
            </svg>
            {tip && <PlateTip tip={tip} />}
            </div>
            </div>
            <p className="at-scroll-hint" aria-hidden>Scroll sideways for the full plate →</p>
          </div>

          <figcaption className="at-plate-foot">
            <span className="at-scale" aria-hidden>
              <svg viewBox="0 0 74 22" width="74" height="22">
                <circle cx="8" cy="13" r={pinR(1)} className="at-pin-dot" />
                <circle cx="30" cy="13" r={pinR(8)} className="at-pin-dot" />
                <circle cx="60" cy="13" r={pinR(24)} className="at-pin-dot" />
              </svg>
              1 / 8 / 24 films
            </span>
            <span>Settings as named by each film&apos;s synopsis</span>
            <span className="at-plate-no" aria-hidden>ATLAS OF RUIN — PL. 1</span>
          </figcaption>
        </figure>

        {selected && (
          <Dossier
            eyebrow="Pinned at"
            label={selected.label}
            films={selected.films}
            onClose={() => onSelect(null)}
          />
        )}

        <details className="table-toggle at-table">
          <summary>Every territory, as a table</summary>
          <div className="table-scroll">
            <table className="counts">
              <thead>
                <tr><th>Place</th><th>Films</th><th>First</th><th>Latest</th></tr>
              </thead>
              <tbody>
                {atlas.places.map((p) => (
                  <tr key={p.id}>
                    <td>{p.label}</td>
                    <td>{p.films.length}</td>
                    <td>{p.films[0].y}</td>
                    <td>{p.films[p.films.length - 1].y}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </div>
    </section>
  );
}

/* ── Plate 2: off the map ─────────────────────────────────────────────── */

const SPACE_W = 1000;
const SPACE_H = 540;
const EARTH = { x: 84, y: 640, r: 148 };

// One hand-placed angle per realm keeps every node inside the plate and the
// labels out of each other's way. Degrees above the horizon, from Earth.
const REALM_ANGLE: Record<string, number> = {
  orbit: 64, moon: 45, inner: 66, mars: 41, rocks: 26, deep: 33.5,
};

const realmNode = (r: AtlasRealm) => {
  const radius = 150 + r.dist * 126;
  const a = ((REALM_ANGLE[r.id] ?? 45) * Math.PI) / 180;
  return {
    radius,
    x: EARTH.x + radius * Math.cos(a),
    y: EARTH.y - radius * Math.sin(a),
    r: 9 + Math.sqrt(r.films.length) * 4.6,
  };
};

// A fixed constellation — deterministic, so the server and client agree.
const STARS = Array.from({ length: 90 }, (_, i) => ({
  x: (i * 197.33 + 61) % SPACE_W,
  y: (i * 119.51 + 23) % SPACE_H,
  r: 0.7 + ((i * 7) % 10) / 9,
  dim: i % 3 === 0,
}));

function SpacePlate({
  atlas, selection, onSelect,
}: {
  atlas: Atlas;
  selection: Selection;
  onSelect: (s: Selection) => void;
}) {
  const [tip, setTip] = useState<Tip | null>(null);
  const selected = selection?.kind === 'realm'
    ? atlas.realms.find((r) => r.id === selection.id) ?? null
    : null;

  return (
    <section className="at-space-section" id="offworld" aria-labelledby="offworld-title">
      <div className="wrap">
        <div className="at-plate-head">
          <p className="eyebrow">Plate No. 2 · Off the map</p>
          <h2 className="section-title" id="offworld-title">{atlas.spaceTotal} films leave Earth altogether</h2>
          <p className="at-plate-note">
            No projection can hold them, so they get orbits instead: each ring is a realm,
            drawn at its distance from home. The farther out the story, the fewer dare go.
          </p>
        </div>

        <figure className="at-plate dark">
          <div className="at-map-wrap">
            <div className="at-scroll">
            <div className="at-inner">
            <svg
              viewBox={`0 0 ${SPACE_W} ${SPACE_H}`}
              role="img"
              aria-label={`Chart of space-set films by realm: ${atlas.realms
                .map((r) => `${r.label} ${r.films.length}`)
                .join(', ')}.`}
            >
              {STARS.map((s, i) => (
                <circle key={i} className={`at-star${s.dim ? ' dim' : ''}`} cx={s.x} cy={s.y} r={s.r} />
              ))}

              {/* home */}
              <circle className="at-earth" cx={EARTH.x} cy={EARTH.y} r={EARTH.r} />
              <text className="at-earth-label" x={EARTH.x + 8} y={EARTH.y - EARTH.r - 14}>
                EARTH · {atlas.located - atlas.spaceTotal}+ FILMS BELOW
              </text>

              {atlas.realms.map((realm) => {
                const n = realmNode(realm);
                const isSel = selection?.kind === 'realm' && selection.id === realm.id;
                const labelUp = n.y < 200;
                return (
                  <g key={realm.id}>
                    <circle className="at-orbit" cx={EARTH.x} cy={EARTH.y} r={n.radius} />
                    <g
                      className={`at-node${isSel ? ' sel' : ''}`}
                      tabIndex={0}
                      role="button"
                      aria-label={`${realm.label}, ${realm.films.length} film${realm.films.length === 1 ? '' : 's'}`}
                      aria-pressed={isSel}
                      onMouseEnter={() => setTip({ x: n.x / SPACE_W, y: n.y / SPACE_H, label: realm.label, films: realm.films })}
                      onMouseLeave={() => setTip(null)}
                      onFocus={() => setTip({ x: n.x / SPACE_W, y: n.y / SPACE_H, label: realm.label, films: realm.films })}
                      onBlur={() => setTip(null)}
                      onClick={() => onSelect(isSel ? null : { kind: 'realm', id: realm.id })}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          onSelect(isSel ? null : { kind: 'realm', id: realm.id });
                        }
                      }}
                    >
                      <circle className="at-node-hit" cx={n.x} cy={n.y} r={n.r + 14} />
                      {isSel && <circle className="at-node-halo" cx={n.x} cy={n.y} r={n.r + 7} />}
                      <circle className="at-node-dot" cx={n.x} cy={n.y} r={n.r} />
                      <text className="at-node-count" x={n.x} y={n.y + 4.5} textAnchor="middle">
                        {realm.films.length}
                      </text>
                    </g>
                    <text
                      className="at-node-label"
                      x={n.x}
                      y={labelUp ? n.y + n.r + 24 : n.y - n.r - 14}
                      textAnchor="middle"
                    >
                      {realm.label.toUpperCase()}
                    </text>
                    <text
                      className="at-node-blurb"
                      x={n.x}
                      y={labelUp ? n.y + n.r + 42 : n.y - n.r - 32}
                      textAnchor="middle"
                    >
                      {realm.blurb}
                    </text>
                  </g>
                );
              })}
            </svg>
            {tip && <PlateTip tip={tip} />}
            </div>
            </div>
            <p className="at-scroll-hint" aria-hidden>Scroll sideways for the full plate →</p>
          </div>

          <figcaption className="at-plate-foot dark">
            <span>Realms in order of distance; the count is films set there</span>
            <span className="at-plate-no" aria-hidden>ATLAS OF RUIN — PL. 2</span>
          </figcaption>
        </figure>

        {selected && (
          <Dossier
            eyebrow="Last known position"
            label={selected.label}
            films={selected.films}
            dark
            onClose={() => onSelect(null)}
          />
        )}
      </div>
    </section>
  );
}

/* ── The view ─────────────────────────────────────────────────────────── */

export default function AtlasView({ atlas }: { atlas: Atlas }) {
  const [selection, setSelection] = useState<Selection>(null);
  return (
    <main id="main">
      <WorldPlate atlas={atlas} selection={selection} onSelect={setSelection} />
      <SpacePlate atlas={atlas} selection={selection} onSelect={setSelection} />
    </main>
  );
}
