'use client';

// The screening room. One clip owns the viewport at a time, K2-style:
// muted playback starts when a clip is mostly in view and stops when it
// leaves; at most one video ever plays, and videos are only *armed* (allowed
// to fetch metadata) near the viewport, so the page costs nothing to open.
//
// Features open on their disaster sequence via `startAt` and soft-loop a
// short window of it — but only until the reader touches a control. From
// then on the clip is theirs: native controls come on and nothing auto-seeks.

import { useCallback, useEffect, useRef, useState } from 'react';
import { family } from '@/lib/taxonomy';
import { timestamp, licenseLabel, type ReelClip } from '@/lib/reel';

type Status = 'idle' | 'playing' | 'error';

interface ClipUi {
  status: Status;
  muted: boolean;
  /** Reader has used a control — stop soft-looping, show native controls. */
  engaged: boolean;
}

const PLAY_AT = 0.55;   // intersection ratio that starts a clip
const STOP_AT = 0.2;    // ratio below which a clip is paused

const PlayIcon = () => (
  <svg width="11" height="12" viewBox="0 0 11 12" aria-hidden="true">
    <path d="M0 0 L11 6 L0 12 Z" fill="currentColor" />
  </svg>
);
const PauseIcon = () => (
  <svg width="10" height="12" viewBox="0 0 10 12" aria-hidden="true">
    <rect width="3.5" height="12" fill="currentColor" />
    <rect x="6.5" width="3.5" height="12" fill="currentColor" />
  </svg>
);

export default function ReelCascade({ clips }: { clips: ReelClip[] }) {
  const [ui, setUi] = useState<ClipUi[]>(() =>
    clips.map(() => ({ status: 'idle' as Status, muted: true, engaged: false })),
  );
  const [active, setActive] = useState(0);
  const [sweep, setSweep] = useState(0);
  const [gaugeOn, setGaugeOn] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [reduced, setReduced] = useState(false);

  const videos = useRef<(HTMLVideoElement | null)[]>([]);
  const seeked = useRef<boolean[]>([]);
  const wanted = useRef<number | null>(null); // clip the observer wants playing
  const houseRef = useRef<HTMLDivElement | null>(null);
  const uiRef = useRef(ui);
  uiRef.current = ui;

  const patch = useCallback((i: number, p: Partial<ClipUi>) => {
    setUi((prev) => prev.map((u, j) => (j === i ? { ...u, ...p } : u)));
  }, []);

  /** Seek a feature to its disaster sequence once metadata is in. */
  const ensureStart = useCallback(
    (i: number) => {
      const v = videos.current[i];
      if (!v || seeked.current[i] || clips[i].startAt <= 0) return;
      if (v.readyState >= 1) {
        v.currentTime = clips[i].startAt;
        seeked.current[i] = true;
      } else {
        const once = () => {
          if (!seeked.current[i]) {
            v.currentTime = clips[i].startAt;
            seeked.current[i] = true;
          }
        };
        v.addEventListener('loadedmetadata', once, { once: true });
      }
    },
    [clips],
  );

  const pauseClip = useCallback((i: number) => {
    const v = videos.current[i];
    if (v && !v.paused) v.pause();
  }, []);

  const playClip = useCallback(
    (i: number, force = false) => {
      const v = videos.current[i];
      if (!v || (!force && uiRef.current[i].status === 'error')) return;
      videos.current.forEach((other, j) => {
        if (j !== i && other && !other.paused) other.pause();
      });
      if (v.preload === 'none') v.preload = 'metadata';
      ensureStart(i);
      v.muted = uiRef.current[i].muted;
      // A rejected play() is not a broken stream: autoplay refusal and
      // scroll-raced pauses both land here. Leave the poster and the explicit
      // play control in place; real failures arrive via the error event.
      v.play().catch(() => {});
    },
    [ensureStart],
  );

  // Reduced-motion preference, once hydrated.
  useEffect(() => {
    setHydrated(true);
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  // Observer 1 — arming: near-viewport clips may fetch metadata (posters are
  // plain <img>-style fetches via the poster attribute and load regardless).
  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const i = Number((e.target as HTMLElement).dataset.idx);
          const v = videos.current[i];
          if (v && e.isIntersecting && v.preload === 'none') {
            v.preload = 'metadata';
            ensureStart(i);
          }
        }
      },
      { rootMargin: '120% 0px' },
    );
    videos.current.forEach((v) => v && io.observe(v));
    return () => io.disconnect();
  }, [ensureStart]);

  // Observer 2 — the projectionist: start the clip that owns the viewport,
  // stop the ones that left. Skipped entirely under reduced motion.
  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const i = Number((e.target as HTMLElement).dataset.idx);
          if (e.intersectionRatio >= PLAY_AT) {
            setActive(i);
            if (!reduced) {
              wanted.current = i;
              playClip(i);
            }
          } else if (e.intersectionRatio < STOP_AT) {
            if (wanted.current === i) wanted.current = null;
            pauseClip(i);
          }
        }
      },
      { threshold: [0, STOP_AT, PLAY_AT] },
    );
    document.querySelectorAll<HTMLElement>('.rl-clip').forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [reduced, playClip, pauseClip]);

  // The leader gauge: sweep = progress through the auditorium.
  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const house = houseRef.current;
        if (!house) return;
        const r = house.getBoundingClientRect();
        const span = r.height - window.innerHeight;
        const p = span > 0 ? Math.min(1, Math.max(0, -r.top / span)) : 0;
        setSweep(p);
        setGaugeOn(r.top < window.innerHeight * 0.4 && r.bottom > window.innerHeight * 0.7);
      });
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);

  const onToggle = (i: number) => {
    const v = videos.current[i];
    if (!v) return;
    patch(i, { engaged: true });
    if (v.paused) {
      wanted.current = i;
      playClip(i);
    } else {
      wanted.current = null;
      v.pause();
    }
  };

  // The stream died (a single archive node can be down for hours) — let the
  // reader ask the projectionist to thread it again.
  const onRetry = (i: number) => {
    const v = videos.current[i];
    if (!v) return;
    patch(i, { status: 'idle' });
    seeked.current[i] = false;
    v.load();
    if (v.preload === 'none') v.preload = 'metadata';
    ensureStart(i);
    wanted.current = i;
    playClip(i, true);
  };

  const onMute = (i: number) => {
    const v = videos.current[i];
    const muted = !uiRef.current[i].muted;
    patch(i, { muted, engaged: true });
    if (v) v.muted = muted;
  };

  // Soft loop: replay the curated window until the reader takes over.
  const onTime = (i: number) => {
    const v = videos.current[i];
    const c = clips[i];
    if (!v || uiRef.current[i].engaged || !c.window) return;
    if (v.currentTime > c.startAt + c.window) v.currentTime = c.startAt;
  };

  const R = 26;
  const CIRC = 2 * Math.PI * R;
  const activeClip = clips[active];

  return (
    <div className="rl-house" ref={houseRef}>
      <div className="rl-dim" aria-hidden="true" />
      <p className="rl-house-note">· House lights down · every clip is muted until you ask ·</p>

      <div className="rl-cascade">
        {clips.map((c, i) => {
          const u = ui[i];
          const fam = family(c.family);
          const showControlsAttr = !hydrated || reduced || u.engaged;
          const playing = u.status === 'playing';
          return (
            <article className="rl-clip" data-idx={i} key={c.id} id={`r${i + 1}`}>
              <header className="rl-head">
                <span className="rl-no">Reel {String(i + 1).padStart(2, '0')}</span>
                <span className="rl-fam">
                  <i style={{ background: fam.color }} />
                  {fam.label}
                </span>
                <span className="rl-yr">{c.year}</span>
              </header>

              <h2 className="rl-title">{c.title}</h2>
              {c.kind === 'archive' && (
                <span className="rl-offlist">Archive footage — not on the film list</span>
              )}

              <div className="rl-frame">
                {/* eslint-disable-next-line jsx-a11y/media-has-caption -- silent-era
                    footage; each clip carries a text description instead. */}
                <video
                  ref={(el) => { videos.current[i] = el; }}
                  data-idx={i}
                  poster={c.poster ?? undefined}
                  preload="none"
                  muted={u.muted}
                  playsInline
                  controls={showControlsAttr}
                  style={
                    c.width && c.height
                      ? { aspectRatio: `${c.width} / ${c.height}` }
                      : { aspectRatio: '4 / 3' }
                  }
                  aria-label={`${c.title} (${c.year}). ${c.what}`}
                  onPlay={() => patch(i, { status: 'playing' })}
                  onPause={() => {
                    if (uiRef.current[i].status !== 'error') patch(i, { status: 'idle' });
                  }}
                  onVolumeChange={() => {
                    const v = videos.current[i];
                    if (v && v.muted !== uiRef.current[i].muted) patch(i, { muted: v.muted });
                  }}
                  onTimeUpdate={() => onTime(i)}
                  onError={(e) => {
                    if ((e.target as HTMLVideoElement).error) patch(i, { status: 'error' });
                  }}
                  onClick={(e) => {
                    if (!showControlsAttr) {
                      e.preventDefault();
                      onToggle(i);
                    }
                  }}
                >
                  {/* Download redirector first, then the item's own node(s):
                      the selection algorithm walks to the next source when a
                      fetch fails, so a flaky redirect is not a dead clip. */}
                  {c.srcs.map((s, k) => (
                    <source
                      key={s}
                      src={s}
                      type="video/mp4"
                      onError={
                        k === c.srcs.length - 1
                          ? () => patch(i, { status: 'error' })
                          : undefined
                      }
                    />
                  ))}
                </video>

                {u.status === 'error' ? (
                  <div className="rl-overlay veil" role="status">
                    <div className="rl-error">
                      <b>Footage unavailable</b>
                      the stream from archive.org did not answer
                      <span className="rl-error-row">
                        <button type="button" className="rl-btn" onClick={() => onRetry(i)}>
                          Try again
                        </button>
                        <a href={c.source.itemUrl} target="_blank" rel="noreferrer">
                          open the source item ↗
                        </a>
                      </span>
                    </div>
                  </div>
                ) : hydrated && !playing ? (
                  <div className="rl-overlay">
                    <button type="button" className="rl-bigplay" onClick={() => onToggle(i)}>
                      <PlayIcon /> Run reel {String(i + 1).padStart(2, '0')}
                    </button>
                  </div>
                ) : null}
              </div>

              <div className="rl-controls">
                {u.status !== 'error' && (
                  <>
                    <button
                      type="button"
                      className="rl-btn"
                      onClick={() => onToggle(i)}
                      aria-label={playing ? `Pause ${c.title}` : `Play ${c.title}`}
                    >
                      {playing ? <PauseIcon /> : <PlayIcon />}
                      {playing ? 'Pause' : 'Play'}
                    </button>
                    <button
                      type="button"
                      className="rl-btn"
                      onClick={() => onMute(i)}
                      aria-pressed={!u.muted}
                      aria-label={u.muted ? `Unmute ${c.title}` : `Mute ${c.title}`}
                    >
                      Sound {u.muted ? 'off' : 'on'}
                    </button>
                  </>
                )}
                <a className="rl-srclink" href={c.source.itemUrl} target="_blank" rel="noreferrer">
                  Source ↗
                </a>
                <span className="rl-mark">
                  {c.startAt > 0 && c.duration
                    ? `Opens at ${timestamp(c.startAt)} of ${timestamp(c.duration)}`
                    : c.duration
                      ? `Full reel · ${timestamp(c.duration)}`
                      : null}
                </span>
              </div>

              <p className="rl-blurb">{c.blurb}</p>
              <p className="rl-what">
                <b>On screen —</b> {c.what} {c.audioNote}
              </p>
              <p className="rl-credit">
                Internet Archive · <a href={c.source.itemUrl} target="_blank" rel="noreferrer">{c.source.identifier}</a>
                {' · '}tagged {licenseLabel(c.source.licenseUrl)}
                {' · '}{c.source.pdBasis}
              </p>
            </article>
          );
        })}
      </div>

      <div className="rl-tail">
        <p>· End of programme · 1900 – 1930 ·</p>
        <a href="#papers">The paperwork ↓</a>
      </div>

      <div className={`rl-gauge${gaugeOn ? ' on' : ''}`} aria-hidden="true">
        <svg width="70" height="70" viewBox="0 0 70 70">
          <line x1="35" y1="0" x2="35" y2="70" stroke="rgba(241,232,213,0.22)" strokeWidth="1" />
          <line x1="0" y1="35" x2="70" y2="35" stroke="rgba(241,232,213,0.22)" strokeWidth="1" />
          <circle cx="35" cy="35" r={R} fill="rgba(9,7,5,0.6)" stroke="rgba(241,232,213,0.28)" strokeWidth="1.5" />
          <circle
            cx="35" cy="35" r={R}
            fill="none" stroke="#b8321a" strokeWidth="3"
            strokeDasharray={`${CIRC * sweep} ${CIRC}`}
            transform="rotate(-90 35 35)"
          />
        </svg>
        <div className="rl-gauge-year">{activeClip?.year ?? clips[0].year}</div>
        <div className="rl-gauge-reel">
          Reel {String(active + 1).padStart(2, '0')} / {String(clips.length).padStart(2, '0')}
        </div>
      </div>
    </div>
  );
}
