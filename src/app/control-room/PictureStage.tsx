'use client';

/* ══════════════════════════════════════════════════════════════════════════
   Picture mode: the same run, projected onto the board.

   Nothing here is new record. The stage is drawn from exactly what the log
   prints — the same run state (cursor, choices), the same cited slips, the
   same derived board and chain — re-sequenced so an hour plays out where it
   happened instead of as a block of text:

     beats  — the hour's slips, one at a time (~1.5–2.5s each, or a press at
              a time for reduced motion). Each slip's pictogram stamps at its
              zone on the board (or on the desk margin, for a slip that names
              no zone), the camera moves to where it is, the board lights as
              far as THIS slip lights it, and the slip prints as a lower third:
              its time, its `headline` (a verbatim fragment of its text — the
              build checks it) and its citation. A figure fills the stage with
              its caption and credit. Pressing the lower third opens the full
              slip, citation and all, in the desk's sheet.
     call   — the camera pulls to the zones the options concern and the
              options are set as large cards: the same buttons, the same
              labels, the same effects.
     record — your call lands on the board: the zones you warned ink in, a
              dispatch line runs from the desk to each (presentation of the
              warning you just issued, nothing more), and what the record says
              followed — or that it is silent — sits in the lower third.

   Two renderers, one controller. Everything above — the beats, the timing,
   the lower third, the call, the record, the sheet, the transcript — lives
   here, once. What the camera should look at is decided here too, as an
   intent (establish · a slip's zones · where the record first places the
   hazard · the call · your warned zones · the end), and handed to a
   viewport that draws it: the hand-drawn board (BoardViewport, below), or
   the diorama (Diorama.tsx: the same marks on a WebGL model of the real
   ground, loaded only when that mode is chosen). Either viewport draws only
   what the controller derived; neither adds a state, a mark or a word.

   Accessibility: the stage is a picture of the log, so its story is the
   log's. Everything drawn is aria-hidden; the transcript beside it (in
   ControlRoomGame) carries every slip's full text through a live region;
   the controls, the lower third and the decision cards are real buttons.
   Reduced motion: no autoplay (a Next beat button steps through), no camera
   travel — each frame is cut to at once — and the active zone is struck
   twice out of register, the desk's still idiom for "this is new".
   ══════════════════════════════════════════════════════════════════════════ */

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import Diorama from './Diorama';
import { GlyphFor, glyphKey, type Phase, type Rect, type Stamp, type StageIntent, type Tray, type ViewportProps } from './viewport';
import type { InfoItem, MediaAttachment, Option, Scenario, Timestep } from './types';
import type { Choice } from './scoring';
import OpsMap, { originPoint } from './OpsMap';
import WarningChain, { chainChangesAt, deriveChain } from './WarningChain';
import Readings from './Readings';
import Sheet from './Sheet';
import { KindGlyph, SilentGlyph } from './glyphs';
import { vocabFor } from './hazards';
import { deriveBoard, stamp, warnedBy } from './board';
import { inWords, tzLabel } from './summary';
import { Portrait, speakerFor } from './speakers';
import { TICK_SPACING } from './stage';
import * as sound from './sound';

/** Camera travel (CSS: .cr-cam transition, --cam-ms). */
export const CAM_MS = 760;
/** How long a slip holds the stage on autoplay. */
const beatMs = (info: InfoItem) => {
  if (info.media) return 2600;
  if (info.readings) return 2500;
  return Math.max(1500, Math.min(2500, 1300 + (info.headline ?? info.text).length * 14));
};
/** The lower third types out a character a step, up to this long. */
const typeMs = (chars: number) => Math.min(chars * 9, 640);

type Box = { x: number; y: number; w: number; h: number };
type Frame = { s: number; x: number; y: number };
const NO_FRESH = { zones: [] as string[], origins: [] as string[], wind: false };
const NONE = new Set<string>();

const union = (bs: Box[]): Box | null => {
  if (!bs.length) return null;
  const x0 = Math.min(...bs.map((b) => b.x));
  const y0 = Math.min(...bs.map((b) => b.y));
  const x1 = Math.max(...bs.map((b) => b.x + b.w));
  const y1 = Math.max(...bs.map((b) => b.y + b.h));
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
};
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** The camera's frame: the plate fitted to the safe area (box null: the wide
 *  shot), or `box` filled into it, never closer than `maxZoom` times wide and
 *  never so far off the plate that paper shows where the board could be. */
function frameFor(box: Box | null, safe: Rect, maxZoom: number): Frame {
  const s0 = Math.min(safe.w / 720, safe.h / 400);
  if (!box) return { s: s0, x: safe.x + (safe.w - 720 * s0) / 2, y: safe.y + (safe.h - 400 * s0) / 2 };
  const pad = 30;
  const b = { x: box.x - pad, y: box.y - pad, w: box.w + 2 * pad, h: box.h + 2 * pad };
  const s = clamp(Math.min(safe.w / b.w, safe.h / b.h), s0, s0 * maxZoom);
  const bw = 720 * s;
  const bh = 400 * s;
  let x = safe.x + safe.w / 2 - s * (b.x + b.w / 2);
  let y = safe.y + safe.h / 2 - s * (b.y + b.h / 2);
  x = bw >= safe.w ? clamp(x, safe.x + safe.w - bw, safe.x) : safe.x + (safe.w - bw) / 2;
  y = bh >= safe.h ? clamp(y, safe.y + safe.h - bh, safe.y) : safe.y + (safe.h - bh) / 2;
  return { s, x, y };
}

function useReducedMotion() {
  const [rm, setRm] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setRm(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);
  return rm;
}

export type StageCoach = { text: string; head: string; onDone: () => void } | null;

type Props = {
  scenario: Scenario;
  started: boolean;
  done: boolean;
  cursor: number;
  choices: Choice[];
  /** 0 = the hour not yet begun; 1…n = slip n on the stage; n+1 = the call. */
  at: number;
  setAt: (at: number) => void;
  /** When the console clock lands on this hour (performance.now() ms), while
   *  the advance beat is still rolling; null once it has landed or was cut. */
  clockLandsAt: number | null;
  coach: StageCoach;
  onStart: () => void;
  onChoose: (o: Option) => void;
  onAdvance: () => void;
  onDebrief: () => void;
  /* The log's own pieces, for the sheet: nothing is re-typeset here. */
  renderSlip: (info: InfoItem, t: Timestep) => React.ReactNode;
  renderRecord: (t: Timestep, choice: Choice) => React.ReactNode;
  renderBriefing: () => React.ReactNode;
  renderCredit: (m: MediaAttachment) => React.ReactNode;
  /** Which viewport draws the stage: the hand-drawn board or the diorama. */
  renderer: 'board' | 'diorama';
  boot: 'full' | 'quick' | null;
  onRendererFail: (why: string) => void;
  /** A one-line status over the stage (the diorama's fallback notice). */
  notice: string | null;
};

export default function PictureStage(p: Props) {
  const { scenario, started, done, cursor, choices, at, setAt, clockLandsAt, coach } = p;
  const rm = useReducedMotion();
  const vocab = vocabFor(scenario);
  const steps = scenario.timesteps;
  const t = steps[cursor];
  const items = t.info_available;
  const n = items.length;
  const choice = started ? choices[cursor] : undefined;
  const phase: Phase = !started ? 'brief' : done ? 'done' : choice ? 'record' : at > n ? 'call' : 'beats';
  const cut = phase === 'beats' ? at : n;
  const activeIdx = phase === 'beats' && at >= 1 ? at - 1 : -1;
  const active = activeIdx >= 0 ? items[activeIdx] : null;
  const allZones = scenario.scoring.at_risk_zones.map((z) => z.id);
  const zoneLabel = (z: string) => scenario.scoring.at_risk_zones.find((x) => x.id === z)?.label ?? z;
  const srcN = useMemo(() => new Map(scenario.sources.map((s, i) => [s.id, i + 1])), [scenario]);

  // ── What the board and the chain show at this beat ──────────────────────
  const shownIndex = started ? cursor : -1;
  const board = useMemo(() => deriveBoard(scenario, shownIndex, choices, phase === 'beats' ? cut : undefined),
    [scenario, shownIndex, choices, phase, cut]);
  const fresh = useMemo(() => {
    if (!active) return NO_FRESH;
    const a = deriveBoard(scenario, cursor, [], activeIdx);
    const b = deriveBoard(scenario, cursor, [], activeIdx + 1);
    return {
      zones: Object.keys(b.zoneStates).filter((z) => b.zoneStates[z] !== a.zoneStates[z]),
      origins: Object.keys(b.origins).filter((z) => !a.origins[z]),
      wind: !!b.wind && !a.wind,
    };
  }, [scenario, cursor, active, activeIdx]);
  const chain = useMemo(() => deriveChain(scenario, shownIndex, phase === 'beats' ? cut : undefined), [scenario, shownIndex, phase, cut]);
  const chainFresh = useMemo(() => (active ? chainChangesAt(scenario, cursor, activeIdx) : NONE), [scenario, cursor, active, activeIdx]);
  const warnedNow = useMemo(() => (choice ? warnedBy(scenario, choice.option) : []), [scenario, choice]);
  const [preview, setPreview] = useState<string[] | null>(null);
  useEffect(() => setPreview(null), [phase, cursor]);

  // ── Measuring: the view, what the stage reserves, and each zone's box ───
  const viewRef = useRef<HTMLDivElement>(null);
  const trayRef = useRef<HTMLDivElement>(null);
  const footRef = useRef<HTMLDivElement>(null);
  const [safe, setSafe] = useState<Rect | null>(null);
  const [tray, setTray] = useState<Tray | null>(null);
  useLayoutEffect(() => {
    const v = viewRef.current;
    if (!v) return;
    const measure = () => {
      const vr = v.getBoundingClientRect();
      const tr = trayRef.current?.getBoundingClientRect();
      const fr = footRef.current?.getBoundingClientRect();
      let x = 0;
      let y = 0;
      let w = vr.width;
      let h = vr.height;
      let side: 'left' | 'top' = 'top';
      let edge = 0;
      if (tr && tr.width > 0) {
        if (tr.height >= vr.height * 0.6) { side = 'left'; edge = tr.right - vr.left; x = edge; w -= edge; } else { edge = tr.bottom - vr.top; y = edge; h -= edge; }
      }
      if (fr) h = Math.max(120, fr.top - vr.top - y);
      setSafe((o) => (o && o.x === x && o.y === y && o.w === w && o.h === h ? o : { x, y, w, h }));
      setTray((o) => (o && o.side === side && o.edge === edge ? o : { side, edge }));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(v);
    if (footRef.current) ro.observe(footRef.current);
    if (trayRef.current) ro.observe(trayRef.current);
    return () => ro.disconnect();
  }, [phase]);

  // ── Where the camera looks: an intent, in zones ─────────────────────────
  const strict = (zs: string[]) => zs.length > 0 && zs.length < allZones.length;
  const intent: StageIntent = (() => {
    if (phase === 'brief') return { shot: 'establish', zones: [] };
    if (phase === 'done') return { shot: 'end', zones: [] };
    if (phase === 'beats' && active && !active.media) {
      // The beat the record first places the hazard: the mark, in its zone.
      const o = fresh.origins[0];
      if (o) return { shot: 'origin', zones: [o] };
      if (active.zones && strict(active.zones)) return { shot: 'slip', zones: active.zones };
      return { shot: 'wide', zones: [] };
    }
    if (phase === 'call') {
      const sets = t.options.map((o) => warnedBy(scenario, o));
      const all = Array.from(new Set(sets.flat()));
      return { shot: 'call', zones: sets.some((x) => x.length === allZones.length) || !strict(all) ? [] : all };
    }
    if (phase === 'record') return { shot: 'record', zones: strict(warnedNow) ? warnedNow : [] };
    return { shot: 'wide', zones: [] };
  })();
  // Keep the object stable while the shot is the same, so a viewport can
  // treat a new intent as a new camera move.
  const intentKey = `${intent.shot}:${intent.zones.join(',')}`;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const stableIntent = useMemo(() => intent, [intentKey]);

  // ── Time: the hour's beats, on their own or a press at a time ───────────
  const [playing, setPlaying] = useState(true);
  const [sheet, setSheet] = useState<null | { kind: 'slip'; info: InfoItem } | { kind: 'record' } | { kind: 'brief' }>(null);
  const held = !!sheet || !!coach;
  const lands = useRef(clockLandsAt);
  lands.current = clockLandsAt;
  useEffect(() => {
    if (phase !== 'beats' || held) return;
    // The hour's first slip lands a breath after the console clock does,
    // even for reduced motion (nothing would be on the stage otherwise).
    if (at === 0) {
      const wait = rm ? 0 : Math.max(0, (lands.current ?? 0) - performance.now()) + 320;
      const id = window.setTimeout(() => setAt(1), wait);
      return () => window.clearTimeout(id);
    }
    if (rm || !playing) return;
    const id = window.setTimeout(() => setAt(at + 1), beatMs(items[at - 1]));
    return () => window.clearTimeout(id);
  }, [phase, at, held, playing, rm, items, setAt]);

  // Each slip's lower third types with the teleprinter's tick (when sound is on).
  useEffect(() => {
    if (!active || rm) return;
    if (active.media) { sound.detent(); return; }
    const chars = (active.headline ?? '').length;
    sound.teletype(0, Math.ceil(typeMs(chars) / TICK_SPACING), TICK_SPACING);
  }, [active, rm]);
  // The call going out: one relay clunk as the dispatch lines leave the desk.
  const lastChoice = useRef(choice);
  useEffect(() => {
    if (choice && choice !== lastChoice.current && !rm) sound.clunk();
    lastChoice.current = choice;
  }, [choice, rm]);

  const skipToCall = () => { sound.hush(); setAt(n + 1); };
  const nextBeat = () => { sound.hush(); setAt(Math.min(n + 1, at + 1)); };

  // ── The pieces ──────────────────────────────────────────────────────────
  const hourItems = phase === 'brief' || phase === 'done' ? [] : items.slice(0, cut);
  const zoned: { info: InfoItem; idx: number; z: string; k: number }[] = [];
  const perZone: Record<string, number> = {};
  const unzoned: { info: InfoItem; idx: number }[] = [];
  hourItems.forEach((info, idx) => {
    if (info.zones?.length) {
      for (const z of info.zones) {
        const k = perZone[z] ?? 0;
        perZone[z] = k + 1;
        zoned.push({ info, idx, z, k });
      }
    } else unzoned.push({ info, idx });
  });
  const glyph = (info: InfoItem, size: number) => <GlyphFor glyph={glyphKey(info)} size={size} />;
  const markOf = (idx: number): Stamp['state'] => (idx === activeIdx ? 'active' : phase === 'beats' ? 'past' : 'set');
  const mark = (idx: number) => ` is-${markOf(idx)}`;
  const stamps: Stamp[] = useMemo(() => zoned.map(({ info, idx, z, k }) => ({
    key: `${info.id}-${z}`, z, k, n: perZone[z], glyph: glyphKey(info), state: markOf(idx),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  })), [zoned.map((x) => `${x.info.id}${x.z}${markOf(x.idx)}`).join('|')]);
  const spot = active?.zones ?? undefined;
  const viewport: ViewportProps = {
    scenario, phase, cursor, beat: `${phase}:${cursor}:${at}`, rm, playing, board, fresh, preview, warnedNow, spot,
    intent: stableIntent, stamps, safe, tray, boot: p.boot, onFail: p.onRendererFail,
  };

  const deskName = scenario.warning_chain?.labels?.desk ?? 'Your desk';
  const slug = phase === 'brief'
    ? `${scenario.date} · Briefing`
    : phase === 'done'
      ? 'End of record'
      : `${stamp(t)} ${tzLabel(scenario)} · Decision ${cursor + 1} of ${steps.length}`;
  const cite = (info: InfoItem) => srcN.get(info.citation.sourceId);
  const figure = active?.media && active.media.type === 'image' ? active.media : null;

  return (
    <section id="cr-stage" className={`cr-stage is-${phase}${rm ? ' is-still' : ''} is-${p.renderer}`} aria-labelledby="cr-pic-h"
      style={{ '--cam-ms': `${CAM_MS}ms` } as React.CSSProperties}>
      {p.notice && <p className="cr-stage-notice" role="status">{p.notice}</p>}
      {/* Every picture in here is aria-hidden on its own (the transcript tells
          the story); only a viewport's own controls, if it has any, are not. */}
      <div ref={viewRef} className="cr-stage-view">
        {p.renderer === 'diorama' ? <Diorama {...viewport} /> : <BoardViewport {...viewport} />}

        {figure && (
          <div key={active!.id} className="cr-pplate" aria-hidden style={safe ? { left: safe.x, top: safe.y, width: safe.w, height: safe.h } : undefined}>
            {/* eslint-disable-next-line @next/next/no-img-element -- served byte-for-byte as licence-vetted, not re-encoded */}
            <img src={`/control-room/${scenario.id}/${figure.file}`} alt="" width={figure.width} height={figure.height} />
          </div>
        )}

        {active?.readings && !figure && (
          <div key={active.id} className="cr-preads" aria-hidden
            style={safe ? { left: safe.x + 12, top: safe.y + 12, maxWidth: Math.min(440, safe.w - 24) } : undefined}>
            <Readings scenario={scenario} itemId={active.id} readings={active.readings} />
          </div>
        )}

        {phase === 'done' && (
          <div className="cr-endcard" aria-hidden>
            <span className="cr-endcard-band">
              <span className="cr-endcard-title">End of record</span>
              <span className="cr-endcard-sub">{scenario.clock.end} {tzLabel(scenario)} · {inWords(choices.length).toLowerCase()} calls logged · the debrief follows</span>
            </span>
          </div>
        )}

        <div key={`chain-${cursor}-${at}`} aria-hidden className={`cr-pchain${chainFresh.size ? ' is-pulse' : ''}`}
          style={safe ? { right: 12, bottom: `calc(100% - ${safe.y + safe.h - 12}px)` } : undefined}>
          <WarningChain scenario={scenario} snapshot={chain} fresh={chainFresh} compact />
        </div>
      </div>

      {/* The desk margin: slips that name no zone land here, and your orders leave from it. */}
      <div ref={trayRef} className="cr-tray" aria-hidden>
        <span className="cr-tray-name">{deskName}</span>
        <span className="cr-tray-marks">
          {unzoned.map(({ info, idx }) => (
            <span key={info.id} className={`cr-tray-mark${mark(idx)}`}>{glyph(info, 22)}</span>
          ))}
        </span>
      </div>

      {coach && (
        <aside id="cr-coach" className="cr-coach cr-coach-stage is-up" aria-labelledby="cr-coach-h">
          <p id="cr-coach-h" className="cr-coach-head">{coach.head}</p>
          <p className="cr-coach-text">{coach.text}</p>
          <div className="cr-coach-actions">
            <button type="button" id="cr-coach-next" className="cr-coach-next" onClick={coach.onDone}>
              Play the hour <span aria-hidden>→</span>
            </button>
          </div>
        </aside>
      )}

      <div ref={footRef} className="cr-foot">
        <h3 id="cr-pic-h" className="cr-foot-slug" tabIndex={-1}>
          {slug}
          {phase === 'beats' && at >= 1 && <span className="cr-foot-count"> · Slip {at} of {n}</span>}
        </h3>

        {phase === 'brief' && (
          <div className="cr-ptitle">
            <p className="cr-level" aria-hidden>
              <span>Day one of one</span><span>{scenario.location.split(',')[0]}</span><span>{scenario.clock.start} {tzLabel(scenario)}</span>
            </p>
            <p className="cr-ptitle-name">{scenario.title}</p>
            <p className="cr-ptitle-loc">{scenario.location}. You hold the {vocab.desk}: you see only what officials could
              see at each moment. History does not branch here.</p>
            <div className="cr-foot-actions">
              <button type="button" className="cr-btn-primary" onClick={p.onStart}>Take the desk — {scenario.clock.start}</button>
              <button type="button" className="cr-pbtn" onClick={() => setSheet({ kind: 'brief' })} aria-haspopup="dialog">Read the briefing</button>
            </div>
          </div>
        )}

        {phase === 'beats' && (
          <>
            {active ? (
              <div key={active.id} className={`cr-third cr-dbox${figure ? ' is-figure' : ''}`}
                style={{ '--ch': (active.headline ?? '').length, '--type': `${typeMs((active.headline ?? '').length)}ms` } as React.CSSProperties}>
                <span className="cr-portrait" aria-hidden><Portrait kind={active.kind} /></span>
                <div className="cr-dbox-body">
                  <span className="cr-nameplate" aria-hidden>{speakerFor(scenario, active)}</span>
                  <button type="button" className="cr-third-main" onClick={() => setSheet({ kind: 'slip', info: active })}
                    aria-haspopup="dialog" aria-label={`Read the full slip, ${stamp(t)}: ${active.headline ?? active.text}`}>
                    <span className="cr-third-kind" aria-hidden>
                      <KindGlyph kind={active.kind} size={14} /> {vocab.kindLabel[active.kind]}
                      {!active.zones?.length && <> · {deskName}</>}
                      {active.zones?.length && strict(active.zones) ? <> · {active.zones.map(zoneLabel).join(' · ')}</> : null}
                    </span>
                    <span className="cr-third-line" aria-hidden>
                      <span className="cr-third-time">{stamp(t)}</span>
                      <span className="cr-third-sep"> · </span>
                      <span className="cr-third-head">{active.headline ?? active.text}</span>
                      {cite(active) && <span className="cr-third-cite"> [{cite(active)}]</span>}
                    </span>
                    <span className="cr-third-more" aria-hidden>Full slip <span className="cr-third-plus">+</span></span>
                  </button>
                  {/* The classic text box's advance mark; for reduced motion the
                      worded Next slip button below does the same, and nothing blinks. */}
                  {!rm && (
                    <button type="button" className="cr-dbox-next" onClick={nextBeat}
                      aria-label={at >= n ? 'To the call' : 'Next slip'}>
                      <span aria-hidden>▸</span>
                    </button>
                  )}
                </div>
                {figure && (
                  <div className="cr-third-cap">
                    <span className="cr-third-capt">{figure.caption}</span>
                    {p.renderCredit(figure)}
                  </div>
                )}
              </div>
            ) : (
              <div className="cr-third is-waiting" aria-hidden><span className="cr-third-line">{stamp(t)} · Incoming</span></div>
            )}
            <div className="cr-ctrl" role="group" aria-label="Playback">
              {!rm && (
                <button type="button" className="cr-pbtn" aria-pressed={!playing} onClick={() => setPlaying(!playing)}>
                  {playing ? <><PauseGlyph /> Pause</> : <><PlayGlyph /> Play</>}
                </button>
              )}
              {rm && (
                <button type="button" className="cr-pbtn" onClick={nextBeat}>
                  {at >= n ? 'To the call' : 'Next slip'} <span aria-hidden>→</span>
                </button>
              )}
              <button type="button" className="cr-pbtn" onClick={skipToCall}>Skip to the call <span aria-hidden>⇥</span></button>
              <span className="cr-ticks" aria-hidden>
                {items.map((it, i) => <i key={it.id} className={i < at ? (i === at - 1 ? 'is-now' : 'is-done') : ''} />)}
              </span>
            </div>
          </>
        )}

        {phase === 'call' && (
          <div className="cr-pcall cr-dbox" role="group" aria-labelledby="cr-pcall-h">
            <span className="cr-portrait" aria-hidden><Portrait kind="message" /></span>
            <div className="cr-dbox-body">
            <p id="cr-pcall-h" className="cr-nameplate cr-pcall-head">Your call · {stamp(t)} · {deskName}</p>
            <div className="cr-pcards" onKeyDown={(e) => {
              // A choice list: up and down move between the options, Enter takes one.
              if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
              const btns = Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>('.cr-pcard-btn'));
              const i = btns.indexOf(document.activeElement as HTMLButtonElement);
              const next = btns[(i + (e.key === 'ArrowDown' ? 1 : -1) + btns.length) % btns.length];
              next?.focus();
              e.preventDefault();
            }}>
              {t.options.map((o) => <CallCard key={o.id} o={o} onChoose={p.onChoose}
                onPreview={(on) => setPreview(on ? warnedBy(scenario, o) : null)} />)}
            </div>
            </div>
            <div className="cr-ctrl">
              <button type="button" className="cr-pbtn" onClick={() => setAt(1)}>Replay the hour <span aria-hidden>↺</span></button>
            </div>
          </div>
        )}

        {phase === 'record' && choice && (
          <div className="cr-precord cr-dbox">
            <span className="cr-portrait" aria-hidden><Portrait kind="message" /></span>
            <div className="cr-dbox-body">
            <span className="cr-nameplate" aria-hidden>{deskName} · your call</span>
            <p className="cr-precord-call">
              <span className="cr-precord-tag">Your call · {stamp(t)}</span>
              <span className="cr-precord-label">{choice.option.label}</span>
              {warnedNow.length > 0 && (
                <span className="cr-precord-warned">Marked warned by you · {warnedNow.length === allZones.length ? 'every zone' : warnedNow.map(zoneLabel).join(' · ')}</span>
              )}
            </p>
            {choice.option.consequence.known ? (
              <button type="button" className="cr-precord-rec" onClick={() => setSheet({ kind: 'record' })} aria-haspopup="dialog">
                <span className="cr-precord-tag">The record</span>
                <span className="cr-precord-text">{choice.option.consequence.text}
                  {srcN.get(choice.option.consequence.citation.sourceId) && <> [{srcN.get(choice.option.consequence.citation.sourceId)}]</>}</span>
                <span className="cr-third-more" aria-hidden>Read in full <span className="cr-third-plus">+</span></span>
              </button>
            ) : (
              <button type="button" className="cr-precord-rec is-silent" onClick={() => setSheet({ kind: 'record' })} aria-haspopup="dialog">
                <SilentGlyph size={28} className="cr-silent-glyph" />
                <span className="cr-precord-tag">The record is silent</span>
                <span className="cr-precord-text">No one took this path on the day, so no source can say what it would have changed.</span>
              </button>
            )}
            <div className="cr-foot-actions">
              <button type="button" id="cr-advance-btn" className="cr-btn-primary" onClick={p.onAdvance}>
                {cursor >= steps.length - 1 ? 'Close the log — to the debrief' : 'Advance the clock'}
                <span className="cr-btn-arrow" aria-hidden>↓</span>
              </button>
              <span className="cr-precord-note">Decision {cursor + 1} of {steps.length} logged</span>
            </div>
            </div>
          </div>
        )}

        {phase === 'done' && (
          <div className="cr-foot-actions">
            <button type="button" className="cr-btn-primary" onClick={p.onDebrief}>To the debrief <span className="cr-btn-arrow" aria-hidden>↓</span></button>
            <span className="cr-precord-note">{scenario.clock.end} {tzLabel(scenario)} · the log closes on the debrief, set as text</span>
          </div>
        )}
      </div>

      <Sheet open={!!sheet} onClose={() => setSheet(null)} id="cr-psheet-title" className="cr-psheet"
        title={sheet?.kind === 'slip' ? `Slip · ${stamp(t)}` : sheet?.kind === 'record' ? `Your call · ${stamp(t)}` : 'Briefing'}>
        {sheet?.kind === 'slip' && p.renderSlip(sheet.info, t)}
        {sheet?.kind === 'record' && choice && p.renderRecord(t, choice)}
        {sheet?.kind === 'brief' && p.renderBriefing()}
      </Sheet>
    </section>
  );
}

/* ── The board viewport: the hand-drawn plate under a 2D camera ─────────── */

function BoardViewport({ scenario, phase, board, fresh, preview, warnedNow, spot, intent, stamps, safe, tray }: ViewportProps) {
  const camRef = useRef<HTMLDivElement>(null);
  const [boxes, setBoxes] = useState<Record<string, Box>>({});
  useLayoutEffect(() => {
    const out: Record<string, Box> = {};
    camRef.current?.querySelectorAll<SVGGraphicsElement>('.cr-zone-shape[data-zone]').forEach((el) => {
      const b = el.getBBox();
      out[el.dataset.zone as string] = { x: b.x, y: b.y, w: b.width, h: b.height };
    });
    setBoxes(out);
  }, [scenario.id]);
  const center = (z: string): [number, number] | null => {
    const b = boxes[z];
    return b ? [b.x + b.w / 2, b.y + b.h / 2] : null;
  };
  // Stamps sit low in their zone, clear of the zone's name and state at its head.
  const seat = (z: string): [number, number] | null => {
    const b = boxes[z];
    return b ? [b.x + b.w / 2, b.y + b.h * 0.7] : null;
  };
  const zonesBox = (zs: string[]) => union(zs.map((z) => boxes[z]).filter(Boolean));
  const target: Box | null = (() => {
    if (intent.shot === 'origin') {
      const o = intent.zones[0];
      const pt = originPoint(scenario.id, o);
      if (pt) return union([{ x: pt[0] - 70, y: pt[1] - 50, w: 140, h: 100 }, ...(boxes[o] ? [boxes[o]] : [])]);
      return zonesBox(intent.zones);
    }
    return intent.zones.length ? zonesBox(intent.zones) : null;
  })();
  const phone = !!tray && tray.side === 'top';
  const frame = safe ? frameFor(target, safe, phone ? 2.6 : 2.2) : null;
  // The desk's anchor for the dispatch lines, in plate units (the tray's
  // inner edge, where the order leaves from), under the camera's target.
  const anchor: [number, number] | null = frame && tray && safe
    ? tray.side === 'left'
      ? [(tray.edge - frame.x) / frame.s, (safe.y + safe.h / 2 - frame.y) / frame.s]
      : [(safe.x + safe.w * 0.18 - frame.x) / frame.s, (tray.edge - frame.y) / frame.s]
    : null;
  return (
    <div ref={camRef} className={`cr-cam${frame ? '' : ' is-unmeasured'}`} aria-hidden
      style={frame ? { transform: `translate(${frame.x}px, ${frame.y}px) scale(${frame.s})` } : undefined}>
      <OpsMap scenario={scenario} zoneStates={board.zoneStates} warnedZones={board.warnedZones}
        origins={board.origins} wind={board.wind} fresh={fresh} bare
        preview={preview ?? undefined}
        freshWarned={phase === 'record' ? warnedNow : undefined}
        spot={spot} />
      {/* The camera's scale rides here, on the stamps' own layer, so its
          per-frame restyle touches a handful of chits, not the board. */}
      <div className="cr-stamps" style={frame ? { '--s': frame.s } as React.CSSProperties : undefined}>
        {stamps.map((m) => {
          const c = seat(m.z);
          if (!c) return null;
          return (
            <span key={m.key} className={`cr-pmark is-${m.state}`}
              style={{ left: `${c[0]}px`, top: `${c[1]}px`, '--off': m.k - (m.n - 1) / 2 } as React.CSSProperties}>
              <span className="cr-pmark-face"><GlyphFor glyph={m.glyph} size={26} /></span>
            </span>
          );
        })}
      </div>
      {phase === 'record' && anchor && warnedNow.length > 0 && (
        <svg className="cr-dispatch" viewBox="0 0 720 400" width="720" height="400">
          {warnedNow.map((z, i) => {
            const c = center(z);
            if (!c) return null;
            const [ax, ay] = anchor;
            const mx = (ax + c[0]) / 2;
            const my = Math.min(ay, c[1]) - 40;
            const sw = 2.6 / (frame?.s ?? 1);
            return (
              <g key={z} style={{ '--i': i } as React.CSSProperties}>
                <path className="cr-dispatch-line" d={`M${ax} ${ay}Q${mx} ${my} ${c[0]} ${c[1]}`} pathLength={1} style={{ strokeWidth: sw }} />
                <circle className="cr-dispatch-hit" cx={c[0]} cy={c[1]} r={9 / (frame?.s ?? 1)} style={{ strokeWidth: sw }} />
              </g>
            );
          })}
        </svg>
      )}
    </div>
  );
}

/** One option as a card: the same button and label as the log's, set large;
 *  where the option carries more words, they fold out beside it. */
function CallCard({ o, onChoose, onPreview }: { o: Option; onChoose: (o: Option) => void; onPreview: (on: boolean) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="cr-pcard" onMouseEnter={() => onPreview(true)} onMouseLeave={() => onPreview(false)}>
      <button type="button" className="cr-option cr-pcard-btn" onClick={() => onChoose(o)}
        onFocus={() => { sound.keyTick(); onPreview(true); }} onBlur={() => onPreview(false)}>
        <span className="cr-option-label">{o.label}</span>
        {o.detail && open && <span className="cr-option-detail">{o.detail}</span>}
      </button>
      {o.detail && (
        <button type="button" className="cr-pcard-more" aria-expanded={open} onClick={() => setOpen(!open)}>
          {open ? 'Less' : 'Full text'}
        </button>
      )}
    </div>
  );
}

const PauseGlyph = () => (
  <svg viewBox="0 0 12 12" width="11" height="11" aria-hidden focusable="false"><path d="M2 1h3v10H2zM7 1h3v10H7z" fill="currentColor" /></svg>
);
const PlayGlyph = () => (
  <svg viewBox="0 0 12 12" width="11" height="11" aria-hidden focusable="false"><path d="M2 1l9 5-9 5z" fill="currentColor" /></svg>
);
