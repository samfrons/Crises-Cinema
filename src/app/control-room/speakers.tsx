/**
 * Picture mode's dialogue box: who a slip "speaks" as, and a generic role
 * portrait for it. Presentation only, and derived only from fields the build
 * already checks — never from a name read out of the text:
 *
 *   forecast      → the scenario's own forecast-office label (warning_chain.labels.forecast)
 *   gauge         → the instrument series the slip's readings are drawn on
 *                   (scenarios' `instruments`, the part before " · "), else the
 *                   hazard's own word for an instrument slip ("Observation")
 *   message       → "Message", addressed to the scenario's desk label
 *   field_report  → "From the field"
 *   media         → "Media"
 *
 * The portraits are generic ink-line roles keyed by kind (a forecaster, an
 * instrument, a dispatcher's headset, a field unit's helmet, a camera): never
 * a likeness, never a named person. Decorative (aria-hidden).
 */
import type { InfoItem, Scenario } from './types';
import { vocabFor } from './hazards';

export function speakerFor(scenario: Scenario, info: InfoItem): string {
  const labels = scenario.warning_chain?.labels;
  const vocab = vocabFor(scenario);
  switch (info.kind) {
    case 'forecast':
      return labels?.forecast ?? vocab.kindLabel.forecast;
    case 'gauge': {
      const series = info.readings?.[0]?.series;
      const name = series ? scenario.instruments?.[series] : undefined;
      return name ? name.split(' · ')[0] : vocab.kindLabel.gauge;
    }
    case 'message':
      return `${vocab.kindLabel.message} → ${labels?.desk ?? 'your desk'}`;
    default:
      return vocab.kindLabel[info.kind];
  }
}

const S = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

/** A head and shoulders, the base every person-role is drawn on. */
const Bust = () => (
  <>
    <circle cx="24" cy="18" r="8" {...S} />
    <path d="M9 44c1-9 7-14 15-14s14 5 15 14" {...S} />
  </>
);

export function Portrait({ kind, size = 48 }: { kind: InfoItem['kind']; size?: number }) {
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} aria-hidden focusable="false" className="cr-portrait-svg">
      {kind === 'forecast' && (
        <>
          <Bust />
          {/* isobars over the shoulder: the forecaster */}
          <path d="M33 7c3-2 7-2 10 0M34 12c2.5-1.5 5.5-1.5 8 0" {...S} strokeWidth={1.6} />
        </>
      )}
      {kind === 'message' && (
        <>
          <Bust />
          {/* headset band and boom mic: the dispatcher */}
          <path d="M15 18a9 9 0 0 1 18 0" {...S} />
          <path d="M15 17v5M15 22c0 4 3 5 7 5" {...S} strokeWidth={1.6} />
        </>
      )}
      {kind === 'field_report' && (
        <>
          <Bust />
          {/* a helmet with a brim: the field unit */}
          <path d="M14 15c0-6 4.5-9 10-9s10 3 10 9M11 15h26" {...S} />
        </>
      )}
      {kind === 'gauge' && (
        <>
          {/* not a person: an instrument's dial */}
          <circle cx="24" cy="26" r="16" {...S} />
          <path d="M12 30a12 12 0 0 1 24 0" {...S} strokeWidth={1.4} />
          <path d="M24 30L31 19" {...S} />
          <circle cx="24" cy="30" r="2" fill="currentColor" />
        </>
      )}
      {kind === 'media' && (
        <>
          {/* not a person: the press camera */}
          <path d="M8 16h8l3-4h10l3 4h8v22H8z" {...S} />
          <circle cx="24" cy="26" r="7" {...S} />
        </>
      )}
    </svg>
  );
}
