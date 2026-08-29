'use client';

/*
 * The three plates of the dispatches page.
 *
 *   Plate 1 — the witness map: the atlas projection again, but the pins are
 *   Reddit posts instead of films, and the map has a clock — scrub or play
 *   the months and watch the record accumulate. Pins wear the ontology
 *   colour of the place's dominant family; ember stays the touched state.
 *
 *   Plate 2 — the evidence locker: a dark contact sheet of the most
 *   upvoted footage and imagery, filterable by family, every cell a link
 *   to the original post.
 *
 *   Plate 3 — the uptick: quarterly posting volume since 2012 across all
 *   watched subreddits, stacked by family. The chart the whole page is
 *   named for.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { FAMILIES, family, type FamilyId } from '@/lib/taxonomy';
import { monthLabel } from '@/lib/months';

/* ── Shapes of the snapshot ───────────────────────────────────────────── */

export interface DisPost {
  id: string;
  title: string;
  score: number;
  n: number;         // comments
  created: number;   // epoch seconds
  sub: string;
  family: string;
  place: string | null;
  kind: 'video' | 'image' | 'gallery' | 'link' | 'text';
  thumb: string | null;
  w: number;
  h: number;
  /** Reddit-hosted mp4 rendition, playable inline; absent on older snapshots. */
  clip?: string | null;
}

export interface DisPlace {
  id: string;
  label: string;
  lat: number;
  lon: number;
  total: number;
  families: Record<string, number>;
  months: Record<string, number>;
  top: string[];
}

export interface Dispatches {
  generated: string;
  indexAfter: string;
  historyAfter: string;
  totalIndexed: number;
  located: number;
  subs: { name: string; gloss: string; family: string; mixed: boolean; total: number }[];
  history: { sub: string; months: Record<string, number> }[];
  wire: { m: string; families: Record<string, number> }[];
  months: string[];
  peakMonth: { m: string; n: number } | null;
  places: DisPlace[];
  posts: DisPost[];
  land: { cols: number; rows: number; lon0: number; lat0: number; step: number; cells: number[] };
}

/* ── Small shared helpers ─────────────────────────────────────────────── */

const postMonth = (epoch: number) => new Date(epoch * 1000).toISOString().slice(0, 7);

const redditUrl = (p: DisPost) => `https://www.reddit.com/r/${p.sub}/comments/${p.id}/`;

const score = (n: number) => (n >= 10000 ? `${(n / 1000).toFixed(0)}k` : n >= 1000 ? `${(n / 1000).toFixed(1)}k` : `${n}`);

const dominantFamily = (families: Record<string, number>): FamilyId => {
  let best: string = 'unsorted';
  let bestN = -1;
  // Walk FAMILIES so ties break in fixed ontology order, not object order.
  for (const f of FAMILIES) {
    const n = families[f.id] ?? 0;
    if (n > bestN) { best = f.id; bestN = n; }
  }
  return best as FamilyId;
};

const KIND_BADGE: Record<DisPost['kind'], string | null> = {
  video: '▶ FOOTAGE',
  gallery: '⊞ GALLERY',
  image: '□ STILL',
  link: null,
  text: null,
};

/* ── Map geometry (same projection as the atlas) ──────────────────────── */

const MAP_W = 1000;

function useMapGeometry(land: Dispatches['land']) {
  return useMemo(() => {
    const cell = MAP_W / land.cols;
    const h = cell * land.rows;
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
    return { h, d, project };
  }, [land]);
}

/* ── Tooltip ──────────────────────────────────────────────────────────── */

interface Tip {
  x: number;
  y: number;
  label: string;
  n: number;
  famId: FamilyId;
  lines: string[];
}

function PlateTip({ tip }: { tip: Tip }) {
  const flipX = tip.x > 0.6;
  const flipY = tip.y > 0.55;
  return (
    <div
      className="tip dis-tip"
      style={{
        left: `${tip.x * 100}%`,
        top: `${tip.y * 100}%`,
        transform: `translate(${flipX ? 'calc(-100% - 14px)' : '14px'}, ${flipY ? 'calc(-100% - 10px)' : '12px'})`,
      }}
    >
      <div className="tip-h"><i style={{ background: family(tip.famId).color }} />{tip.label}</div>
      <div className="tip-n">{tip.n} post{tip.n === 1 ? '' : 's'} · mostly {family(tip.famId).label}</div>
      {tip.lines.length > 0 && (
        <ul>
          {tip.lines.map((l, i) => <li key={i}>{l}</li>)}
        </ul>
      )}
    </div>
  );
}

/* ── One witness card, shared by the wall and the dossier ─────────────── */

/** Muted looping footage that runs only while on screen — vivid without
 *  sixty decoders running at once — and not at all for readers who asked
 *  for reduced motion (the poster frame stands in). Any playback failure
 *  falls back to the still underneath. */
function Clip({ src, poster }: { src: string; poster: string | null }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [dead, setDead] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || dead) return;
    if (typeof window.matchMedia === 'function'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) el.play().catch(() => setDead(true));
      else el.pause();
    }, { rootMargin: '120px' });
    io.observe(el);
    return () => io.disconnect();
  }, [dead]);

  if (dead) return null;
  return (
    <video
      ref={ref}
      src={src}
      poster={poster ?? undefined}
      muted
      loop
      playsInline
      preload="none"
      onError={() => setDead(true)}
      aria-hidden
    />
  );
}

function WitnessCard({ post, dark }: { post: DisPost; dark?: boolean }) {
  const fam = family(post.family);
  const badge = KIND_BADGE[post.kind];
  return (
    <a
      className={`dis-card${dark ? ' dark' : ''}`}
      href={redditUrl(post)}
      target="_blank"
      rel="noreferrer"
    >
      <span className="dis-shot" style={{ borderColor: fam.color }}>
        {post.thumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={post.thumb}
            alt=""
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        ) : null}
        {post.clip && <Clip src={post.clip} poster={post.thumb} />}
        <span className="dis-shot-fill" style={{ background: fam.color }} aria-hidden>
          {fam.short}
        </span>
        {badge && <span className="dis-badge">{badge}</span>}
        <span className="dis-score">▲ {score(post.score)}</span>
      </span>
      <span className="dis-card-body">
        <b>{post.title}</b>
        <span className="dis-card-meta">
          <i style={{ background: fam.color }} />
          r/{post.sub} · {monthLabel(postMonth(post.created))} · {post.n} comments
        </span>
      </span>
    </a>
  );
}

/* ── Plate 1: the witness map ─────────────────────────────────────────── */

function WitnessMap({ data }: { data: Dispatches }) {
  const { h, d, project } = useMapGeometry(data.land);
  const [monthIx, setMonthIx] = useState<number | null>(null); // null = all time
  const [playing, setPlaying] = useState(false);
  const [tip, setTip] = useState<Tip | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  const months = data.months;
  const currentMonth = monthIx === null ? null : months[monthIx];

  const postById = useMemo(() => new Map(data.posts.map((p) => [p.id, p])), [data.posts]);

  // Cumulative counts per place up to the shown month; the map accumulates
  // like a long exposure, and this month's activity flares on top.
  const pins = useMemo(() => {
    const maxTotal = Math.max(1, ...data.places.map((p) => p.total));
    return data.places.map((p) => {
      let count = p.total;
      let now = 0;
      if (currentMonth !== null) {
        count = 0;
        for (const [m, n] of Object.entries(p.months)) {
          if (m <= currentMonth) count += n;
          if (m === currentMonth) now = n;
        }
      }
      return {
        ...p,
        ...project(p.lat, p.lon),
        count,
        now,
        r: count === 0 ? 0 : 2.6 + 21 * Math.sqrt(count / maxTotal),
        famId: dominantFamily(p.families),
      };
    }).filter((p) => p.count > 0);
  }, [data.places, project, currentMonth]);

  // Drawn back-to-front so the biggest circles sit on top; memoized since
  // this recomputes on every tooltip hover otherwise.
  const drawOrder = useMemo(() => [...pins].reverse(), [pins]);

  useEffect(() => {
    if (!playing) return;
    // The updater stays a pure clamp; the end-of-record stop lives out here
    // where a side effect belongs.
    if (monthIx !== null && monthIx >= months.length - 1) { setPlaying(false); return; }
    const t = setInterval(() => {
      setMonthIx((ix) => Math.min(ix === null ? 0 : ix + 1, months.length - 1));
    }, 700);
    return () => clearInterval(t);
  }, [playing, monthIx, months.length]);

  const monthTotal = currentMonth === null
    ? data.totalIndexed
    : Object.values(data.wire.find((w) => w.m === currentMonth)?.families ?? {}).reduce((a, b) => a + b, 0);

  const selectedPlace = selected ? data.places.find((p) => p.id === selected) ?? null : null;
  const selectedPosts = selectedPlace
    ? selectedPlace.top.map((id) => postById.get(id)).filter((p): p is DisPost => Boolean(p))
    : [];

  // Shared by hover and keyboard focus, so tabbing a pin surfaces the same
  // tooltip a mouse would — the dossier's a click away either way.
  const pinTip = (p: (typeof pins)[number]): Tip => ({
    x: p.x / MAP_W,
    y: p.y / h,
    label: p.label,
    n: p.count,
    famId: p.famId,
    lines: p.top.slice(0, 3)
      .map((id) => postById.get(id)?.title)
      .filter((t): t is string => Boolean(t))
      .map((t) => (t.length > 64 ? `${t.slice(0, 63)}…` : t)),
  });

  // Presence per family for the legend, over the whole record rather than
  // the scrubbed month, so it doesn't flicker while playing.
  const presentFamilies = useMemo(
    () => FAMILIES.filter((f) => data.places.some((p) => dominantFamily(p.families) === f.id)),
    [data.places],
  );

  return (
    <section className="dis-plate-section" id="map">
      <div className="wrap">
        <div className="dis-plate-head">
          <p className="eyebrow">Plate No. 1 · The witness map</p>
          <h2 className="section-title">Where the cameras were rolling</h2>
          <p className="dis-plate-note">
            Every pin is a place named in a post title — {data.located.toLocaleString()} dispatches
            pinned to {data.places.length} places. Press play and the record accumulates month by
            month; touch a pin for the loudest witnesses, press it for the full dossier.
          </p>
        </div>

        <figure className="dis-plate">
          <div className="dis-clock" role="group" aria-label="Time controls for the map">
            <button
              type="button"
              className={`dis-play${playing ? ' on' : ''}`}
              onClick={() => {
                if (!playing && (monthIx === null || monthIx >= months.length - 1)) setMonthIx(0);
                setPlaying(!playing);
              }}
              aria-label={playing ? 'Pause the months' : 'Play the months'}
            >
              {playing ? '❚❚' : '▶'}
            </button>
            <input
              type="range"
              className="dis-scrub"
              min={0}
              max={months.length - 1}
              value={monthIx ?? months.length - 1}
              onChange={(e) => { setPlaying(false); setMonthIx(Number(e.target.value)); }}
              aria-label="Month shown on the map"
              aria-valuetext={currentMonth ? monthLabel(currentMonth) : 'All months'}
            />
            <button
              type="button"
              className={`dis-alltime${monthIx === null ? ' on' : ''}`}
              onClick={() => { setPlaying(false); setMonthIx(null); }}
              aria-pressed={monthIx === null}
            >
              ALL TIME
            </button>
            <span className="dis-clock-read" aria-live="off">
              <b>{currentMonth ? monthLabel(currentMonth) : 'The whole record'}</b>
              <span>{monthTotal.toLocaleString()} post{monthTotal === 1 ? '' : 's'}{currentMonth ? ' that month' : ''}</span>
            </span>
          </div>

          <div className="dis-map-wrap">
            <div className="dis-scroll">
              <div className="dis-inner">
                <svg
                  viewBox={`0 0 ${MAP_W} ${h}`}
                  role="img"
                  aria-label={`World map of disaster posts: ${data.places.length} places, led by ${data.places[0].label} with ${data.places[0].total} posts. The same figures are in the table below.`}
                >
                  <path className="dis-land" d={d} />
                  {drawOrder.map((p) => {
                    const isSel = selected === p.id;
                    return (
                      <g
                        key={p.id}
                        className={`dis-pin${isSel ? ' sel' : ''}`}
                        tabIndex={0}
                        role="button"
                        aria-label={`${p.label}, ${p.count} post${p.count === 1 ? '' : 's'}`}
                        aria-pressed={isSel}
                        onMouseEnter={() => setTip(pinTip(p))}
                        onMouseLeave={() => setTip(null)}
                        onFocus={() => setTip(pinTip(p))}
                        onBlur={() => setTip(null)}
                        onClick={() => setSelected(isSel ? null : p.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            setSelected(isSel ? null : p.id);
                          }
                        }}
                      >
                        <circle className="dis-pin-hit" cx={p.x} cy={p.y} r={Math.max(p.r + 6, 11)} />
                        <circle
                          className="dis-pin-dot"
                          cx={p.x}
                          cy={p.y}
                          r={p.r}
                          style={{ fill: isSel ? undefined : family(p.famId).color }}
                        />
                        {p.now > 0 && <circle className="dis-pin-now" cx={p.x} cy={p.y} r={p.r + 4} />}
                        {isSel && <circle className="dis-pin-halo" cx={p.x} cy={p.y} r={p.r + 5.5} />}
                      </g>
                    );
                  })}
                </svg>
                {tip && <PlateTip tip={tip} />}
              </div>
            </div>
            <p className="dis-scroll-hint" aria-hidden>Scroll sideways for the full plate →</p>
          </div>

          <figcaption className="dis-plate-foot">
            <span className="dis-legend" aria-hidden>
              {presentFamilies.map((f) => (
                <span key={f.id}><i style={{ background: f.color }} />{f.short}</span>
              ))}
            </span>
            <span>Pin colour is the place&apos;s dominant family; ember ring marks activity in the shown month</span>
            <span className="dis-plate-no" aria-hidden>DISPATCHES — PL. 1</span>
          </figcaption>
        </figure>

        {selectedPlace && (
          <div className="dis-dossier">
            <div className="dis-dossier-head">
              <p className="dis-dossier-eyebrow">Dispatches from</p>
              <h3>
                {selectedPlace.label}
                <span className="ct">{selectedPlace.total} post{selectedPlace.total === 1 ? '' : 's'} on record</span>
              </h3>
              <button type="button" className="dis-dossier-x" onClick={() => setSelected(null)} aria-label="Close post list">
                ×
              </button>
            </div>
            <div className="dis-dossier-grid">
              {selectedPosts.map((p) => <WitnessCard key={p.id} post={p} />)}
            </div>
          </div>
        )}

        <details className="table-toggle dis-table">
          <summary>Every place, as a table</summary>
          <div className="table-scroll">
            <table className="counts">
              <thead>
                <tr><th>Place</th><th>Posts</th><th>Dominant family</th></tr>
              </thead>
              <tbody>
                {data.places.map((p) => (
                  <tr key={p.id}>
                    <td>{p.label}</td>
                    <td>{p.total}</td>
                    <td>{family(dominantFamily(p.families)).label}</td>
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

/* ── Plate 2: the evidence locker ─────────────────────────────────────── */

const WALL_SIZE = 60;

function EvidenceWall({ data }: { data: Dispatches }) {
  const [filter, setFilter] = useState<FamilyId | null>(null);

  const withMedia = useMemo(
    () => data.posts.filter((p) => p.thumb),
    [data.posts],
  );

  const famsPresent = useMemo(
    () => FAMILIES.filter((f) => withMedia.some((p) => p.family === f.id)),
    [withMedia],
  );

  const shown = useMemo(
    () => withMedia.filter((p) => !filter || p.family === filter).slice(0, WALL_SIZE),
    [withMedia, filter],
  );

  return (
    <section className="dis-wall-section" id="evidence" aria-labelledby="evidence-title">
      <div className="wrap">
        <div className="dis-plate-head">
          <p className="eyebrow">Plate No. 2 · The evidence locker</p>
          <h2 className="section-title" id="evidence-title">The footage itself</h2>
          <p className="dis-plate-note">
            The most upvoted dispatches with a surviving frame — the top {shown.length} of{' '}
            {withMedia.length}, straight off the wire. Every cell opens the original post and
            its thread.
          </p>
        </div>

        <div className="dis-filters" role="group" aria-label="Filter the wall by family">
          <button
            type="button"
            className={`dis-chip${filter === null ? ' on' : ''}`}
            onClick={() => setFilter(null)}
            aria-pressed={filter === null}
          >
            EVERYTHING
          </button>
          {famsPresent.map((f) => (
            <button
              key={f.id}
              type="button"
              className={`dis-chip${filter === f.id ? ' on' : ''}`}
              onClick={() => setFilter(filter === f.id ? null : f.id)}
              aria-pressed={filter === f.id}
            >
              <i style={{ background: f.color }} />
              {f.label.toUpperCase()}
            </button>
          ))}
        </div>

        <div className="dis-wall">
          {shown.map((p) => <WitnessCard key={p.id} post={p} dark />)}
        </div>

        <p className="dis-wall-foot">
          Thumbnails are served by Reddit and open the original thread; a blank cell means the
          upload has since been taken down.
        </p>
      </div>
    </section>
  );
}

/* ── Plate 3: the uptick ──────────────────────────────────────────────── */

const CH_AXIS = 46;
const CH_PAD_R = 14;
const CH_PLOT_H = 300;
const CH_TOP = 30;
const CH_LABELS = 40;
const CH_COL_W = 14;
const CH_COL_GAP = 3;

interface Quarter {
  key: string;      // '2023 Q2'
  year: number;
  q: number;
  total: number;
  counts: Partial<Record<FamilyId, number>>;
}

function Uptick({ data }: { data: Dispatches }) {
  const [hover, setHover] = useState<{ q: Quarter; x: number; y: number } | null>(null);
  const box = useRef<HTMLDivElement>(null);

  const famOf = useMemo(
    () => new Map(data.subs.map((s) => [s.name, s.family as FamilyId])),
    [data.subs],
  );

  const quarters = useMemo(() => {
    const map = new Map<string, Quarter>();
    for (const h of data.history) {
      const fam = famOf.get(h.sub) ?? 'unsorted';
      for (const [m, n] of Object.entries(h.months)) {
        const year = Number(m.slice(0, 4));
        const q = Math.floor((Number(m.slice(5, 7)) - 1) / 3) + 1;
        const key = `${year} Q${q}`;
        if (!map.has(key)) map.set(key, { key, year, q, total: 0, counts: {} });
        const row = map.get(key)!;
        row.total += n;
        row.counts[fam] = (row.counts[fam] ?? 0) + n;
      }
    }
    const all = Array.from(map.values()).sort((a, b) => (a.year - b.year) || (a.q - b.q));
    // The quarter still in progress would read as a collapse; end on the
    // last finished one.
    const now = data.generated;
    const curKey = `${now.slice(0, 4)} Q${Math.floor((Number(now.slice(5, 7)) - 1) / 3) + 1}`;
    return all.filter((r) => r.key !== curKey);
  }, [data.history, data.generated, famOf]);

  const max = Math.max(1, ...quarters.map((r) => r.total));
  const width = CH_AXIS + quarters.length * (CH_COL_W + CH_COL_GAP) + CH_PAD_R;
  const bottom = CH_TOP + CH_PLOT_H;
  const height = bottom + CH_LABELS;
  const colX = (i: number) => CH_AXIS + i * (CH_COL_W + CH_COL_GAP);

  const ticks = useMemo(() => {
    const raw = max / 4;
    const mag = 10 ** Math.floor(Math.log10(raw));
    // Clamped to whole numbers and deduplicated: a near-empty history would
    // otherwise yield fractional steps that round to repeated tick values.
    const step = Math.max(1, [1, 2, 2.5, 5, 10].map((s) => s * mag).find((s) => s >= raw) ?? mag * 10);
    const out: number[] = [];
    for (let v = 0; v <= max; v += step) {
      const r = Math.round(v);
      if (out[out.length - 1] !== r) out.push(r);
    }
    return out;
  }, [max]);
  const tickY = (v: number) => bottom - (v / max) * CH_PLOT_H;

  const famsPresent = FAMILIES.filter((f) => quarters.some((r) => (r.counts[f.id] ?? 0) > 0));

  function move(e: React.MouseEvent, q: Quarter) {
    const r = box.current?.getBoundingClientRect();
    if (!r) return;
    setHover({ q, x: e.clientX - r.left, y: e.clientY - r.top });
  }

  const flip = hover && box.current ? hover.x > box.current.clientWidth - 270 : false;

  const yearTotals = useMemo(() => {
    const byYear = new Map<number, Quarter>();
    for (const r of quarters) {
      if (!byYear.has(r.year)) byYear.set(r.year, { key: `${r.year}`, year: r.year, q: 0, total: 0, counts: {} });
      const y = byYear.get(r.year)!;
      y.total += r.total;
      for (const f of FAMILIES) {
        const n = r.counts[f.id];
        if (n) y.counts[f.id] = (y.counts[f.id] ?? 0) + n;
      }
    }
    return Array.from(byYear.values());
  }, [quarters]);

  return (
    <section className="dis-plate-section" id="uptick">
      <div className="wrap">
        <div className="dis-plate-head">
          <p className="eyebrow">Plate No. 3 · The uptick</p>
          <h2 className="section-title">More witnesses every year</h2>
          <p className="dis-plate-note">
            Posts per quarter across all {data.subs.length} watched subreddits since 2012, stacked
            by family. Some of the rise is the platform growing; some of it is the weather.
            The colophon below says which subreddit counts where.
          </p>
        </div>

        <figure className="dis-plate">
          <div className="dis-map-wrap">
            <div className="dis-chart-box" ref={box} onMouseLeave={() => setHover(null)}>
              <div className="dis-scroll">
                <div className="dis-inner chart">
                  <svg
                    viewBox={`0 0 ${width} ${height}`}
                    role="group"
                    aria-label={quarters.length
                      ? `Quarterly disaster posts from ${quarters[0].key} to ${quarters[quarters.length - 1].key}, split by family. The same figures are in the table below.`
                      : 'Quarterly disaster posts: no history to chart yet.'}
                  >
                    {ticks.map((v) => (
                      <g key={v}>
                        <line
                          x1={CH_AXIS - 6} x2={width - CH_PAD_R} y1={tickY(v)} y2={tickY(v)}
                          stroke="var(--rule)" strokeWidth={v === 0 ? 1.25 : 0.75}
                          opacity={v === 0 ? 1 : 0.6}
                        />
                        <text
                          x={CH_AXIS - 12} y={tickY(v) + 3.5} textAnchor="end"
                          fontFamily="var(--data)" fontSize="10" fill="var(--ink-faint)"
                          style={{ fontVariantNumeric: 'tabular-nums' }}
                        >
                          {v >= 1000 ? `${v / 1000}k` : v}
                        </text>
                      </g>
                    ))}

                    {quarters.map((r, i) => {
                      const x = colX(i);
                      let cursor = bottom;
                      return (
                        <g key={r.key}>
                          <rect
                            x={x - CH_COL_GAP / 2} y={CH_TOP} width={CH_COL_W + CH_COL_GAP} height={CH_PLOT_H}
                            fill="transparent"
                            onMouseMove={(e) => move(e, r)}
                          />
                          {FAMILIES.map((f) => {
                            const n = r.counts[f.id] ?? 0;
                            if (!n) return null;
                            const hgt = (n / max) * CH_PLOT_H;
                            cursor -= hgt;
                            return (
                              <rect
                                key={f.id}
                                x={x} y={cursor + (hgt > 4 ? 1 : 0)}
                                width={CH_COL_W}
                                height={Math.max(hgt - (hgt > 4 ? 2 : 0), 0.7)}
                                rx={hgt > 5 ? 1.5 : 0}
                                fill={f.color}
                                pointerEvents="none"
                              />
                            );
                          })}
                          {r.q === 1 && (
                            <text
                              x={x} y={bottom + 24} textAnchor="start"
                              fontFamily="var(--data)" fontSize="10.5" fill="var(--ink-soft)"
                            >
                              {r.year}
                            </text>
                          )}
                          {r.q === 1 && (
                            <line x1={x - CH_COL_GAP / 2} x2={x - CH_COL_GAP / 2} y1={bottom} y2={bottom + 8} stroke="var(--rule)" />
                          )}
                        </g>
                      );
                    })}
                  </svg>
                </div>
              </div>

              {hover && (
                <div
                  className="tip"
                  style={{
                    left: flip ? undefined : hover.x + 16,
                    right: flip ? (box.current?.clientWidth ?? 0) - hover.x + 16 : undefined,
                    top: Math.max(hover.y - 30, 4),
                  }}
                >
                  <div className="tip-h">{hover.q.key}</div>
                  <div className="tip-n">{hover.q.total.toLocaleString()} posts</div>
                  <ul>
                    {FAMILIES.filter((f) => (hover.q.counts[f.id] ?? 0) > 0)
                      .sort((a, b) => (hover.q.counts[b.id] ?? 0) - (hover.q.counts[a.id] ?? 0))
                      .slice(0, 5)
                      .map((f) => (
                        <li key={f.id}>{f.label} <span style={{ opacity: 0.6 }}>{hover.q.counts[f.id]}</span></li>
                      ))}
                  </ul>
                </div>
              )}
            </div>
            <p className="dis-scroll-hint" aria-hidden>Scroll sideways for the full chart →</p>
          </div>

          <figcaption className="dis-plate-foot">
            <span className="dis-legend">
              {famsPresent.map((f) => (
                <span key={f.id}><i style={{ background: f.color }} />{f.label.toUpperCase()}</span>
              ))}
            </span>
            <span className="dis-plate-no" aria-hidden>DISPATCHES — PL. 3</span>
          </figcaption>
        </figure>

        <details className="table-toggle dis-table">
          <summary>The uptick, as a table</summary>
          <div className="table-scroll">
            <table className="counts">
              <thead>
                <tr>
                  <th>Year</th>
                  {famsPresent.map((f) => <th key={f.id}>{f.label}</th>)}
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {yearTotals.map((y) => (
                  <tr key={y.year}>
                    <td>{y.year}</td>
                    {famsPresent.map((f) => <td key={f.id}>{y.counts[f.id] ?? 0}</td>)}
                    <td>{y.total}</td>
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

/* ── The view ─────────────────────────────────────────────────────────── */

export default function DispatchesView({ data }: { data: Dispatches }) {
  // An empty snapshot (fresh checkout before `npm run build:dispatches` has
  // ever been run) still has to build and say what it is.
  if (!data.months.length || !data.places.length) {
    return (
      <main id="main">
        <section className="dis-plate-section" id="map">
          <div className="wrap">
            <p className="dis-plate-note">
              The data snapshot is empty — run <code>npm run build:dispatches</code> to pull
              the record from the archive.
            </p>
          </div>
        </section>
      </main>
    );
  }
  return (
    <main id="main">
      <WitnessMap data={data} />
      <EvidenceWall data={data} />
      <Uptick data={data} />
    </main>
  );
}
