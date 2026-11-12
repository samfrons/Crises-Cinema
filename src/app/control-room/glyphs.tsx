/**
 * The route's glyph set: thin-stroke pictograms in currentColor, drawn to sit
 * beside mono labels at small sizes. Decorative only — every glyph is paired
 * with its text label, so nothing is said by icon alone.
 */

type P = { size?: number; className?: string };

const base = (size: number) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true as const,
});

/* ── Feed kinds ─────────────────────────────────────────────────────────── */

export function ForecastGlyph({ size = 15, className }: P) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M6.5 15a4 4 0 1 1 .6-7.96A5.5 5.5 0 0 1 17.5 9a3.5 3.5 0 0 1 .5 6.96" />
      <path d="M8.5 18l-1.2 2.6M13 18l-1.2 2.6M17.5 18l-1.2 2.6" />
    </svg>
  );
}

export function GaugeGlyph({ size = 15, className }: P) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M3.5 18a8.5 8.5 0 0 1 17 0" />
      <path d="M12 18L16.4 11" />
      <path d="M4.5 14.5l1.4.8M12 8.5v1.6M19.5 14.5l-1.4.8" />
    </svg>
  );
}

export function MessageGlyph({ size = 15, className }: P) {
  return (
    <svg {...base(size)} className={className}>
      <rect x="3.5" y="6" width="17" height="12" rx="1" />
      <path d="M4 7l8 6 8-6" />
    </svg>
  );
}

export function MediaGlyph({ size = 15, className }: P) {
  return (
    <svg {...base(size)} className={className}>
      <rect x="4" y="7" width="16" height="11" rx="1.5" />
      <path d="M9 3.5L12 7l3-3.5" />
      <path d="M10.5 10.5v4l3.4-2z" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function FieldGlyph({ size = 15, className }: P) {
  return (
    <svg {...base(size)} className={className}>
      <circle cx="12" cy="6.5" r="2.5" />
      <path d="M8 21v-5.5a4 4 0 0 1 8 0V21" />
      <path d="M2.5 20c1.5-1.4 3-1.4 4.5 0M17 20c1.5-1.4 3-1.4 4.5 0" />
    </svg>
  );
}

export function KindGlyph({ kind, size, className }: P & { kind: string }) {
  switch (kind) {
    case 'forecast': return <ForecastGlyph size={size} className={className} />;
    case 'gauge': return <GaugeGlyph size={size} className={className} />;
    case 'message': return <MessageGlyph size={size} className={className} />;
    case 'media': return <MediaGlyph size={size} className={className} />;
    case 'field_report': return <FieldGlyph size={size} className={className} />;
    default: return null;
  }
}

/* ── Hazards, for the scenario cards ────────────────────────────────────── */

export function FloodGlyph({ size = 20, className }: P) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M3 9c2-2 4-2 6 0s4 2 6 0 4-2 6 0" />
      <path d="M3 14c2-2 4-2 6 0s4 2 6 0 4-2 6 0" />
      <path d="M3 19c2-2 4-2 6 0s4 2 6 0 4-2 6 0" />
    </svg>
  );
}

export function CycloneGlyph({ size = 20, className }: P) {
  return (
    <svg {...base(size)} className={className}>
      <circle cx="12" cy="12" r="2.6" />
      <path d="M14.5 9.8C18 7.5 20.5 8 21 4.5M9.5 14.2C6 16.5 3.5 16 3 19.5" />
    </svg>
  );
}

export function DamGlyph({ size = 20, className }: P) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M9 4h6l2 16H7z" />
      <path d="M8.2 10.5h7.6M7.6 15.5h8.8" />
      <path d="M3 20c1.3-1.2 2.7-1.2 4 0M17 20c1.3-1.2 2.7-1.2 4 0" />
    </svg>
  );
}

export function FireGlyph({ size = 20, className }: P) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M12 21c-3.6 0-6-2.4-6-5.6 0-3.4 2.6-5.2 3.4-8.4 1.8 1.4 2.4 3.2 2.2 4.8 1.2-.8 2-2.6 1.8-4.6C16 9 18 11.8 18 15.4 18 18.6 15.6 21 12 21z" />
      <path d="M12 21c-1.5 0-2.6-1-2.6-2.5 0-1.6 1.4-2.4 1.8-3.8 1.6 1 2.8 2.2 2.8 3.8 0 1.5-.9 2.5-2 2.5z" />
    </svg>
  );
}

/* ── Slip pictograms ──────────────────────────────────────────────────────
   One word per thing a cited slip talks about (vocabulary.json `icons`; the
   build refuses any other word). Same 24-unit grid, 1.6 stroke and round
   joins as the kind glyphs, so a slip's two marks read as one hand. Each is
   a restatement of the slip's own text, never information of its own: the
   slip is always the text, the pictogram only helps the eye find it. */

const PICTOGRAMS: Record<string, JSX.Element> = {
  siren: (
    <>
      <path d="M7 17v-4.5a5 5 0 0 1 10 0V17" />
      <path d="M5 17h14v3H5z" />
      <path d="M12 2.5v2M4.6 5.1l1.4 1.4M19.4 5.1L18 6.5M2.5 11.5h2M19.5 11.5h2" />
    </>
  ),
  wea: (
    <>
      <rect x="8" y="3" width="8" height="18" rx="1.4" />
      <path d="M10.6 5.6h2.8M12 9.5v4M12 16.4v.1" />
      <path d="M5.2 8.6a4.6 4.6 0 0 0 0 6.8M18.8 8.6a4.6 4.6 0 0 1 0 6.8" />
    </>
  ),
  'downed-line': (
    <>
      <path d="M5 21L10.6 3.5M3 21h6" />
      <path d="M7.6 7.4l8.8 2.4" />
      <path d="M16.4 9.8c1.5 2.4 2 4.8 1.6 7.4" />
      <path d="M18 17.2l-1.6 1.8h2.6l-1.6 2" />
    </>
  ),
  roadblock: (
    <>
      <path d="M3 8h18v6H3z" />
      <path d="M7.5 8l-3 6M12.5 8l-3 6M17.5 8l-3 6" />
      <path d="M6 14v6M18 14v6M4.5 20h3M16.5 20h3" />
    </>
  ),
  shelter: (
    <>
      <path d="M3 11.5L12 4l9 7.5" />
      <path d="M5.5 9.6V20h13V9.6" />
      <path d="M10 20v-5.5h4V20" />
    </>
  ),
  aircraft: (
    <>
      <path d="M4.5 6h15M12 6v3" />
      <path d="M5 12.5C5 10.6 7 9 10 9h3c2.4 0 4 1.6 4 3.5S15.4 16 13 16h-3c-3 0-5-1.6-5-3.5z" />
      <path d="M17 12h4.5M21.5 10v4" />
      <path d="M9.5 16v3M14 16v3M7.5 19h8.5" />
    </>
  ),
  boat: (
    <>
      <path d="M3 14.5h18l-2.6 4H5.6z" />
      <path d="M7 14.5v-4h6.5l2.5 4" />
      <path d="M10 10.5V6.5h2.5" />
      <path d="M3 21.5c1.5-1 3-1 4.5 0s3 1 4.5 0 3-1 4.5 0 3 1 4.5 0" />
    </>
  ),
  dam: (
    <>
      <path d="M9 4h6l2 16H7z" />
      <path d="M8.2 10.5h7.6M7.6 15.5h8.8" />
      <path d="M3 20c1.3-1.2 2.7-1.2 4 0M17 20c1.3-1.2 2.7-1.2 4 0" />
    </>
  ),
  'river-gauge': (
    <>
      <path d="M10 3v15" />
      <path d="M10 4.5h3.5M10 7.5h2.2M10 10.5h3.5M10 13.5h2.2" />
      <path d="M3 18c1.5-1.2 3-1.2 4.5 0s3 1.2 4.5 0 3-1.2 4.5 0 3 1.2 4.5 0" />
      <path d="M3 21.5c1.5-1.2 3-1.2 4.5 0s3 1.2 4.5 0 3-1.2 4.5 0 3 1.2 4.5 0" />
    </>
  ),
  rain: (
    <>
      <path d="M6.5 13.5a4 4 0 1 1 .6-7.96A5.5 5.5 0 0 1 17.5 7.5a3.5 3.5 0 0 1 .5 6" />
      <path d="M8 16v4.5M12 15.5v6M16 16v4.5" />
    </>
  ),
  flood: (
    <>
      <path d="M5 12V7.5L10 4l5 3.5V12" />
      <path d="M3 14c2-2 4-2 6 0s4 2 6 0 4-2 6 0" />
      <path d="M3 19c2-2 4-2 6 0s4 2 6 0 4-2 6 0" />
    </>
  ),
  wind: (
    <>
      <path d="M3 8.5h10.5A2.5 2.5 0 1 0 11 6" />
      <path d="M3 12.5h15.5a2.5 2.5 0 1 1-2.5 2.5" />
      <path d="M3 16.5h7" />
    </>
  ),
  fire: (
    <>
      <path d="M12 21c-3.6 0-6-2.4-6-5.6 0-3.4 2.6-5.2 3.4-8.4 1.8 1.4 2.4 3.2 2.2 4.8 1.2-.8 2-2.6 1.8-4.6C16 9 18 11.8 18 15.4 18 18.6 15.6 21 12 21z" />
      <path d="M12 21c-1.5 0-2.6-1-2.6-2.5 0-1.6 1.4-2.4 1.8-3.8 1.6 1 2.8 2.2 2.8 3.8 0 1.5-.9 2.5-2 2.5z" />
    </>
  ),
  /* A small flame held inside a closed line: the perimeter the slip says
     is held. */
  contained: (
    <>
      <circle cx="12" cy="12" r="9" strokeDasharray="3.2 2.2" />
      <path d="M12 16.5c-1.9 0-3.1-1.2-3.1-2.9 0-1.8 1.3-2.7 1.8-4.4 1 .8 1.3 1.7 1.2 2.6.6-.4 1-1.4.9-2.5 1.5 1.1 2.3 2.6 2.3 4.3 0 1.7-1.2 2.9-3.1 2.9z" />
    </>
  ),
  hydrant: (
    <>
      <path d="M9 21V9.5h6V21M7.5 21h9" />
      <path d="M8 9.5h8M10 9.5V8a2 2 0 0 1 4 0v1.5" />
      <path d="M9 13H6.5v2.5H9M15 13h2.5v2.5H15" />
    </>
  ),
  committee: (
    <>
      <circle cx="6.5" cy="8" r="1.9" />
      <circle cx="12" cy="6.2" r="1.9" />
      <circle cx="17.5" cy="8" r="1.9" />
      <path d="M4 13.4a2.5 2.5 0 0 1 5 0M9.5 11.6a2.5 2.5 0 0 1 5 0M15 13.4a2.5 2.5 0 0 1 5 0" />
      <path d="M3 15.5h18M5.5 15.5V20M18.5 15.5V20" />
    </>
  ),
  press: (
    <>
      <circle cx="12" cy="7.5" r="1.6" />
      <path d="M12 9.1V21M8.6 21L12 10l3.4 11M9.6 17h4.8" />
      <path d="M8.2 4.6a4.8 4.8 0 0 0 0 5.8M15.8 4.6a4.8 4.8 0 0 1 0 5.8" />
      <path d="M5.6 2.6a8.2 8.2 0 0 0 0 9.8M18.4 2.6a8.2 8.2 0 0 1 0 9.8" />
    </>
  ),
  social: (
    <>
      <path d="M3.5 4.5h11v8H9l-3 3v-3H3.5z" />
      <path d="M17 9h3.5v8.5h-2v3l-3-3H11v-2.5" />
    </>
  ),
  satellite: (
    <g transform="rotate(-40 12 11)">
      <rect x="9.5" y="8.5" width="5" height="5.5" rx=".6" />
      <path d="M2.5 9.5h5v3.5h-5zM16.5 9.5h5v3.5h-5zM7.5 11.2h2M14.5 11.2h2" />
      <path d="M9.6 17a2.6 2.6 0 0 0 4.8 0M7.4 19.4a5.4 5.4 0 0 0 9.2 0" />
    </g>
  ),
};

/** True when `name` has a drawing; the slip falls back to the kind glyph alone. */
export const hasPictogram = (name?: string): name is string => !!name && name in PICTOGRAMS;

export function Pictogram({ name, size = 18, className }: P & { name: string }) {
  const body = PICTOGRAMS[name];
  if (!body) return null;
  return <svg {...base(size)} className={className}>{body}</svg>;
}

/* ── Instrument readings ──────────────────────────────────────────────────
   One drawing per reading state (vocabulary.json `readings`), on the same
   grid and stroke. Each says only the state's word: an arrow for a level the
   slip says moved, a dial needle for a pressure the slip names, a dam for the
   warning the slip carries. No drawing implies a quantity the slip lacks: the
   arrows have no scale and the dial no numbers. */

const DAM_WALL = 'M14 4h4.5l2 16H12z';
const READING_GLYPHS: Record<string, JSX.Element> = {
  /* the level crosses the dashed alert line the slip names */
  'above-alert': (
    <>
      <path d="M3 11h18" strokeDasharray="2.2 2.2" />
      <path d="M12 20V4M8 8l4-4 4 4" />
    </>
  ),
  falling: (
    <>
      <path d="M12 3v15M8 14l4 4 4-4" />
      <path d="M3 21.5c1.5-1.2 3-1.2 4.5 0s3 1.2 4.5 0 3-1.2 4.5 0 3 1.2 4.5 0" />
    </>
  ),
  /* a double arrow: the slip's "surged", not a measured height */
  surged: <path d="M12 21V3M7 8l5-5 5 5M7 14l5-5 5 5" />,
  filling: (
    <>
      <path d={DAM_WALL} />
      <path d="M2.5 8h9.5M2.5 20h17.5" />
      <path d="M6.5 17.5V11M4.5 13l2-2 2 2" />
    </>
  ),
  'may-fail': (
    <>
      <path d={DAM_WALL} />
      <path d="M2.5 8h9.5M2.5 20h9" />
      <path d="M16.6 6.5l-1.6 3.2 2.2 2-1.8 3.6" />
    </>
  ),
  /* a dial with no numbers: the needle restates the crew's word */
  good: (
    <>
      <path d="M3.5 17a8.5 8.5 0 0 1 17 0" />
      <path d="M12 17l5.2-6.2" />
      <path d="M4.5 21h15" />
    </>
  ),
  low: (
    <>
      <path d="M3.5 17a8.5 8.5 0 0 1 17 0" />
      <path d="M12 17L7.4 11.4" />
      <path d="M4.5 21h15" />
    </>
  ),
  nothing: (
    <>
      <path d="M3.5 17a8.5 8.5 0 0 1 17 0" />
      <path d="M12 17H4.6" />
      <path d="M4.5 21h15" />
    </>
  ),
  contained: PICTOGRAMS.contained,
  flaring: (
    <>
      {PICTOGRAMS.fire}
      <path d="M4 6.5l1.6 1.2M20 6.5l-1.6 1.2M12 2v1.8" />
    </>
  ),
};

export function ReadingGlyph({ state, size = 24, className }: P & { state: string }) {
  const body = READING_GLYPHS[state];
  if (!body) return null;
  return <svg {...base(size)} className={className}>{body}</svg>;
}

/* ── The record is silent ─────────────────────────────────────────────────
   A ledger page with its lines ruled and nothing written on them: the log's
   mark for a path no one took. Decorative; the block says it in words. */
export function SilentGlyph({ size = 34, className }: P) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M5.5 3h10l3 3v15h-13z" />
      <path d="M15.5 3v3h3" />
      <path d="M8.5 10.5h7M8.5 14h7M8.5 17.5h7" strokeWidth={1} strokeOpacity={0.5} />
    </svg>
  );
}

export function HazardGlyph({ hazard, size, className }: P & { hazard: string }) {
  const h = hazard.toLowerCase();
  if (/fire|wildland/.test(h)) return <FireGlyph size={size} className={className} />;
  if (h.includes('dam') || h.includes('levee')) return <DamGlyph size={size} className={className} />;
  if (h.includes('cyclone') || h.includes('hurricane') || h.includes('typhoon') || h.includes('surge')) {
    return <CycloneGlyph size={size} className={className} />;
  }
  return <FloodGlyph size={size} className={className} />;
}
