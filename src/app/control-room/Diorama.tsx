'use client';

/* ══════════════════════════════════════════════════════════════════════════
   The diorama: the stage's third viewport. The same controller as picture
   mode (PictureStage) — the same beats, lower third, call cards, record,
   sheet and transcript — draws its marks here on a paper model of the real
   ground instead of the hand-drawn board.

   This file is the React side: the labels (DOM, placed from the model each
   frame by the engine), the ground's credit line and its sheet, the view
   controls and their keys, the impact beat's band, and the fallback. The
   WebGL side (diorama-engine.ts, three.js) is imported only when this mode
   is chosen, so the log and picture modes never fetch it.

   Every word on the model restates the board: a zone's short name and its
   state word (the hazard's own vocabulary), WARNED BY YOU, the origin time,
   the names of the places a zone names. The model adds geography (real
   relief, real places) and says what it is: relief exaggerated ×N, terrain
   publisher · terms · retrieval date, zone areas drawn around named places.

   Accessibility: the canvas and every label are aria-hidden (the transcript
   carries the story, as in picture mode). The view controls are real
   buttons, and their keys are printed beside them.
   ══════════════════════════════════════════════════════════════════════════ */

import { useEffect, useMemo, useRef, useState } from 'react';
import type { Engine, GroundMeta, Palette } from './diorama-engine';
import { GlyphFor, glyphKey, type ViewportProps } from './viewport';
import { COMPASS_WORD, vocabFor } from './hazards';
import { tzLabel } from './summary';
import Sheet from './Sheet';
import * as sound from './sound';
import { BOOT_MS, BOOT_QUICK_MS } from './stage';

/** WebGL2 here at all? Asked before the engine chunk is fetched, so a browser
 *  without it never downloads three.js just to fall back. */
function webgl2(): boolean {
  try {
    const c = document.createElement('canvas');
    const g = c.getContext('webgl2');
    if (!g) return false;
    g.getExtension('WEBGL_lose_context')?.loseContext();
    return true;
  } catch {
    return false;
  }
}

const TOKENS: Record<keyof Palette, string> = {
  paper: '--paper', paperLit: '--paper-lit', paperDeep: '--paper-deep', ink: '--ink', inkSoft: '--ink-soft', rule: '--rule', ember: '--ember',
};
/** The house tokens, read from :root (never restated as raw colours here). */
function readPalette(): Palette {
  const cs = getComputedStyle(document.documentElement);
  const out = {} as Palette;
  for (const [k, v] of Object.entries(TOKENS) as [keyof Palette, string][]) {
    const m = /^#?([0-9a-f]{6})$/i.exec(cs.getPropertyValue(v).trim());
    const n = m ? parseInt(m[1], 16) : 0x777777;
    out[k] = [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  }
  return out;
}

const DIR8 = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

export default function Diorama(p: ViewportProps) {
  const { scenario, phase, cursor, rm, board, intent, stamps, safe, tray } = p;
  const spec = scenario.diorama;
  const vocab = vocabFor(scenario);
  const hostRef = useRef<HTMLDivElement>(null);
  const labelsRef = useRef<HTMLDivElement>(null);
  const glyphRef = useRef<HTMLDivElement>(null);
  const topRef = useRef<HTMLDivElement>(null);
  const topLRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<Engine | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready'>('loading');
  const [metas, setMetas] = useState<GroundMeta[]>([]);
  const [about, setAbout] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const failRef = useRef(p.onFail);
  failRef.current = p.onFail;
  const phone = !!tray && tray.side === 'top';

  // Every pictogram the day can stamp, rendered once (hidden) for the atlas.
  const glyphKeys = useMemo(() => Array.from(new Set(scenario.timesteps.flatMap((t) => t.info_available.map(glyphKey)))), [scenario]);

  // ── Start the engine (and stop it) ──────────────────────────────────────
  useEffect(() => {
    if (!spec) { failRef.current('this day has no ground for it yet'); return; }
    if (!webgl2()) { failRef.current('this browser has no WebGL'); return; }
    let dead = false;
    let eng: Engine | null = null;
    const glyphs = new Map<string, string>();
    const ser = new XMLSerializer();
    glyphRef.current?.querySelectorAll<HTMLElement>('[data-glyph]').forEach((el) => {
      const svg = el.querySelector('svg');
      if (svg) glyphs.set(el.dataset.glyph as string, ser.serializeToString(svg));
    });
    import('./diorama-engine')
      .then((m) => m.createEngine({
        host: hostRef.current!, labels: labelsRef.current!, scenario, palette: readPalette(), glyphs,
        onLost: () => failRef.current('the graphics context was lost'),
      }))
      .then((e) => {
        if (dead) { e.dispose(); return; }
        eng = e;
        engineRef.current = e;
        setMetas(e.frames);
        setStatus('ready');
      })
      .catch((err: unknown) => {
        if (dead) return;
        console.warn('diorama:', err);
        failRef.current('the model could not be built here');
      });
    return () => {
      dead = true;
      engineRef.current = null;
      eng?.dispose();
    };
  }, [scenario, spec]);

  // ── The ground rises from the paper, with the console's overture ────────
  const bootAt = useRef<number | null>(null);
  if (p.boot && bootAt.current === null && typeof performance !== 'undefined') bootAt.current = performance.now();
  const risen = useRef(false);
  useEffect(() => {
    const e = engineRef.current;
    if (status !== 'ready' || !e) return;
    if (!risen.current) {
      risen.current = true;
      if (rm) e.rise(0);
      else if (p.boot === 'full') e.rise(Math.max(900, BOOT_MS - (performance.now() - (bootAt.current ?? performance.now()))));
      else if (p.boot === 'quick') e.rise(Math.max(700, BOOT_QUICK_MS + 300));
      else e.rise(900);
    } else if (!p.boot) {
      // The overture was cut short (any press or key): land the ground now.
      e.rise(rm ? 0 : 180);
    }
    if (!p.boot) bootAt.current = null;
  }, [status, p.boot, rm]);

  // ── Hand the engine this beat ───────────────────────────────────────────
  const preview = p.preview;
  useEffect(() => {
    const e = engineRef.current;
    if (status !== 'ready' || !e) return;
    e.relabel();
    // The cards printed over the stage, in the model's own pixels.
    const host = hostRef.current;
    const hr = host?.getBoundingClientRect();
    const avoid = hr && host?.parentElement
      ? Array.from(host.parentElement.querySelectorAll<HTMLElement>('.cr-dio-plate, .cr-dio-wind, .cr-dio-impact, .cr-pchain, .cr-preads')).map((el) => {
        const r = el.getBoundingClientRect();
        return { x: r.left - hr.left, y: r.top - hr.top, w: r.width, h: r.height };
      }).filter((r) => r.w > 0 && r.h > 0)
      : [];
    e.update({
      avoid,
      phase, cursor, rm, playing: p.playing, phone,
      zoneStates: board.zoneStates, warned: board.warnedZones, warnedNow: p.warnedNow,
      spot: p.spot ?? [], preview: preview ?? [], fresh: p.fresh.zones, freshOrigins: p.fresh.origins,
      beatKey: p.beat, origins: Object.keys(board.origins), stamps, intent, safe, tray,
    });
  });

  // A zone's state changing is a beat: one soft detent as its drape pulses.
  useEffect(() => {
    if (status !== 'ready' || rm || !p.fresh.zones.length) return;
    sound.detent(520);
  }, [p.beat, status, rm, p.fresh.zones.length]);

  // ── The impact beat: the clock first lands at or past the cited impact ──
  const impactStep = useMemo(() => scenario.timesteps.findIndex((t) => t.time >= scenario.scoring.impact.time), [scenario]);
  const [impact, setImpact] = useState(false);
  const lastCursor = useRef<number | null>(null);
  useEffect(() => {
    const was = lastCursor.current;
    lastCursor.current = phase === 'brief' ? -1 : cursor;
    if (was === null || phase !== 'beats' || cursor !== impactStep || was >= cursor) return;
    setImpact(true);
    engineRef.current?.impact(spec?.impact_zone ?? null);
    if (!rm) sound.thud(260);
    const id = window.setTimeout(() => setImpact(false), rm ? 4200 : 3400);
    return () => window.clearTimeout(id);
  }, [cursor, phase, impactStep, rm, spec]);

  // ── The stage's other cards keep clear of the top stack ────────────────
  // An instrument's readings (placed by the controller at the safe area's top
  // left) drop below whatever the stack prints in that column: the wind tag
  // and band on a wide stage, the whole folded stack on a narrow one.
  useEffect(() => {
    const top = topRef.current;
    const left = topLRef.current;
    const view = top?.parentElement;
    if (!top || !left || !view) return;
    const set = () => {
      const narrow = getComputedStyle(top).display === 'flex';
      const h = narrow ? top.offsetHeight : left.offsetHeight;
      view.style.setProperty('--cr-dio-reads-dy', h > 0 ? `${Math.round(h + 6)}px` : '0px');
    };
    set();
    const ro = new ResizeObserver(set);
    ro.observe(top);
    ro.observe(left);
    return () => { ro.disconnect(); view.style.removeProperty('--cr-dio-reads-dy'); };
  }, [spec]);

  // ── View keys: [ ] turn, − = lean, 0 resets (on the stage, or the page) ─
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.closest('input, textarea, select, [contenteditable="true"], dialog') || (t !== document.body && !t.closest('#cr-stage')))) return;
      const map: Record<string, 'left' | 'right' | 'in' | 'out' | 'reset'> = { '[': 'left', ']': 'right', '=': 'in', '+': 'in', '-': 'out', '0': 'reset' };
      const what = map[e.key];
      if (!what || !engineRef.current) return;
      engineRef.current.nudge(what);
      e.preventDefault();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  if (!spec) return null;
  const zoneName = (id: string) => scenario.warning_chain?.zones?.[id] ?? scenario.scoring.at_risk_zones.find((z) => z.id === id)?.label ?? id;
  const anchorOf = (id: string) => {
    const e = spec.zones[id];
    return e.places.find((x) => x.name === e.anchor) ?? e.places[0];
  };
  const frameCentre = metas[0] ? [(metas[0].bbox[0] + metas[0].bbox[2]) / 2, (metas[0].bbox[1] + metas[0].bbox[3]) / 2] : null;
  const bearing = (lat: number, lon: number) => {
    if (!frameCentre) return '';
    const dx = (lon - frameCentre[0]) * Math.cos((lat * Math.PI) / 180);
    const dy = lat - frameCentre[1];
    const a = (Math.atan2(dx, dy) * 180) / Math.PI;
    return COMPASS_WORD[DIR8[Math.round(((a + 360) % 360) / 45) % 8]];
  };
  const originLift = phone ? 62 + 30 + 6 : 84 + 40 + 6;
  const src = metas[0]?.source;
  const publisher = src?.publisher.split(' (')[0];
  const impactName = spec.impact_zone ? zoneName(spec.impact_zone) : null;

  return (
    <>
      <div ref={hostRef} className={`cr-dio is-${status}`}>
        <div ref={labelsRef} className="cr-dio-labels" aria-hidden>
          {metas.map((m) => (
            <span key={m.id} className="cr-dio-lab cr-dio-frame" data-lon={(m.bbox[0] + m.bbox[2]) / 2} data-lat={m.bbox[1]} data-ground="0">
              <span className="cr-dio-frame-body">{m.name}</span>
            </span>
          ))}
          {scenario.scoring.at_risk_zones.map(({ id }) => {
            const e = spec.zones[id];
            if (!e) return null;
            const a = anchorOf(id);
            const s = board.zoneStates[id] ?? 'quiet';
            const warned = board.warnedZones.includes(id);
            return (
              <span key={id} className={`cr-dio-lab cr-dio-zone is-${s}${warned ? ' is-warned' : ''}${p.spot?.includes(id) ? ' is-spot' : ''}`}
                data-zone={id} data-lon={a.lon} data-lat={a.lat}>
                <span className="cr-dio-zone-body">
                  <span className="cr-dio-zone-name">{zoneName(id)}</span>
                  <span className="cr-dio-zone-state">{vocab.states[s]}</span>
                  {warned && <span className="cr-dio-zone-warned">Warned by you</span>}
                  {e.beyond_frame && <span className="cr-dio-zone-beyond">Beyond the table · {bearing(a.lat, a.lon)}</span>}
                </span>
              </span>
            );
          })}
          {scenario.scoring.at_risk_zones.flatMap(({ id }) => {
            const e = spec.zones[id];
            if (!e || e.beyond_frame) return [];
            return e.places.map((pl) => (
              <span key={`${id}-${pl.name}`} className="cr-dio-lab cr-dio-place" data-lon={pl.lon} data-lat={pl.lat}>
                <span className="cr-dio-place-body">{pl.name}</span>
              </span>
            ));
          })}
          {Object.entries(board.origins).map(([z, label]) => {
            if (!spec.zones[z]) return null;
            const a = anchorOf(z);
            return (
              <span key={`o-${z}`} className={`cr-dio-lab cr-dio-origin${p.fresh.origins.includes(z) ? ' is-fresh' : ''}`}
                data-zone={z} data-lon={a.lon} data-lat={a.lat} data-lift={originLift}>
                <span className="cr-dio-origin-body">{label}</span>
              </span>
            );
          })}
        </div>
        {/* The pictograms, drawn once for the engine's chit atlas. */}
        <div ref={glyphRef} hidden aria-hidden>
          {glyphKeys.map((k) => <span key={k} data-glyph={k}><GlyphFor glyph={k} size={48} /></span>)}
        </div>
        {status === 'loading' && <p className="cr-dio-loading" aria-hidden>Laying out the ground…</p>}
      </div>

      {/* The top of the stage, one grid so nothing printed there overlaps:
          the wind and the impact band in the open column, the plate in its
          own (wide); stacked plate-first on a narrow stage. */}
      <div ref={topRef} className="cr-dio-top" style={safe ? { top: safe.y + 10, left: safe.x + 10 } : undefined}>
        <div ref={topLRef} className="cr-dio-top-l">
          {board.wind && (
            <p className="cr-dio-wind" aria-hidden>
              {COMPASS_WORD[board.wind.from]?.toUpperCase()} WINDS · AS OF {board.wind.by}
            </p>
          )}
          {impact && (
            <div className={`cr-dio-impact${rm ? ' is-still' : ''}`} aria-hidden>
              <span className="cr-dio-impact-band">
                <span className="cr-dio-impact-time">{scenario.scoring.impact.time} {tzLabel(scenario)}</span>
                <span className="cr-dio-impact-title">The record&apos;s impact time</span>
                <span className="cr-dio-impact-sub">{impactName ? `${impactName} · ` : ''}the debrief sets every call against it</span>
              </span>
            </div>
          )}
        </div>

        <div className={`cr-dio-plate${viewOpen ? ' is-open' : ''}`}>
          <div className="cr-dio-plate-head">
            <div className="cr-dio-plate-text">
              <p className="cr-dio-plate-line">
                <span className="cr-dio-long">Relief exaggerated ×{spec.exaggeration} · contours every {spec.contour_m} m</span>
                <span className="cr-dio-short">Relief ×{spec.exaggeration} · contours {spec.contour_m} m</span>
              </p>
              {src && (
                <p className="cr-dio-plate-src">
                  <span className="cr-dio-long">Ground: </span>{publisher} · attribution terms, no named licence · retrieved {src.retrieved}
                </p>
              )}
            </div>
            {/* Narrow stages: the view controls fold away behind this. */}
            <button type="button" className="cr-dio-vbtn cr-dio-plate-toggle" aria-expanded={viewOpen} aria-controls="cr-dio-view"
              onClick={() => setViewOpen((v) => !v)}>
              View
              <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden focusable="false"><path d={viewOpen ? 'M2 6h8' : 'M6 2v8M2 6h8'} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
            </button>
          </div>
          <div className="cr-dio-view" id="cr-dio-view" role="group" aria-label="Diorama view">
            <button type="button" className="cr-dio-vbtn" onClick={() => engineRef.current?.nudge('left')} aria-label="Turn the table left" title="Turn left  [">
              <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden focusable="false"><path d="M12.5 9.5A5 5 0 1 1 10 3.6M10 1v3h3" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
            <button type="button" className="cr-dio-vbtn" onClick={() => engineRef.current?.nudge('right')} aria-label="Turn the table right" title="Turn right  ]">
              <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden focusable="false"><path d="M3.5 9.5A5 5 0 1 0 6 3.6M6 1v3H3" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
            <button type="button" className="cr-dio-vbtn" onClick={() => engineRef.current?.nudge('in')} aria-label="Lean in" title="Lean in  =">
              <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden focusable="false"><path d="M8 3v10M3 8h10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
            </button>
            <button type="button" className="cr-dio-vbtn" onClick={() => engineRef.current?.nudge('out')} aria-label="Lean out" title="Lean out  −">
              <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden focusable="false"><path d="M3 8h10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
            </button>
            <button type="button" className="cr-dio-vbtn cr-dio-vbtn-word" onClick={() => engineRef.current?.nudge('reset')} title="Reset the view  0">Reset</button>
            <button type="button" className="cr-dio-vbtn cr-dio-vbtn-word" onClick={() => setAbout(true)} aria-haspopup="dialog">The ground</button>
          </div>
          <p className="cr-dio-hint">
            <span className="cr-dio-hint-touch">Drag to turn the table · pinch to lean in</span>
            <span className="cr-dio-hint-keys">Drag to turn, scroll to lean · keys <kbd>[</kbd> <kbd>]</kbd> turn, <kbd>−</kbd> <kbd>=</kbd> lean, <kbd>0</kbd> resets</span>
            <span> · each new slip sets the view back</span>
          </p>
        </div>
      </div>

      <Sheet open={about} onClose={() => setAbout(false)} title="The ground under the diorama" id="cr-dio-about-title" className="cr-psheet">
        <div className="cr-dio-about">
          <p>The model is real elevation for the places this day names, printed as a paper map: relief exaggerated
            ×{spec.exaggeration} so it reads at table size, contours every {spec.contour_m} m with a heavier line
            every {spec.contour_m * 5} m, light from the north-west.</p>
          <p><strong>Water</strong> is read from the elevation itself: ground at or below 0 m that the frame&apos;s
            edge reaches through ground at or below 0 m. Land below sea level that is enclosed stays land; the model
            never draws a place under water.</p>
          <p><strong>Zones</strong> are drawn around the places each zone names in the day&apos;s own text. They are
            a cartographic aid, not official boundaries. Their state is the board&apos;s, lit only by cited slips and
            your own calls.</p>
          <ul className="cr-dio-about-zones">
            {scenario.scoring.at_risk_zones.map(({ id, label }) => {
              const e = spec.zones[id];
              if (!e) return null;
              return (
                <li key={id}><strong>{label}</strong>: {e.places.map((x) => x.name).join(', ')}
                  {e.beyond_frame ? ' (beyond the modelled ground; marked at its edge)' : ''}</li>
              );
            })}
          </ul>
          <p><strong>Nothing is simulated.</strong> No fire, water or wind moves on the model; the impact beat
            restates the cited impact time and nothing else.</p>
          {metas.map((m) => (
            <div key={m.id} className="cr-dio-about-src">
              <p className="cr-dio-about-name">{m.name}</p>
              <p>{m.source.dataset}. Publisher: {m.source.publisher}. Retrieved {m.source.retrieved}.{' '}
                <a href={m.source.url} rel="noopener noreferrer" target="_blank">Registry page</a>.</p>
              <p className="cr-dio-about-lic">{m.source.license}</p>
              <p><a href={m.source.licenseUrl} rel="noopener noreferrer" target="_blank">The attribution file</a></p>
            </div>
          ))}
        </div>
      </Sheet>
    </>
  );
}
