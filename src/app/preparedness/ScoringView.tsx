'use client';

/*
 * Figure 2 — past against future.
 *
 * Two composites of the same countries. The left one is built from what has
 * already happened to them: recorded mortality and recorded displacement. The
 * right one is built from what has been promised on their behalf: coping
 * capacity, adaptation readiness, early-warning coverage. If the promises were
 * worth their scores, the two rankings would agree.
 *
 * The composite is the dangerous object on this page, so it is fenced in:
 * the weights are visible, user-adjustable and normalised on screen; every
 * component score is shown alongside the total; any component whose layer did
 * not load is named, excluded, and the exclusion stated; and the framing line
 * — a hypothesis, not a verdict — never leaves the frame.
 */

import { useMemo, useState } from 'react';
import { isLoaded, normalise, rampColor, useLayers, useWorld } from './data';
import { LAYER_CHOICES, type Layer, type LayerId } from './types';
import type { LayerMap } from './data';

interface CompDef {
  id: string;
  layer: LayerId;
  label: string;
  /** Five characters for the per-row component read-out. */
  short: string;
  /** What the number means once it has been turned the right way up. */
  note: string;
  /** Prefer a named sub-component of the layer, when the layer carries one. */
  component?: RegExp;
}

const PAST: CompDef[] = [
  { id: 'mortality', layer: 'emdat', short: 'MORT', label: 'Recorded mortality', note: 'Disaster deaths on the record. Fewer scores higher.' },
  { id: 'displacement', layer: 'idmc', short: 'DISP', label: 'Displacement', note: 'New internal displacements from disasters. Fewer scores higher.' },
];

const FUTURE: CompDef[] = [
  { id: 'coping', layer: 'inform', short: 'COPE', label: 'Coping capacity', note: 'INFORM lack-of-coping-capacity, inverted, so more capacity scores higher.', component: /coping/i },
  { id: 'readiness', layer: 'ndgain', short: 'READY', label: 'Adaptation readiness', note: 'ND-GAIN readiness. Higher already means better.' },
  { id: 'mhews', layer: 'sendai', short: 'MHEWS', label: 'Early warning', note: 'Reported multi-hazard early-warning coverage. Higher already means better.' },
];

const USED_LAYERS: LayerId[] = ['emdat', 'idmc', 'inform', 'ndgain', 'sendai'];

/** 0 (worst standing) … 1 (best standing), with each index turned right way up. */
function standing(layer: Layer, iso3: string, component?: RegExp): number | null {
  const rec = layer.countries?.[iso3];
  if (!rec) return null;
  let raw: number | null = null;
  if (component && rec.components) {
    const hit = Object.entries(rec.components).find(([k]) => component.test(k));
    if (hit && typeof hit[1] === 'number') raw = hit[1];
  }
  if (raw === null && typeof rec.score === 'number') raw = rec.score;
  if (raw === null) return null;
  // normalise() returns worseness on every layer; standing is its complement.
  return 1 - normalise(raw, layer.scale);
}

interface Row {
  iso3: string;
  name: string;
  score: number;
  parts: { id: string; label: string; short: string; value: number | null }[];
  used: number;
}

function Panel({
  kind, title, blurb, defs, layers, countries,
}: {
  kind: 'past' | 'future';
  title: string;
  blurb: string;
  defs: CompDef[];
  layers: LayerMap;
  countries: { iso3: string; name: string }[];
}) {
  const [weights, setWeights] = useState<Record<string, number>>(
    () => Object.fromEntries(defs.map((d) => [d.id, 50])),
  );
  const [end, setEnd] = useState<'top' | 'bottom'>('bottom');
  const [query, setQuery] = useState('');

  const available = defs.filter((d) => isLoaded(layers[d.layer]));
  const missing = defs.filter((d) => !isLoaded(layers[d.layer]));

  const weightTotal = available.reduce((s, d) => s + (weights[d.id] ?? 0), 0);

  const rows = useMemo<Row[]>(() => {
    if (!available.length || weightTotal <= 0) return [];
    const out: Row[] = [];
    for (const c of countries) {
      const parts = defs.map((d) => {
        const l = layers[d.layer] ?? null;
        return {
          id: d.id,
          label: d.label,
          short: d.short,
          value: l && isLoaded(l) ? standing(l, c.iso3, d.component) : null,
        };
      });
      let num = 0;
      let den = 0;
      for (const d of available) {
        const p = parts.find((x) => x.id === d.id);
        if (!p || p.value === null) continue;
        num += p.value * (weights[d.id] ?? 0);
        den += weights[d.id] ?? 0;
      }
      if (den <= 0) continue;
      out.push({
        iso3: c.iso3,
        name: c.name,
        score: num / den,
        parts,
        used: parts.filter((p) => p.value !== null).length,
      });
    }
    return out.sort((a, b) => a.score - b.score);
  }, [countries, defs, available, layers, weights, weightTotal]);

  const filtered = query.trim()
    ? rows.filter((r) =>
      r.name.toLowerCase().includes(query.trim().toLowerCase())
      || r.iso3.toLowerCase() === query.trim().toLowerCase())
    : end === 'bottom'
      ? rows.slice(0, 12)
      : rows.slice(-12).reverse();

  return (
    <div className={`pr-panel-col pr-${kind}`}>
      <p className="pr-col-eyebrow">{kind === 'past' ? 'Past · observed outcomes' : 'Future · promised capacity'}</p>
      <h3 className="pr-col-title">{title}</h3>
      <p className="pr-col-blurb">{blurb}</p>

      <div className="pr-weights">
        <p className="pr-weights-head">
          Weights <span>drag to re-argue the composite</span>
        </p>
        {defs.map((d) => {
          const ok = isLoaded(layers[d.layer]);
          const share = ok && weightTotal > 0 ? (weights[d.id] ?? 0) / weightTotal : 0;
          const choice = LAYER_CHOICES.find((l) => l.id === d.layer);
          return (
            <div className={`pr-weight${ok ? '' : ' off'}`} key={d.id}>
              <label htmlFor={`w-${kind}-${d.id}`}>
                <span className="pr-weight-name">{d.label}</span>
                <span className="pr-weight-pct">
                  {ok ? `${Math.round(share * 100)}%` : 'not loaded'}
                </span>
              </label>
              <input
                id={`w-${kind}-${d.id}`}
                type="range"
                min={0}
                max={100}
                step={5}
                value={weights[d.id] ?? 0}
                disabled={!ok}
                onChange={(e) => setWeights((w) => ({ ...w, [d.id]: Number(e.target.value) }))}
                aria-describedby={`wn-${kind}-${d.id}`}
              />
              <p className="pr-weight-note" id={`wn-${kind}-${d.id}`}>
                {ok
                  ? d.note
                  : `${choice?.short ?? d.layer} did not load — this component is excluded from the composite below.`}
              </p>
            </div>
          );
        })}
        {missing.length > 0 && (
          <p className="pr-excluded">
            Excluded: {missing.map((d) => d.label).join(', ')}. The composite is computed from the{' '}
            {available.length} component{available.length === 1 ? '' : 's'} that loaded, and is not
            comparable with a run where all of them did.
          </p>
        )}
      </div>

      <div className="pr-rank-controls">
        <div className="pr-toggle-sm" role="group" aria-label="Which end of the ranking">
          <button type="button" aria-pressed={end === 'bottom'} onClick={() => setEnd('bottom')}>
            Worst 12
          </button>
          <button type="button" aria-pressed={end === 'top'} onClick={() => setEnd('top')}>
            Best 12
          </button>
        </div>
        <input
          type="search"
          className="pr-search"
          placeholder="Find a country…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label={`Search countries in the ${kind} ranking`}
        />
      </div>

      {available.length === 0 ? (
        <p className="pr-empty">
          None of this side&rsquo;s layers have loaded, so there is nothing to rank. The page will
          not stand in a number for them.
        </p>
      ) : filtered.length === 0 ? (
        <p className="pr-empty">No country matches that search.</p>
      ) : (
        <ol className="pr-rank" start={1}>
          {filtered.map((r) => (
            <li key={r.iso3}>
              <span className="pr-rank-name">
                {r.name}
                <span className="pr-rank-iso">{r.iso3}</span>
              </span>
              <span className="pr-rank-track">
                <span
                  className="pr-rank-bar"
                  style={{
                    width: `${Math.max(2, r.score * 100)}%`,
                    background: rampColor(1 - r.score),
                  }}
                />
              </span>
              <span className="pr-rank-score">{(r.score * 100).toFixed(0)}</span>
              <span className="pr-rank-parts">
                {r.parts.map((p) => (
                  <span key={p.id} title={p.label}>
                    {`${p.short} ${p.value === null ? '—' : (p.value * 100).toFixed(0)}`}
                  </span>
                ))}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

export default function ScoringView() {
  const { data: world } = useWorld();
  const { layers, state } = useLayers(USED_LAYERS);

  const countries = useMemo(
    () => (world?.countries ?? []).map((c) => ({ iso3: c.iso3, name: c.name })),
    [world],
  );

  return (
    <section className="pr-figure pr-scoring" id="scoring" aria-labelledby="scoring-title">
      <div className="wrap">
        <p className="eyebrow">Figure 2 · Past against future</p>
        <h2 className="section-title" id="scoring-title">
          What happened, and what was promised
        </h2>
        <p className="pr-note">
          Two composites, built from the same country list. On the left, outcomes already on the
          record. On the right, capacity as reported by the states that hold it. Set the weights
          yourself — that is the point of showing them.
        </p>

        <p className="pr-hypothesis" role="note">
          <b>A hypothesis, not a verdict.</b> A composite index is an argument with the arithmetic
          left in. Every component score is printed beside its total; change the weights and the
          ranking changes, which is the honest thing about it and also the reason not to quote it.
        </p>

        {state === 'loading' && <p className="pr-empty">Loading the layers…</p>}

        <div className="pr-two-col">
          <Panel
            kind="past"
            title="Observed outcomes"
            blurb="Deaths and displacement already recorded. High is good: it means less of both."
            defs={PAST}
            layers={layers}
            countries={countries}
          />
          <Panel
            kind="future"
            title="Promised capacity"
            blurb="Coping capacity, adaptation readiness and early-warning coverage, as reported."
            defs={FUTURE}
            layers={layers}
            countries={countries}
          />
        </div>

        <p className="pr-plate-foot pr-foot-standalone">
          <span>
            Composites computed in the browser from the layer files; components normalised to each
            source&rsquo;s own published range and turned so that 100 is always the better end.
          </span>
          <span className="pr-plate-no" aria-hidden>PREPAREDNESS — FIG. 2</span>
        </p>
      </div>
    </section>
  );
}
