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

export function HazardGlyph({ hazard, size, className }: P & { hazard: string }) {
  const h = hazard.toLowerCase();
  if (h.includes('dam') || h.includes('levee')) return <DamGlyph size={size} className={className} />;
  if (h.includes('cyclone') || h.includes('hurricane') || h.includes('typhoon') || h.includes('surge')) {
    return <CycloneGlyph size={size} className={className} />;
  }
  return <FloodGlyph size={size} className={className} />;
}
