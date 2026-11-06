import type { ReactNode } from 'react';
import './gallery.css';

/** Seven lobby cards for the seven companion pages. Server component, no JS. */

const S = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

function Motif({ children }: { children: ReactNode }) {
  return (
    <svg className="pg-motif" viewBox="0 0 64 64" width="64" height="64" aria-hidden="true" focusable="false" {...S}>
      {children}
    </svg>
  );
}

const CARDS: { href: string; eyebrow: string; title: string; blurb: string; motif: ReactNode }[] = [
  {
    href: '/atlas',
    eyebrow: 'No. 2 — the map',
    title: 'The Atlas of Ruin',
    blurb: 'Every catastrophe pinned to the place its synopsis swears it happened. Tokyo has a lot to answer for.',
    motif: (
      <Motif>
        <circle cx="32" cy="30" r="20" />
        <ellipse cx="32" cy="30" rx="8" ry="20" />
        <path d="M12 30h40M15 20h34M15 40h34" />
        <path d="M32 62c-5-7-8-10-8-14a8 8 0 0116 0c0 4-3 7-8 14z" fill="var(--paper)" />
        <circle cx="32" cy="48" r="2.5" />
      </Motif>
    ),
  },
  {
    href: '/dispatches',
    eyebrow: 'No. 3 — the control group',
    title: 'Dispatches from the Ground',
    blurb: 'The real thing, as filmed by whoever was standing nearest, filed under the same eleven families as the movies.',
    motif: (
      <Motif>
        <path d="M32 24v36M26 60h12M26 40l6-8 6 8M22 52l10-12 10 12" />
        <circle cx="32" cy="20" r="3" />
        <path d="M24 14a11 11 0 000 12M40 14a11 11 0 010 12M18 9a19 19 0 000 22M46 9a19 19 0 010 22" />
      </Motif>
    ),
  },
  {
    href: '/control-room',
    eyebrow: 'No. 4 — the hot seat',
    title: 'The Control Room',
    blurb: 'You are the emergency chief and the clock is the real one. Make the call, then meet the people who actually did.',
    motif: (
      <Motif>
        <path d="M6 50h52l-5-14H11z" />
        <path d="M14 36l3-10h30l3 10" />
        <rect x="20" y="10" width="24" height="14" rx="1.5" />
        <path d="M24 17h6l2-4 3 8 2-4h3" />
        <circle cx="20" cy="43" r="1.6" />
        <circle cx="28" cy="43" r="1.6" />
        <path d="M38 41v5M44 41v5M36 44h4M42 44h4" />
        <path d="M12 50v8M52 50v8" />
      </Motif>
    ),
  },
  {
    href: '/preparedness',
    eyebrow: 'No. 5 — the field report',
    title: 'The Last Mile',
    blurb: 'Six international indices and fourteen inquiries ask who is actually ready. Hollywood always assumed somebody was.',
    motif: (
      <Motif>
        <path d="M24 56v-5h16v5M20 56h24" />
        <path d="M24 51v-9a8 8 0 0116 0v9z" />
        <path d="M32 42V32" />
        <path d="M32 24v-6M20 28l-4-4M44 28l4-4M14 38h-5M50 38h5" />
        <path d="M6 15h14v8H6zM44 15h14v8H44z" strokeDasharray="2 3" />
      </Motif>
    ),
  },
  {
    href: '/reel',
    eyebrow: 'No. 6 — from the vault',
    title: 'The First Reels',
    blurb: 'Ten public-domain films, 1900 to 1930, back when a tripod in the wreckage counted as a feature.',
    motif: (
      <Motif>
        <circle cx="28" cy="28" r="20" />
        <circle cx="28" cy="28" r="3" />
        <circle cx="28" cy="15" r="4.5" />
        <circle cx="28" cy="41" r="4.5" />
        <circle cx="15" cy="28" r="4.5" />
        <circle cx="41" cy="28" r="4.5" />
        <path d="M48 44l12-7v22l-12-7z" />
        <path d="M48 44v8" />
      </Motif>
    ),
  },
  {
    href: '/catalogue',
    eyebrow: 'No. 7 — the index',
    title: 'The Catalogue',
    blurb: 'All of them, one page a decade, no filters and no posters. The plain index for readers who like it plain.',
    motif: (
      <Motif>
        <rect x="8" y="24" width="38" height="28" rx="1.5" />
        <path d="M14 18h38v28" />
        <path d="M20 12h38v28" />
        <path d="M14 34h26M14 40h26M14 46h16" />
      </Motif>
    ),
  },
  {
    href: '/methodology',
    eyebrow: 'No. 8 — the small print',
    title: 'Methodology',
    blurb: 'How 105 disaster types became eleven, who decided, and an honest account of what the chart left out.',
    motif: (
      <Motif>
        <path d="M32 6v32M23 15h18" />
        <path d="M32 38l-3-6M32 38l3-6" />
        <path d="M10 46h44M10 52h44M10 58h28" />
        </Motif>
    ),
  },
];

export default function ProgrammeGallery() {
  return (
    <section className="pg" id="programme" aria-labelledby="pg-title">
      <div className="wrap">
        <p className="eyebrow">Now showing in the lobby</p>
        <h2 className="section-title" id="pg-title">The rest of the programme</h2>
        <p className="lede">
          The essay is the main feature. Seven more screens are running next door: a map, a
          witness stand, a game, a field report, a vault, an index and the small print.
        </p>

        <ul className="pg-grid">
          {CARDS.map((c) => (
            <li key={c.href}>
              <a className="pg-card" href={c.href}>
                <span className="pg-eyebrow">{c.eyebrow}</span>
                {c.motif}
                <span className="pg-title">{c.title}</span>
                <span className="pg-blurb">{c.blurb}</span>
                <span className="pg-go" aria-hidden="true">Step inside →</span>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
