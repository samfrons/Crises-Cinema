'use client';

/*
 * Figure 1 — the world, coloured by whichever measure of preparedness you ask
 * it for.
 *
 * Six layers, four of them offered up front and two specialist ones on a
 * second row. The rules the figure holds itself to:
 *
 *   · Dark always means worse. Two of the six indices score upward for good
 *     news, so their values are flipped before they hit the ramp and the
 *     legend says, in words, that it has been flipped.
 *   · A country with no value gets hatching, never the pale end of the ramp.
 *     "Low" and "unmeasured" are different claims.
 *   · A layer the pipeline could not obtain renders as bare outline with the
 *     reason printed inside the frame. Nothing is interpolated, modelled or
 *     borrowed from a neighbouring year.
 *   · The hazard chips go dead — visibly, with an explanation on hover — on
 *     any index that is not hazard-disaggregated. A composite risk score
 *     cannot be sliced into floods and wildfires after the fact.
 *
 * Keyboard: the map is one tab stop rather than 173. Arrow keys walk the
 * countries (left/right alphabetically, up/down to the nearest neighbour in
 * that direction), Enter opens the dossier, Escape closes it, and the whole
 * table is underneath in any case.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  RAMP_STEPS, isLoaded, normalise, project, rampColor, sourceLine, useLayers, useWorld,
} from './data';
import { HAZARDS, LAYER_CHOICES, LAYER_IDS, type HazardKey, type Layer, type LayerId } from './types';
import { CASE_STUDIES } from './caseStudies';

const MAP_W = 1000;
const MAP_H = 500;

type HazardFilter = 'all' | HazardKey;

/** The value a country gets on this layer, under this hazard filter. */
function valueFor(layer: Layer, iso3: string, hazard: HazardFilter): number | null {
  const c = layer.countries?.[iso3];
  if (!c) return null;
  if (hazard === 'all') return typeof c.score === 'number' ? c.score : null;
  const v = c.byHazard?.[hazard];
  return typeof v === 'number' ? v : null;
}

export default function PreparednessMap() {
  const { data: world, state: worldState } = useWorld();
  const { layers, state: layerState } = useLayers(LAYER_IDS);

  const [layerId, setLayerId] = useState<LayerId>('inform');
  const [hazard, setHazard] = useState<HazardFilter>('all');
  const [selected, setSelected] = useState<string | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [showPins, setShowPins] = useState(true);
  const [openCase, setOpenCase] = useState<string | null>(null);
  const [announce, setAnnounce] = useState('');

  const layer = layers[layerId] ?? null;
  const live = isLoaded(layer);
  const choice = LAYER_CHOICES.find((l) => l.id === layerId)!;

  // A hazard filter only survives a move to a layer that can honour it.
  useEffect(() => {
    if (hazard === 'all') return;
    if (!layer?.hazardDimension || !layer.hazards?.includes(hazard)) setHazard('all');
  }, [layer, hazard]);

  const countries = useMemo(
    () => (world?.countries ?? []).slice().sort((a, b) => a.name.localeCompare(b.name)),
    [world],
  );

  const values = useMemo(() => {
    const m = new Map<string, number>();
    if (!live || !layer) return m;
    for (const c of countries) {
      const v = valueFor(layer, c.iso3, hazard);
      if (v !== null) m.set(c.iso3, v);
    }
    return m;
  }, [countries, layer, live, hazard]);

  const pins = useMemo(
    () => CASE_STUDIES.map((c) => ({ ...c, ...project(c.lat, c.lon, MAP_W, MAP_H) })),
    [],
  );

  const say = useCallback((iso3: string) => {
    const c = countries.find((x) => x.iso3 === iso3);
    if (!c) return;
    const v = values.get(iso3);
    setAnnounce(
      `${c.name}. ${v === undefined ? 'No value on this layer.' : `${v.toLocaleString()} ${layer?.unit ?? ''}`}`,
    );
  }, [countries, values, layer]);

  const move = useCallback((key: string) => {
    if (!countries.length) return;
    const i = cursor ? countries.findIndex((c) => c.iso3 === cursor) : -1;
    let next = countries[0];
    if (key === 'ArrowRight') next = countries[(Math.max(i, 0) + 1) % countries.length];
    else if (key === 'ArrowLeft') next = countries[(Math.max(i, 0) - 1 + countries.length) % countries.length];
    else if (i >= 0) {
      // Nearest neighbour north or south of the current centroid.
      const here = countries[i];
      const dir = key === 'ArrowUp' ? -1 : 1;
      let best: typeof here | null = null;
      let bestD = Infinity;
      for (const c of countries) {
        if (c.iso3 === here.iso3) continue;
        const dy = (c.cy - here.cy) * dir;
        if (dy <= 0) continue;
        const d = dy * dy + (c.cx - here.cx) ** 2 * 2.4;
        if (d < bestD) { bestD = d; best = c; }
      }
      if (best) next = best;
      else return;
    }
    setCursor(next.iso3);
    say(next.iso3);
  }, [countries, cursor, say]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
      e.preventDefault();
      move(e.key);
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (cursor) { setSelected(cursor); setOpenCase(null); }
    } else if (e.key === 'Escape') {
      setSelected(null);
      setOpenCase(null);
    }
  };

  const pick = (iso3: string) => {
    setCursor(iso3);
    setSelected((s) => (s === iso3 ? null : iso3));
    setOpenCase(null);
    say(iso3);
  };

  const selectedCountry = countries.find((c) => c.iso3 === selected) ?? null;
  const selectedCase = CASE_STUDIES.find((c) => c.id === openCase) ?? null;
  const cursorPath = countries.find((c) => c.iso3 === cursor) ?? null;
  const selectedPath = countries.find((c) => c.iso3 === selected) ?? null;

  const loading = worldState === 'loading' || layerState === 'loading';
  const scale = layer?.scale;
  const flipped = scale?.higherIs === 'better';

  // The instructions field runs to a paragraph; the frame gets its first
  // sentence and the dossier below carries the rest.
  const brief = (s: string | null | undefined) => {
    if (!s) return 'this source has not been ingested — see the colophon for the licence terms.';
    const cut = s.split('. ')[0].trim();
    const one = cut.endsWith('.') ? cut : `${cut}.`;
    return one.length > 220 ? `${one.slice(0, 217)}…` : one;
  };

  const notice = !world
    ? 'The base map (world.json) has not been built — run the preparedness pipeline.'
    : !layer
      ? `No file for this layer yet. The pipeline writes /data/preparedness/${layerId}.json.`
      : !live
        ? `Data not loaded — ${brief(layer.instructions)}`
        : null;

  return (
    <section className="pr-figure" id="map" aria-labelledby="map-title">
      <div className="wrap">
        <p className="eyebrow">Figure 1 · The map</p>
        <h2 className="section-title" id="map-title">Preparedness, by whichever measure you trust</h2>
        <p className="pr-note">
          Six international measures of the same thing, none of which agree. Choose one; the map
          recolours, the legend tells you which way is worse, and the source line tells you who
          says so and when they last said it.
        </p>

        {/* ── Controls ─────────────────────────────────────────────────── */}
        <div className="pr-controls">
          <div className="pr-ctrl-block">
            <h3 className="pr-ctrl-label" id="layer-label">Layer</h3>
            <div className="pr-layers" role="group" aria-labelledby="layer-label">
              {[1, 2].map((row) => (
                <div className="pr-layer-row" key={row}>
                  {LAYER_CHOICES.filter((l) => l.row === row).map((l) => {
                    const st = layers[l.id];
                    const ok = isLoaded(st);
                    return (
                      <button
                        key={l.id}
                        type="button"
                        className="pr-layer-btn"
                        aria-pressed={layerId === l.id}
                        onClick={() => { setLayerId(l.id); setSelected(null); }}
                        title={l.gloss}
                      >
                        <span className="pr-layer-name">{l.label}</span>
                        <span className="pr-layer-short">
                          {l.short}
                          {layerState === 'ready' && !ok ? ' · no data' : ''}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
            <p className="pr-ctrl-gloss">{choice.gloss}</p>
          </div>

          <div className="pr-ctrl-block">
            <h3 className="pr-ctrl-label" id="hazard-label">Hazard</h3>
            <div className="pr-hazards" role="group" aria-labelledby="hazard-label">
              <button
                type="button"
                className="pr-haz"
                aria-pressed={hazard === 'all'}
                onClick={() => setHazard('all')}
              >
                All hazards
              </button>
              {HAZARDS.map((h) => {
                const usable = Boolean(layer?.hazardDimension && layer.hazards?.includes(h.id));
                return (
                  <button
                    key={h.id}
                    type="button"
                    className="pr-haz"
                    aria-pressed={hazard === h.id}
                    /* aria-disabled rather than disabled: a disabled button
                       swallows hover, and the explanation lives in its title. */
                    aria-disabled={!usable}
                    title={
                      usable
                        ? `Show ${h.label.toLowerCase()} only`
                        : 'This index is not hazard-disaggregated — it reports one composite figure per country, and splitting it by hazard would be an invention.'
                    }
                    onClick={() => { if (usable) setHazard(h.id); }}
                  >
                    {h.label}
                  </button>
                );
              })}
            </div>
            <p className="pr-ctrl-gloss">
              {layer?.hazardDimension
                ? 'This layer is disaggregated. Greyed hazards are ones it does not carry.'
                : 'This index is not hazard-disaggregated: one composite figure per country, and no honest way to slice it.'}
            </p>
          </div>

          <div className="pr-ctrl-block pr-ctrl-narrow">
            <h3 className="pr-ctrl-label">Overlay</h3>
            <label className="pr-check">
              <input
                type="checkbox"
                checked={showPins}
                onChange={(e) => setShowPins(e.target.checked)}
              />
              <span>Fourteen case studies</span>
            </label>
            <p className="pr-ctrl-gloss">The events the essay is arguing from. Full cards below.</p>
          </div>
        </div>

        {/* ── The plate ────────────────────────────────────────────────── */}
        <figure className="pr-plate">
          <div className="pr-map-wrap">
            <div className="pr-scroll">
              <div className="pr-inner">
                <svg
                  viewBox={`0 0 ${MAP_W} ${MAP_H}`}
                  tabIndex={0}
                  role="img"
                  aria-label={
                    live && layer
                      ? `Choropleth world map: ${layer.label}, ${values.size} countries with a value, measured in ${layer.unit}. Darker is worse. The same figures are in the table below.`
                      : 'World map outline. No data is loaded for the selected layer.'
                  }
                  aria-describedby="pr-keys"
                  onKeyDown={onKeyDown}
                  className="pr-map"
                >
                  <defs>
                    <pattern id="pr-nodata" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                      <rect width="6" height="6" fill="var(--paper-lit)" />
                      <line x1="0" y1="0" x2="0" y2="6" stroke="var(--rule)" strokeWidth="1.6" />
                    </pattern>
                  </defs>

                  {countries.map((c) => {
                    const v = values.get(c.iso3);
                    const fill = !live || v === undefined || !scale
                      ? 'url(#pr-nodata)'
                      : rampColor(normalise(v, scale));
                    return (
                      <path
                        key={c.iso3}
                        className="pr-country"
                        d={c.d}
                        fill={fill}
                        onClick={() => pick(c.iso3)}
                      >
                        <title>
                          {`${c.name}${v === undefined
                            ? ' — no value on this layer'
                            : ` — ${v.toLocaleString()} ${layer?.unit ?? ''}`}`}
                        </title>
                      </path>
                    );
                  })}

                  {/* Cursor and selection, redrawn on top so their outlines
                      are not painted over by neighbours. */}
                  {cursorPath && <path className="pr-cursor" d={cursorPath.d} />}
                  {selectedPath && <path className="pr-selected" d={selectedPath.d} />}

                  {showPins && pins.map((p) => {
                    const on = openCase === p.id;
                    return (
                      <g
                        key={p.id}
                        className={`pr-pin${on ? ' sel' : ''}`}
                        tabIndex={0}
                        role="button"
                        aria-label={`Case study: ${p.pin}, ${p.year}${p.global ? ', global event' : ''}`}
                        aria-pressed={on}
                        onClick={() => { setOpenCase(on ? null : p.id); setSelected(null); }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            setOpenCase(on ? null : p.id);
                            setSelected(null);
                          }
                        }}
                      >
                        <circle className="pr-pin-hit" cx={p.x} cy={p.y} r={12} />
                        <circle className="pr-pin-ring" cx={p.x} cy={p.y} r={6.5} />
                        <circle className="pr-pin-dot" cx={p.x} cy={p.y} r={2.6} />
                      </g>
                    );
                  })}
                </svg>

              </div>
            </div>
            {notice && (
              <div className="pr-map-notice" role="status">
                <b>{loading ? 'Loading…' : 'Data not loaded'}</b>
                <span>{loading ? 'Fetching the layer files.' : notice}</span>
              </div>
            )}
            <p className="pr-scroll-hint" aria-hidden>Scroll sideways for the full plate →</p>
          </div>

          {/* ── Legend ─────────────────────────────────────────────────── */}
          <div className="pr-legend">
            <div className="pr-legend-main">
              <p className="pr-legend-title">
                {choice.label}
                <span> · {layer?.unit ?? 'no unit'}</span>
              </p>
              <div className="pr-ramp" aria-hidden>
                {RAMP_STEPS.map((c, i) => (
                  <i key={i} style={{ background: c }} />
                ))}
              </div>
              <p className="pr-legend-ends">
                <span>{live && scale ? scale.min.toLocaleString() : '—'}</span>
                <span className="pr-legend-dir">
                  {!live
                    ? 'no scale — this layer is not loaded'
                    : (flipped
                        ? 'ramp inverted: dark = low readiness'
                        : 'dark = worse / more of it') +
                      (scale?.transform === 'log' ? ' · log scale' : '')}
                </span>
                <span>{live && scale?.max != null ? scale.max.toLocaleString() : '—'}</span>
              </p>
            </div>
            <p className="pr-legend-nodata">
              <i className="pr-swatch-nodata" aria-hidden />
              no data — the country is not in this source, or not for this hazard
            </p>
          </div>

          <figcaption className="pr-plate-foot">
            <span>{sourceLine(layer?.source)}</span>
            <span className="pr-plate-no" aria-hidden>PREPAREDNESS — FIG. 1</span>
          </figcaption>
        </figure>

        {!live && layer && layerState === 'ready' && (
          <div className="pr-notloaded">
            <b>{layer.label} — not loaded</b>
            <span>
              {layer.instructions
                ?? 'This source has not been ingested. Nothing on the map above is standing in for it.'}
            </span>
            {layer.source?.limitations?.length ? (
              <ul className="pr-limits">
                {layer.source.limitations.map((l) => <li key={l}>{l}</li>)}
              </ul>
            ) : null}
          </div>
        )}

        <p className="pr-keys" id="pr-keys">
          Keyboard: tab to the map, then <kbd>←</kbd> <kbd>→</kbd> to walk countries
          alphabetically, <kbd>↑</kbd> <kbd>↓</kbd> for the nearest neighbour north or south,
          <kbd>Enter</kbd> to open the dossier, <kbd>Esc</kbd> to close it. Every value is also
          in the table at the foot of this figure.
        </p>
        <p className="pr-live" role="status" aria-live="polite">{announce}</p>

        {/* ── Dossier ──────────────────────────────────────────────────── */}
        {selectedCountry && layer && (
          <div className="pr-panel">
            <div className="pr-panel-head">
              <p className="pr-panel-eyebrow">{choice.label} · {choice.short}</p>
              <h3>
                {selectedCountry.name}
                <span className="ct">{selectedCountry.iso3}</span>
              </h3>
              <button
                type="button"
                className="pr-panel-x"
                onClick={() => setSelected(null)}
                aria-label="Close the country dossier"
              >
                ×
              </button>
            </div>

            {(() => {
              const v = values.get(selectedCountry.iso3);
              const rec = layer.countries?.[selectedCountry.iso3];
              return (
                <>
                  <p className="pr-panel-score">
                    {v === undefined ? (
                      <span className="pr-panel-none">No value in this source</span>
                    ) : (
                      <>
                        <b>{v.toLocaleString()}</b>
                        <span>{layer.unit}</span>
                        {scale && (
                          <i
                            className="pr-panel-chip"
                            style={{
                              background: rampColor(normalise(v, scale)),
                            }}
                            aria-hidden
                          />
                        )}
                      </>
                    )}
                  </p>

                  {rec?.components && Object.keys(rec.components).length > 0 && (
                    <div className="pr-panel-block">
                      <h4>Components</h4>
                      <dl className="pr-kv">
                        {Object.entries(rec.components).map(([k, val]) => (
                          <div key={k}>
                            <dt>{k}</dt>
                            <dd>{typeof val === 'number' ? val.toLocaleString() : '—'}</dd>
                          </div>
                        ))}
                      </dl>
                    </div>
                  )}

                  {rec?.byHazard && Object.keys(rec.byHazard).length > 0 && (
                    <div className="pr-panel-block">
                      <h4>By hazard</h4>
                      <dl className="pr-kv">
                        {HAZARDS.filter((h) => rec.byHazard?.[h.id] !== undefined).map((h) => (
                          <div key={h.id}>
                            <dt>{h.label}</dt>
                            <dd>{rec.byHazard?.[h.id]?.toLocaleString()}</dd>
                          </div>
                        ))}
                      </dl>
                    </div>
                  )}

                  <div className="pr-panel-block">
                    <h4>Provenance</h4>
                    <p className="pr-panel-src">{sourceLine(layer.source)}</p>
                    {layer.source?.limitations?.length ? (
                      <ul className="pr-limits">
                        {layer.source.limitations.map((l) => <li key={l}>{l}</li>)}
                      </ul>
                    ) : (
                      <p className="pr-panel-src">No limitations recorded for this source.</p>
                    )}
                  </div>
                </>
              );
            })()}
          </div>
        )}

        {/* ── Pin callout ──────────────────────────────────────────────── */}
        {selectedCase && (
          <div className="pr-panel pr-panel-case">
            <div className="pr-panel-head">
              <p className="pr-panel-eyebrow">
                Case study · {selectedCase.year}{selectedCase.global ? ' · global event' : ''}
              </p>
              <h3>{selectedCase.title}</h3>
              <button
                type="button"
                className="pr-panel-x"
                onClick={() => setOpenCase(null)}
                aria-label="Close the case study"
              >
                ×
              </button>
            </div>
            <p className="pr-case-toll">{selectedCase.toll}</p>
            <p className="pr-case-line">{selectedCase.happened}</p>
            <a className="pr-more" href={`#case-${selectedCase.id}`}>
              The full card, with the inquiry ↓
            </a>
          </div>
        )}

        {/* ── The numbers, as a table ──────────────────────────────────── */}
        <details className="table-toggle pr-table">
          <summary>
            Every country on this layer, as a table
            {live ? ` (${values.size})` : ' (no data loaded)'}
          </summary>
          <div className="table-scroll">
            {live ? (
              <table className="counts">
                <thead>
                  <tr>
                    <th>Country</th>
                    <th>ISO3</th>
                    <th>{layer?.unit ?? 'Score'}</th>
                  </tr>
                </thead>
                <tbody>
                  {countries
                    .filter((c) => values.has(c.iso3))
                    .sort((a, b) => (values.get(b.iso3) ?? 0) - (values.get(a.iso3) ?? 0))
                    .map((c) => (
                      <tr key={c.iso3}>
                        <td>{c.name}</td>
                        <td>{c.iso3}</td>
                        <td>{values.get(c.iso3)?.toLocaleString()}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            ) : (
              <p className="pr-empty">{notice ?? 'Nothing to tabulate yet.'}</p>
            )}
          </div>
        </details>
      </div>
    </section>
  );
}
