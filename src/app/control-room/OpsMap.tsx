'use client';

/**
 * The wall map of the operations room: a schematic order-of-battle board, not
 * cartography — it says so on its face. Geometry is per-scenario and drawn by
 * hand here; zone STATE is data-driven, lit only by cited information the
 * player has already been shown (forecast → watch, gauge → signal,
 * field report → flooding) plus the player's own warnings. Every state is
 * carried by pattern and label as well as colour.
 */
import type { Scenario } from './types';

export type ZoneState = 'quiet' | 'watch' | 'signal' | 'flooding';

const STATE_LABEL: Record<ZoneState, string> = {
  quiet: 'quiet',
  watch: 'red warning',
  signal: 'gauge alert',
  flooding: 'flooding',
};

type Props = {
  scenario: Scenario;
  zoneStates: Record<string, ZoneState>;
  warnedZones: string[];
};

export default function OpsMap({ scenario, zoneStates, warnedZones }: Props) {
  if (scenario.id !== 'valencia-dana-2024') return null;
  const st = (z: string): ZoneState => zoneStates[z] ?? 'quiet';
  const warned = (z: string) => warnedZones.includes(z);
  const zoneClass = (z: string) => `cr-zone is-${st(z)}${warned(z) ? ' is-warned' : ''}`;

  return (
    <figure className="cr-map">
      <svg viewBox="0 0 720 400" role="img" aria-label="Schematic map of the province of Valencia showing the state of the at-risk basins">
        <defs>
          <pattern id="cr-sea" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="10" stroke="currentColor" strokeOpacity="0.14" strokeWidth="1" />
          </pattern>
          <pattern id="cr-flood" width="12" height="8" patternUnits="userSpaceOnUse">
            <path d="M0 4c2-2.4 4-2.4 6 0s4 2.4 6 0" fill="none" stroke="var(--ember)" strokeOpacity="0.55" strokeWidth="1.2" />
          </pattern>
        </defs>

        {/* The sea and the coast */}
        <path d="M652 0c-10 40 8 70-4 108s6 66-6 104 8 72-2 110 4 52 0 78h80V0z" fill="url(#cr-sea)" />
        <path d="M652 0c-10 40 8 70-4 108s6 66-6 104 8 72-2 110 4 52 0 78" className="cr-map-coast" />
        <text className="cr-map-sea-label" x="688" y="200" transform="rotate(90 688 200)" textAnchor="middle">MEDITERRANEAN</text>

        {/* Albufera lagoon */}
        <ellipse cx="600" cy="312" rx="34" ry="22" className="cr-map-water" />
        <text className="cr-map-minor" x="600" y="352" textAnchor="middle">L&apos;ALBUFERA</text>

        {/* Valencia city */}
        <rect x="586" y="120" width="40" height="34" className="cr-map-city" />
        <text className="cr-map-label" x="606" y="110" textAnchor="middle">VALÈNCIA</text>

        {/* ZONE — Magro basin: Utiel, Requena, the Forata dam */}
        <g className={zoneClass('magro-utiel')}>
          <path className="cr-zone-shape" d="M40 96l150-34 96 44 40 74-52 60-118-16-92-60z" />
          {/* the Magro, down through Forata towards the Júcar */}
          <path className="cr-map-river" d="M56 132c40-6 74-22 108-14s52 34 74 44 44 24 56 46 16 44 34 62 40 26 54 48" />
          <rect x="272" y="188" width="18" height="7" className="cr-map-dam" transform="rotate(28 281 191)" />
          <text className="cr-map-minor" x="308" y="184">FORATA DAM</text>
          <circle cx="96" cy="122" r="4" className="cr-map-town" />
          <text className="cr-map-minor" x="96" y="108" textAnchor="middle">UTIEL</text>
          <circle cx="152" cy="140" r="4" className="cr-map-town" />
          <text className="cr-map-minor" x="152" y="162" textAnchor="middle">REQUENA</text>
          <text className="cr-zone-label" x="122" y="222">MAGRO BASIN</text>
          <text className="cr-zone-state" x="122" y="238">{STATE_LABEL[st('magro-utiel')].toUpperCase()}{warned('magro-utiel') ? ' · WARNED' : ''}</text>
        </g>

        {/* ZONE — Rambla del Poyo and the Horta Sud towns */}
        <g className={zoneClass('poyo-horta-sud')}>
          <path className="cr-zone-shape" d="M336 236l112-46 118 32 4 84-96 50-124-38z" />
          {/* the ravine, west hills to the Albufera */}
          <path className="cr-map-river cr-map-rambla" d="M340 250c30-16 58-24 88-22s58 16 86 26 40 22 56 46" />
          <circle cx="500" cy="264" r="4" className="cr-map-town" />
          <text className="cr-map-minor" x="500" y="252" textAnchor="middle">PAIPORTA</text>
          <circle cx="534" cy="286" r="4" className="cr-map-town" />
          <text className="cr-map-minor" x="546" y="278">CATARROJA</text>
          <circle cx="556" cy="308" r="4" className="cr-map-town" />
          <text className="cr-map-minor" x="566" y="322">ALFAFAR</text>
          <text className="cr-zone-label" x="356" y="336">RAMBLA DEL POYO · HORTA SUD</text>
          <text className="cr-zone-state" x="356" y="352">{STATE_LABEL[st('poyo-horta-sud')].toUpperCase()}{warned('poyo-horta-sud') ? ' · WARNED' : ''}</text>
        </g>

        {/* Plate furniture */}
        <text className="cr-map-plate" x="16" y="24">PROVINCE OF VALENCIA — OPERATIONS BOARD</text>
        <text className="cr-map-minor" x="16" y="40">SCHEMATIC · NOT TO SCALE</text>
        <g className="cr-map-north" transform="translate(30, 366)">
          <path d="M0 6L4 -8L8 6L4 2z" />
          <text x="14" y="4">N</text>
        </g>
      </svg>
      <figcaption className="cr-map-legend">
        <span className="cr-leg is-quiet">quiet</span>
        <span className="cr-leg is-watch">red warning</span>
        <span className="cr-leg is-signal">gauge alert</span>
        <span className="cr-leg is-flooding">flooding</span>
        <span className="cr-leg is-warned">warned by you</span>
      </figcaption>
    </figure>
  );
}
