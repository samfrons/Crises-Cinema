'use client';

/*
 * Loading, colour and formatting for /preparedness.
 *
 * Every artefact is fetched at runtime and every fetch is allowed to fail:
 * the pipeline that writes public/data/preparedness/ can only ship the layers
 * whose licences let it, so "this file is not here" is a normal state of the
 * page and not an error condition. Missing always resolves to null, and the
 * components render the absence in words.
 */

import { useEffect, useState } from 'react';
import type {
  Funding, Layer, LayerId, LayerScale, LayerSource, World,
} from './types';

/* ── Fetch, once per URL per page load ───────────────────────────────────── */

const cache = new Map<string, Promise<unknown>>();

export function loadJson<T>(url: string): Promise<T | null> {
  let hit = cache.get(url) as Promise<T | null> | undefined;
  if (!hit) {
    hit = fetch(url)
      .then((r) => (r.ok ? (r.json() as Promise<T>) : null))
      .catch(() => null);
    cache.set(url, hit);
  }
  return hit;
}

export type LoadState = 'loading' | 'ready';

/** One JSON file. `data` is null both while loading and when the file is absent. */
export function useJson<T>(url: string): { data: T | null; state: LoadState } {
  const [data, setData] = useState<T | null>(null);
  const [state, setState] = useState<LoadState>('loading');
  useEffect(() => {
    let live = true;
    loadJson<T>(url).then((d) => {
      if (!live) return;
      setData(d);
      setState('ready');
    });
    return () => { live = false; };
  }, [url]);
  return { data, state };
}

export const useWorld = () => useJson<World>('/data/preparedness/world.json');
export const useFunding = () => useJson<Funding>('/data/preparedness/funding.json');

export type LayerMap = Partial<Record<LayerId, Layer | null>>;

/**
 * The requested layers, by id. A layer that 404s is null, which the UI reads
 * the same way it reads status "not_loaded" — nothing to draw, say why.
 * `ids` is expected to be a module-scope constant so the effect runs once.
 */
export function useLayers(ids: LayerId[]): { layers: LayerMap; state: LoadState } {
  const [layers, setLayers] = useState<LayerMap>({});
  const [state, setState] = useState<LoadState>('loading');
  const key = ids.join(',');
  useEffect(() => {
    let live = true;
    const wanted = key.split(',') as LayerId[];
    Promise.all(wanted.map((id) => loadJson<Layer>(`/data/preparedness/${id}.json`)))
      .then((got) => {
        if (!live) return;
        const next: LayerMap = {};
        wanted.forEach((id, i) => { next[id] = got[i]; });
        setLayers(next);
        setState('ready');
      });
    return () => { live = false; };
  }, [key]);
  return { layers, state };
}

/**
 * A layer is usable only when it exists, says it loaded, brought country values
 * and carries a range to colour them against. A stub ships `scale.max: null`
 * because nothing has been observed yet, and there is no ramp without a top.
 *
 * Deliberately not a type predicate: callers need to keep talking about a
 * layer *after* deciding it is a stub — to print its licence and its
 * instructions — and a predicate narrows that branch away to `never`.
 */
export const isLoaded = (l: Layer | null | undefined): boolean =>
  Boolean(
    l && l.status === 'loaded'
    && l.countries && Object.keys(l.countries).length
    && l.scale && typeof l.scale.max === 'number' && l.scale.max > l.scale.min,
  );

/* ── The choropleth ramp ─────────────────────────────────────────────────── */

/*
 * A sequential ramp mixed in OKLCH so its steps are perceptually even, run
 * through four anchors: pale parchment, teal, blue, ink-blue-black. Multi-hue
 * like viridis — lightness does the work that survives colour vision
 * deficiency, and the hue turn gives a second, redundant channel. It starts a
 * shade cooler than the paper (#f1e8d5) so the lightest step still reads as a
 * value rather than as a hole in the map. Ember never appears here: on this
 * site red is the touched state, and a data ramp that borrowed it would make
 * every high value look selected.
 */
type Oklch = [number, number, number]; // L 0..1, C, hue degrees

const ANCHORS: { t: number; c: Oklch }[] = [
  { t: 0.00, c: [0.862, 0.055, 112] },
  { t: 0.36, c: [0.660, 0.088, 178] },
  { t: 0.70, c: [0.440, 0.105, 236] },
  { t: 1.00, c: [0.240, 0.072, 268] },
];

const gamma = (u: number) =>
  u <= 0.0031308 ? 12.92 * u : 1.055 * Math.pow(u, 1 / 2.4) - 0.055;

const hex2 = (u: number) =>
  Math.round(Math.min(1, Math.max(0, u)) * 255).toString(16).padStart(2, '0');

function oklchToHex([L, C, h]: Oklch): string {
  const a = C * Math.cos((h * Math.PI) / 180);
  const b = C * Math.sin((h * Math.PI) / 180);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const r = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const bl = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;
  return `#${hex2(gamma(r))}${hex2(gamma(g))}${hex2(gamma(bl))}`;
}

/** t in 0..1, where 1 is always the "worse / more of it" end. */
export function rampColor(t: number): string {
  const u = Math.min(1, Math.max(0, t));
  let i = 0;
  while (i < ANCHORS.length - 2 && u > ANCHORS[i + 1].t) i += 1;
  const a = ANCHORS[i];
  const b = ANCHORS[i + 1];
  const k = (u - a.t) / (b.t - a.t);
  return oklchToHex([
    a.c[0] + (b.c[0] - a.c[0]) * k,
    a.c[1] + (b.c[1] - a.c[1]) * k,
    a.c[2] + (b.c[2] - a.c[2]) * k,
  ]);
}

/*
 * The nine legend steps, light to dark. Checked against the cream page
 * (#f1e8d5): the lightest step sits at 1.24:1 against the paper — as low as a
 * sequential ramp's floor ever gets — so every country carries a paper hairline
 * stroke and the "no data" state is a hatch rather than a paler fill, and the
 * numbers table underneath is the relief channel. From step 4 down the ramp
 * clears 3.5:1 and keeps climbing to 13.6:1.
 */
export const RAMP_STEPS = Array.from({ length: 9 }, (_, i) => rampColor(i / 8));

/**
 * Normalise a raw value to the ramp's 0..1, where 1 is always the worse end.
 * For an index whose high scores are *good* (ND-GAIN readiness, early-warning
 * coverage) the mapping is flipped, so dark means the same thing on every
 * layer of the map. The legend says so out loud.
 */
export function normalise(value: number, scale: LayerScale): number {
  if (typeof scale?.max !== 'number') return 0;
  const span = scale.max - scale.min;
  const t = span === 0 ? 0 : (value - scale.min) / span;
  const clamped = Math.min(1, Math.max(0, t));
  return scale.higherIs === 'better' ? 1 - clamped : clamped;
}

/* ── Projection ──────────────────────────────────────────────────────────── */

/** The same equirectangular formula world.json was pre-projected with. */
export const project = (lat: number, lon: number, w = 1000, h = 500) => ({
  x: ((lon + 180) / 360) * w,
  y: ((90 - lat) / 180) * h,
});

/* ── Formatting ──────────────────────────────────────────────────────────── */

export function fmtUsd(n: number): string {
  if (!Number.isFinite(n)) return '—';
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)} trn`;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)} bn`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(0)} m`;
  return `$${Math.round(n).toLocaleString()}`;
}

/** "Publisher · Licence · as of 2024-06-01" — printed under every figure. */
export function sourceLine(s: LayerSource | undefined): string {
  if (!s) return 'Source not recorded';
  return [s.publisher, s.license, s.asOf ? `as of ${s.asOf}` : null]
    .filter(Boolean)
    .join(' · ');
}
