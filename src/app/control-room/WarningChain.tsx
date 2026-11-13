'use client';

/**
 * The warning chain: forecast office → your desk → the public channels
 * (sirens, the phone alert, radio and TV, posts) → the people in each
 * at-risk zone. It is the board's discipline applied to the last mile:
 * nothing lights until a cited item the player has already been shown says
 * that link carried a warning (`chain` on the item, gated by the build), and
 * a channel is drawn severed only where a cited item says it was cut or not
 * used. A link the record has not mentioned stays a faint hairline: not
 * "broken", simply not on the record yet.
 *
 * The diagram is decorative (aria-hidden); the list under it says the same
 * in words, entry by entry, with each time as the cited text gives it.
 */
import { useId } from 'react';
import type { ChainLink, ChainState, Scenario } from './types';
import { Pictogram } from './glyphs';

type Channel = Exclude<ChainLink, 'forecast'>;
const CHANNELS: Channel[] = ['siren', 'phone', 'broadcast', 'social'];
const CHANNEL_GLYPH: Record<Channel, string> = { siren: 'siren', phone: 'wea', broadcast: 'press', social: 'social' };
const DEFAULT_LABELS: Record<'desk' | ChainLink, string> = {
  forecast: 'Forecast office', desk: 'Your desk', siren: 'Sirens', phone: 'Phone alert',
  broadcast: 'Radio · TV', social: 'Posts',
};
/** What "used" is called on each link — the verb the channel takes. */
const USED_WORD: Record<ChainLink, string> = {
  forecast: 'received', siren: 'sounded', phone: 'sent', broadcast: 'aired', social: 'posted',
};
const stateWord = (link: ChainLink, s: ChainState) =>
  s === 'used' ? USED_WORD[link] : s === 'cut' ? 'cut' : s === 'unused' ? 'not used' : 'drafting';

/** One cited statement about a link, as the player met it. */
type Seen = { state: ChainState; at?: string; by: string; zones: string[] };

export type ChainSnapshot = {
  forecast: Seen[];
  channels: Record<Channel, Seen[]>;
  /** Per channel, per zone: the latest used / cut statement. */
  reach: Record<Channel, Record<string, Seen>>;
};

const stampOf = (t: Scenario['timesteps'][number]) => `${t.approx ? '≈' : ''}${t.time}`;

/** The chain as the cited items up to and including decision `uptoIndex` show
 *  it — or, with `uptoItem`, only that decision's first `uptoItem` items
 *  (picture mode plays an hour's slips one beat at a time). */
export function deriveChain(scenario: Scenario, uptoIndex: number, uptoItem?: number): ChainSnapshot {
  const allZones = scenario.scoring.at_risk_zones.map((z) => z.id);
  const snap: ChainSnapshot = {
    forecast: [],
    channels: { siren: [], phone: [], broadcast: [], social: [] },
    reach: { siren: {}, phone: {}, broadcast: {}, social: {} },
  };
  scenario.timesteps.slice(0, uptoIndex + 1).forEach((t, ti) => {
    const items = ti === uptoIndex && uptoItem !== undefined ? t.info_available.slice(0, uptoItem) : t.info_available;
    for (const info of items) {
      for (const c of info.chain ?? []) {
        const seen: Seen = { state: c.state, at: c.at, by: stampOf(t), zones: c.zones ?? info.zones ?? allZones };
        if (c.link === 'forecast') { snap.forecast.push(seen); continue; }
        snap.channels[c.link].push(seen);
        if (c.state === 'used' || c.state === 'cut') for (const z of seen.zones) snap.reach[c.link][z] = seen;
      }
    }
  });
  return snap;
}

const last = <T,>(a: T[]) => a[a.length - 1];

/** How the desk → channel link is drawn, from the channel's latest statement. */
function deskEdge(seen: Seen[]): 'none' | 'solid' | 'severed' | 'pending' {
  const l = last(seen);
  if (!l) return 'none';
  if (l.state === 'unused') return 'severed';
  if (l.state === 'pending') return 'pending';
  return 'solid';
}

/** Keys of everything drawn, with its look — so two snapshots can be diffed
 *  to find what this hour's traffic changed. */
function looks(s: ChainSnapshot): Map<string, string> {
  const m = new Map<string, string>();
  if (s.forecast.length) m.set('forecast', 'solid');
  for (const c of CHANNELS) {
    const e = deskEdge(s.channels[c]);
    if (e !== 'none') m.set(`desk-${c}`, e);
    for (const [z, seen] of Object.entries(s.reach[c])) m.set(`${c}-${z}`, seen.state);
  }
  return m;
}

export function chainChanges(scenario: Scenario, index: number): Set<string> {
  const before = looks(deriveChain(scenario, index - 1));
  const after = looks(deriveChain(scenario, index));
  const fresh = new Set<string>();
  after.forEach((v, k) => { if (before.get(k) !== v) fresh.add(k); });
  return fresh;
}

/** What one slip (decision `index`, item `item`) changed on the chain. */
export function chainChangesAt(scenario: Scenario, index: number, item: number): Set<string> {
  const before = looks(deriveChain(scenario, index, item));
  const after = looks(deriveChain(scenario, index, item + 1));
  const fresh = new Set<string>();
  after.forEach((v, k) => { if (before.get(k) !== v) fresh.add(k); });
  return fresh;
}

/** This hour's chain statements in words, for the log line. */
export function chainNews(scenario: Scenario, index: number) {
  const labels = { ...DEFAULT_LABELS, ...scenario.warning_chain?.labels };
  const t = scenario.timesteps[index];
  if (!t) return [];
  return t.info_available.flatMap((info) => (info.chain ?? []).map((c) => ({
    key: `${info.id}-${c.link}-${c.state}-${c.at ?? ''}`,
    what: c.link === 'forecast' ? `${labels.forecast} → ${labels.desk}` : labels[c.link],
    word: stateWord(c.link, c.state),
    at: c.at,
  })));
}

/* ── Geometry (plate units) ─────────────────────────────────────────────── */
const W = 360;
const H = 276;
const UP = { x: 100, y: 6, w: 160, h: 34 };
const DESK = { x: 100, y: 62, w: 160, h: 34 };
const CH_Y = 134;
const CH_H = 54;
const CH_W = 80;
const chX = (i: number) => 8 + i * (CH_W + 8);
const Z_Y = 230;
const Z_H = 26;

type P = { x1: number; y1: number; x2: number; y2: number };

/** A line, or a line broken at its middle with the draughtsman's two slashes. */
function Edge({ p, look, fresh }: { p: P; look: string; fresh: boolean }) {
  const cls = `cr-chain-edge is-${look}${fresh ? ' is-fresh' : ''}`;
  if (look !== 'severed' && look !== 'cut') {
    return <line className={cls} {...p} pathLength={look === 'solid' && fresh ? 1 : undefined} />;
  }
  const dx = p.x2 - p.x1;
  const dy = p.y2 - p.y1;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const mx = (p.x1 + p.x2) / 2;
  const my = (p.y1 + p.y2) / 2;
  const gap = 7;
  // The slashes cross the line at a steep angle, the same both sides.
  const sx = -uy * 6 + ux * 3;
  const sy = ux * 6 + uy * 3;
  const slash = (o: number) => ({
    x1: mx + ux * o - sx, y1: my + uy * o - sy, x2: mx + ux * o + sx, y2: my + uy * o + sy,
  });
  return (
    <g className={cls}>
      <line className="cr-chain-half" x1={p.x1} y1={p.y1} x2={mx - ux * gap} y2={my - uy * gap} />
      <line className="cr-chain-half" x1={mx + ux * gap} y1={my + uy * gap} x2={p.x2} y2={p.y2} />
      <line className="cr-chain-slash" {...slash(-3)} />
      <line className="cr-chain-slash" {...slash(3)} />
    </g>
  );
}

export default function WarningChain({ scenario, snapshot, fresh, compact = false }: {
  scenario: Scenario; snapshot: ChainSnapshot; fresh: Set<string>;
  /** Inline in the log on phones: the diagram only; the log line says it in words. */
  compact?: boolean;
}) {
  const arrow = `cr-chain-arrow-${useId().replace(/:/g, '')}`;
  const labels = { ...DEFAULT_LABELS, ...scenario.warning_chain?.labels };
  const zones = scenario.scoring.at_risk_zones.map((z) => ({
    id: z.id,
    label: scenario.warning_chain?.zones?.[z.id] ?? z.label.slice(0, 14),
  }));
  const zW = (W - 16 - (zones.length - 1) * 8) / zones.length;
  const zX = (i: number) => 8 + i * (zW + 8);
  const lastF = last(snapshot.forecast);

  return (
    <figure className={`cr-chain${compact ? ' is-compact' : ''}`}>
      <svg viewBox={`0 0 ${W} ${H}`} aria-hidden>
        <defs>
          <marker id={arrow} viewBox="0 0 8 8" refX="7" refY="4" markerUnits="userSpaceOnUse" markerWidth="9" markerHeight="9" orient="auto">
            <path d="M0 0L8 4L0 8z" className="cr-chain-arrowhead" />
          </marker>
        </defs>

        {/* Forecast office → desk */}
        <g className={`cr-chain-node${lastF ? ' is-lit' : ''}${fresh.has('forecast') ? ' is-fresh' : ''}`}>
          <rect x={UP.x} y={UP.y} width={UP.w} height={UP.h} />
          <text className="cr-chain-name" x={UP.x + UP.w / 2} y={UP.y + 15} textAnchor="middle">{labels.forecast.toUpperCase()}</text>
          <text className="cr-chain-state" x={UP.x + UP.w / 2} y={UP.y + 28} textAnchor="middle">
            {lastF ? `RECEIVED${lastF.at ? ` ${lastF.at}` : ''}` : 'NOTHING YET'}
          </text>
        </g>
        <line className={`cr-chain-edge is-${lastF ? 'solid' : 'none'}${fresh.has('forecast') ? ' is-fresh' : ''}`}
          x1={W / 2} y1={UP.y + UP.h} x2={W / 2} y2={DESK.y - 2} pathLength={fresh.has('forecast') ? 1 : undefined}
          markerEnd={lastF ? `url(#${arrow})` : undefined} />
        <g className="cr-chain-node is-desk">
          <rect x={DESK.x} y={DESK.y} width={DESK.w} height={DESK.h} />
          <text className="cr-chain-name" x={W / 2} y={DESK.y + 15} textAnchor="middle">{labels.desk.toUpperCase()}</text>
          <text className="cr-chain-state" x={W / 2} y={DESK.y + 28} textAnchor="middle">YOUR DESK</text>
        </g>

        {/* Desk → channels → zones */}
        {CHANNELS.map((c, i) => {
          const cx = chX(i) + CH_W / 2;
          const seen = snapshot.channels[c];
          const look = deskEdge(seen);
          const l = last(seen);
          return (
            <g key={c}>
              <Edge p={{ x1: W / 2, y1: DESK.y + DESK.h, x2: cx, y2: CH_Y }} look={look} fresh={fresh.has(`desk-${c}`)} />
              {zones.map((z, j) => {
                const r = snapshot.reach[c][z.id];
                if (!r) return null;
                return (
                  <Edge key={z.id} p={{ x1: cx, y1: CH_Y + CH_H, x2: zX(j) + zW / 2, y2: Z_Y }}
                    look={r.state === 'cut' ? 'cut' : 'solid'} fresh={fresh.has(`${c}-${z.id}`)} />
                );
              })}
              <g className={`cr-chain-node is-channel${l ? ` is-${l.state}` : ''}${fresh.has(`desk-${c}`) ? ' is-fresh' : ''}`}>
                <rect x={chX(i)} y={CH_Y} width={CH_W} height={CH_H} />
                <g transform={`translate(${cx - 10}, ${CH_Y + 6})`}>
                  <Pictogram name={CHANNEL_GLYPH[c]} size={20} className="cr-chain-glyph" />
                </g>
                <text className="cr-chain-name" x={cx} y={CH_Y + 38} textAnchor="middle">{labels[c].toUpperCase()}</text>
                <text className="cr-chain-state" x={cx} y={CH_Y + 49} textAnchor="middle">
                  {l ? `${stateWord(c, l.state).toUpperCase()}${l.at ? ` ${l.at}` : ''}` : '—'}
                </text>
              </g>
            </g>
          );
        })}

        <text className="cr-chain-public" x={W / 2} y={Z_Y + Z_H + 14} textAnchor="middle">THE PUBLIC, BY AT-RISK ZONE</text>
        {zones.map((z, j) => (
          <g key={z.id} className="cr-chain-node is-zone">
            <rect x={zX(j)} y={Z_Y} width={zW} height={Z_H} />
            <text className="cr-chain-name" x={zX(j) + zW / 2} y={Z_Y + 17} textAnchor="middle">{z.label.toUpperCase()}</text>
          </g>
        ))}
      </svg>
      {!compact && <ChainList scenario={scenario} snapshot={snapshot} labels={labels} zones={zones} />}
    </figure>
  );
}

/** The diagram in words: every cited statement per link, in the order met. */
function ChainList({ snapshot, labels, zones }: {
  scenario: Scenario; snapshot: ChainSnapshot; labels: Record<'desk' | ChainLink, string>;
  zones: { id: string; label: string }[];
}) {
  const zl = (ids: string[]) => (ids.length === zones.length ? 'all zones' : ids.map((id) => zones.find((z) => z.id === id)?.label ?? id).join(', '));
  const line = (link: ChainLink, s: Seen, withZones: boolean) =>
    `${stateWord(link, s.state)} ${s.at ?? `by ${s.by}`}${withZones && (s.state === 'used' || s.state === 'cut') ? ` (${zl(s.zones)})` : ''}`;
  return (
    <ul className="cr-chainlist">
      <li>
        <span className="cr-chainlist-link">{labels.forecast} → {labels.desk}</span>
        <span className="cr-chainlist-what">
          {snapshot.forecast.length ? snapshot.forecast.map((s) => line('forecast', s, false)).join(' · ') : 'nothing on the record yet'}
        </span>
      </li>
      {CHANNELS.map((c) => (
        <li key={c} className={snapshot.channels[c].length ? 'is-lit' : ''}>
          <span className="cr-chainlist-link">{labels[c]}</span>
          <span className="cr-chainlist-what">
            {snapshot.channels[c].length
              ? snapshot.channels[c].map((s) => line(c, s, true)).join(' · ')
              : 'not on the record yet'}
          </span>
        </li>
      ))}
    </ul>
  );
}
