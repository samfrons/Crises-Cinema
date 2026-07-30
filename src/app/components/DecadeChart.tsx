'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  FAMILIES, family, decadeLabel,
  type DecadeRow, type FamilyId, type Film,
} from '@/lib/taxonomy';

/* Geometry. The plot band is drawn as a strip of film: each decade is a frame,
   and the axis gutters carry sprocket perforations instead of tick marks. */
const AXIS_W = 46;
const PAD_R = 14;
const GUTTER = 13;
const TOTALS_H = 26;
const PLOT_H = 360;
const LABELS_H = 34;
const FRAME_W = 78;
const FRAME_GAP = 8;
const BAR_W = 50;

const PLOT_TOP = GUTTER + TOTALS_H;
const PLOT_BOTTOM = PLOT_TOP + PLOT_H;
const HEIGHT = PLOT_BOTTOM + GUTTER + LABELS_H;

export type Mode = 'count' | 'share';

interface Props {
  decades: DecadeRow[];
  active: Set<FamilyId>;
  mode: Mode;
  selected: number | null;
  onSelect: (decade: number) => void;
  /** Only used to name a few example films in the tooltip once loaded. */
  films: Film[] | null;
}

interface Hover {
  decade: number;
  fam: FamilyId | null;
  x: number;
  y: number;
}

export default function DecadeChart({ decades, active, mode, selected, onSelect, films }: Props) {
  const [hover, setHover] = useState<Hover | null>(null);
  /** The scrolling strip. */
  const strip = useRef<HTMLDivElement>(null);
  /** The non-scrolling frame around it — the tooltip's containing block, since
   *  an absolutely positioned child of the strip would be clipped by its
   *  overflow and would drift sideways as the strip scrolls. */
  const box = useRef<HTMLDivElement>(null);

  const shown = useMemo(() => FAMILIES.filter((f) => active.has(f.id)), [active]);

  const rows = useMemo(
    () => decades.map((d) => {
      const segs = shown
        .map((f) => ({ id: f.id, color: f.color, short: f.short, n: d.counts[f.id] ?? 0 }))
        .filter((s) => s.n > 0);
      return { ...d, segs, shownTotal: segs.reduce((s, x) => s + x.n, 0) };
    }),
    [decades, shown],
  );

  const max = Math.max(1, ...rows.map((r) => r.shownTotal));
  const width = AXIS_W + decades.length * (FRAME_W + FRAME_GAP) + PAD_R;
  const stripRight = width - PAD_R;

  const ticks = mode === 'share'
    ? [0, 25, 50, 75, 100]
    : niceTicks(max);
  const tickY = (v: number) =>
    PLOT_BOTTOM - (v / (mode === 'share' ? 100 : max)) * PLOT_H;

  const frameX = (i: number) => AXIS_W + i * (FRAME_W + FRAME_GAP);

  // Where the strip overflows — phones, mostly — open on the decade in focus.
  // Left-aligned, the reader's first sight of the chart is the empty 1890s.
  useEffect(() => {
    const el = strip.current;
    if (!el || el.scrollWidth <= el.clientWidth) return;
    const i = decades.findIndex((d) => d.decade === selected);
    if (i < 0) return;
    const centre = ((frameX(i) + FRAME_W / 2) / width) * el.scrollWidth;
    el.scrollLeft = centre - el.clientWidth / 2;
    // Mount only: re-running on every selection would yank the view sideways
    // while the reader is reading elsewhere.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function move(e: React.MouseEvent, decade: number, fam: FamilyId | null) {
    const r = box.current?.getBoundingClientRect();
    if (!r) return;
    setHover({ decade, fam, x: e.clientX - r.left, y: e.clientY - r.top });
  }

  const hoverRow = hover ? rows.find((r) => r.decade === hover.decade) : null;

  return (
    <div className="reel-wrap" ref={box} onMouseLeave={() => setHover(null)}>
      <div className="reel" ref={strip}>
      <svg
        viewBox={`0 0 ${width} ${HEIGHT}`}
        role="group"
        aria-label={`Disaster films by decade, ${decades[0].decade}s to ${decades[decades.length - 1].decade}s, split by category. The same figures are in the table below.`}
      >
        {/* Sprocket gutters — the film-strip edge, doubling as the axis rails. */}
        {[GUTTER / 2, PLOT_BOTTOM + GUTTER / 2].map((cy, gi) => (
          <g key={gi}>
            <rect
              x={AXIS_W - 6} y={cy - GUTTER / 2} width={stripRight - AXIS_W + 12} height={GUTTER}
              fill="var(--ink)" opacity="0.07"
            />
            {decades.map((d, i) => (
              <rect
                key={d.decade}
                x={frameX(i) + FRAME_W / 2 - 5} y={cy - 3.5}
                width={10} height={7} rx={1.5}
                fill="var(--paper)"
              />
            ))}
          </g>
        ))}

        {/* Selected frame, lit like the one under the projector gate. Drawn
            before the gridlines so they still read across it. */}
        {selected !== null && decades.some((d) => d.decade === selected) && (
          <rect
            x={frameX(decades.findIndex((d) => d.decade === selected))}
            y={PLOT_TOP - 20}
            width={FRAME_W}
            height={PLOT_H + 20}
            fill="var(--paper-lit)"
          />
        )}

        {/* Gridlines and value ticks */}
        {ticks.map((v) => (
          <g key={v}>
            <line
              x1={AXIS_W - 6} x2={stripRight + 6} y1={tickY(v)} y2={tickY(v)}
              stroke="var(--rule)" strokeWidth={v === 0 ? 1.25 : 0.75}
              opacity={v === 0 ? 1 : 0.6}
            />
            <text
              x={AXIS_W - 13} y={tickY(v) + 3.5} textAnchor="end"
              fontFamily="var(--data)" fontSize="10" fill="var(--ink-faint)"
              style={{ fontVariantNumeric: 'tabular-nums' }}
            >
              {mode === 'share' ? `${v}%` : v}
            </text>
          </g>
        ))}

        {rows.map((r, i) => {
          const x = frameX(i);
          const bx = x + (FRAME_W - BAR_W) / 2;
          const scale = mode === 'share'
            ? (r.shownTotal ? PLOT_H / r.shownTotal : 0)
            : PLOT_H / max;

          let cursor = PLOT_BOTTOM;
          const biggest = r.segs.reduce<{ id: FamilyId | null; n: number }>(
            (b, s) => (s.n > b.n ? { id: s.id, n: s.n } : b), { id: null, n: 0 },
          );

          return (
            <g
              key={r.decade}
              tabIndex={0}
              role="button"
              aria-label={
                `${decadeLabel(r.decade)}: ${r.shownTotal} film${r.shownTotal === 1 ? '' : 's'}` +
                (biggest.id ? `, mostly ${family(biggest.id).label}` : '') +
                '. Press Enter to explore this decade.'
              }
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(r.decade); }
              }}
              onFocus={() => setHover({ decade: r.decade, fam: null, x: x + FRAME_W / 2, y: PLOT_TOP })}
              onBlur={() => setHover(null)}
            >
              {/* Column hit area, so the whole frame is hoverable and clickable. */}
              <rect
                className="frame-hit"
                x={x} y={GUTTER} width={FRAME_W} height={PLOT_BOTTOM - GUTTER}
                fill="transparent"
                onMouseMove={(e) => move(e, r.decade, null)}
                onClick={() => onSelect(r.decade)}
              />

              {r.segs.map((s) => {
                const h = s.n * scale;
                cursor -= h;
                const inset = h > 4 ? 1 : 0;
                const label = s.id === biggest.id && h >= 26;
                return (
                  <g key={s.id}>
                    <rect
                      className="seg"
                      x={bx} y={cursor + inset}
                      width={BAR_W} height={Math.max(h - inset * 2, 0.8)}
                      rx={h > 6 ? 2.5 : 0}
                      fill={s.color}
                      opacity={hover && hover.fam && hover.fam !== s.id ? 0.42 : 1}
                      onMouseMove={(e) => move(e, r.decade, s.id)}
                      onClick={() => onSelect(r.decade)}
                    />
                    {label && (
                      <text
                        x={bx + BAR_W / 2} y={cursor + h / 2 + 3.5}
                        textAnchor="middle" pointerEvents="none"
                        fontFamily="var(--data)" fontSize="8.5"
                        letterSpacing="0.06em" fill="var(--paper-lit)"
                        opacity="0.94"
                      >
                        {s.short}
                      </text>
                    )}
                  </g>
                );
              })}

              {/* Count above the bar */}
              {r.shownTotal > 0 && (
                <text
                  x={x + FRAME_W / 2} y={PLOT_TOP - 9}
                  textAnchor="middle" pointerEvents="none"
                  fontFamily="var(--data)" fontSize="10.5"
                  fill="var(--ink-soft)"
                  style={{ fontVariantNumeric: 'tabular-nums' }}
                >
                  {r.shownTotal}
                </text>
              )}

              {/* Decade label, and a rule under the selected frame */}
              <text
                x={x + FRAME_W / 2} y={PLOT_BOTTOM + GUTTER + 21}
                textAnchor="middle" pointerEvents="none"
                fontFamily="var(--poster)"
                fontSize={selected === r.decade ? 20 : 17}
                fill={selected === r.decade ? 'var(--ember)' : 'var(--ink)'}
              >
                {decadeLabel(r.decade)}
              </text>
              {selected === r.decade && (
                <line
                  x1={x + 12} x2={x + FRAME_W - 12}
                  y1={PLOT_BOTTOM + GUTTER + 27} y2={PLOT_BOTTOM + GUTTER + 27}
                  stroke="var(--ember)" strokeWidth="2"
                />
              )}
            </g>
          );
        })}
      </svg>
      </div>

      {hover && hoverRow && (
        <Tip hover={hover} row={hoverRow} films={films} mode={mode} boxWidth={box.current?.clientWidth ?? 0} />
      )}

      <p className="reel-hint">Scroll the reel sideways →</p>
    </div>
  );
}

function Tip({
  hover, row, films, mode, boxWidth,
}: {
  hover: Hover;
  row: DecadeRow & { segs: { id: FamilyId; n: number }[]; shownTotal: number };
  films: Film[] | null;
  mode: Mode;
  boxWidth: number;
}) {
  const fam = hover.fam ? family(hover.fam) : null;
  const n = fam ? (row.counts[fam.id] ?? 0) : row.shownTotal;
  const share = row.shownTotal ? Math.round((n / row.shownTotal) * 100) : 0;

  const examples = useMemo(() => {
    if (!films) return [];
    return films
      .filter((f) => Math.floor(f.y / 10) * 10 === row.decade && (!fam || f.f === fam.id))
      .sort((a, b) => b.v - a.v)
      .slice(0, 4);
  }, [films, row.decade, fam]);

  // Flip the tooltip to the left of the cursor near the right edge.
  const flip = boxWidth > 0 && hover.x > boxWidth - 290;

  return (
    <div
      className="tip"
      style={{
        left: flip ? undefined : hover.x + 16,
        right: flip ? boxWidth - hover.x + 16 : undefined,
        top: Math.max(hover.y - 20, 4),
      }}
    >
      <div className="tip-h">
        {fam && <i style={{ background: fam.color }} />}
        {decadeLabel(row.decade)}{fam ? ` · ${fam.label}` : ''}
      </div>
      <div className="tip-n">
        {n} film{n === 1 ? '' : 's'}
        {fam && row.shownTotal > 0 && <span style={{ opacity: 0.66 }}> · {share}% of the decade</span>}
        {!fam && mode === 'share' && <span style={{ opacity: 0.66 }}> total</span>}
      </div>
      {examples.length > 0 && (
        <ul>
          {examples.map((f) => (
            <li key={`${f.t}${f.y}`}>{f.t} <span style={{ opacity: 0.6 }}>{f.y}</span></li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Round tick steps that land on 1/2/5 × a power of ten. */
function niceTicks(max: number): number[] {
  const raw = max / 5;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? mag * 10;
  const out: number[] = [];
  for (let v = 0; v <= max; v += step) out.push(Math.round(v));
  return out;
}
