'use client';

/**
 * The wall map of the operations room: a schematic order-of-battle board, not
 * cartography — it says so on its face. Geometry is per-scenario and drawn by
 * hand here; zone STATE is data-driven, lit only by cited information the
 * player has already been shown plus the player's own warnings. What a state
 * is called (red warning / red flag, flooding / burning) comes from the
 * scenario's hazard (hazards.ts), never from the board. Every state is carried
 * by pattern and label as well as colour.
 */
import { useId } from 'react';
import type { Scenario } from './types';
import { vocabFor, COMPASS_TOWARD, COMPASS_WORD, type HazardVocab, type ZoneState } from './hazards';

export type { ZoneState } from './hazards';

type Props = {
  scenario: Scenario;
  zoneStates: Record<string, ZoneState>;
  warnedZones: string[];
  /** A line printed under the legend, e.g. why the board is still blank. */
  note?: string;
  /** Zone → the stamp of the cited item that first places the hazard there
   *  ("06:34", or "BY 12:20" when the text gives no clock time). */
  origins?: Record<string, string>;
  /** A wind direction a cited forecast states, and the decision it was last stated at. */
  wind?: { from: string; by: string } | null;
  /** What this hour's traffic changed: zones, origin marks, the wind mark. */
  fresh?: { zones: string[]; origins: string[]; wind: boolean };
};

const NO_FRESH = { zones: [] as string[], origins: [] as string[], wind: false };

/** What every hand-drawn board gets: state lookups and per-instance ids. */
type Board = {
  st: (z: string) => ZoneState;
  warned: (z: string) => boolean;
  zoneClass: (z: string) => string;
  /** The impact-state fill (pattern) for a zone, or undefined. */
  fill: (z: string) => string | undefined;
  /** Upper-case state word for the plate. */
  word: (z: string) => string;
  sea: string;
  /** A zone's outline (and, the hour its state changes, the new state's
   *  fill printed across it — see .cr-zone-sweep). */
  shape: (z: string, d: string) => JSX.Element;
};

/** Per board: where a zone's origin mark is stamped (clear of its labels —
 *  the mark names the zone, not a street corner), and the wind mark's place. */
const MARKS: Record<string, { origin: Record<string, [number, number]>; wind?: [number, number] }> = {
  'valencia-dana-2024': { origin: { 'magro-utiel': [196, 104], 'poyo-horta-sud': [440, 318] } },
  'lahaina-2023': { origin: { 'lahaina-lahainaluna': [298, 300], 'upcountry-kula': [614, 246] }, wind: [700, 26] },
};

const BOARDS: Record<string, (b: Board) => JSX.Element> = {
  'valencia-dana-2024': ValenciaBoard,
  'lahaina-2023': LahainaBoard,
};

export default function OpsMap({ scenario, zoneStates, warnedZones, note, origins = {}, wind = null, fresh = NO_FRESH }: Props) {
  // Pattern ids are per instance, so a board in the side panel and one in
  // the briefing or the phone sheet never resolve to each other's patterns.
  const uid = useId().replace(/:/g, '');
  const Draw = BOARDS[scenario.id];
  if (!Draw) return null;
  const vocab = vocabFor(scenario);
  const st = (z: string): ZoneState => zoneStates[z] ?? 'quiet';
  const warned = (z: string) => warnedZones.includes(z);
  const sea = `cr-sea-${uid}`;
  const impact = `cr-impact-${uid}`;
  const board: Board = {
    st,
    warned,
    zoneClass: (z) => `cr-zone is-${st(z)}${warned(z) ? ' is-warned' : ''}${fresh.zones.includes(z) ? ' is-fresh' : ''}`,
    fill: (z) => (st(z) === 'impact' ? `url(#${impact})` : undefined),
    word: (z) => vocab.states[st(z)].toUpperCase(),
    sea,
    shape: (z, d) => {
      const s = st(z);
      const sweep = fresh.zones.includes(z) && (s === 'signal' || s === 'impact');
      return (
        <>
          <path className="cr-zone-shape" style={{ fill: s === 'impact' && !sweep ? `url(#${impact})` : undefined }} d={d} />
          {sweep && (
            <path key={s} className={`cr-zone-sweep is-${s}`} d={d}
              style={{ fill: s === 'impact' ? `url(#${impact})` : undefined }} />
          )}
        </>
      );
    },
  };
  const marks = MARKS[scenario.id];
  const originList = Object.entries(origins).filter(([z]) => marks?.origin[z]);
  const showWind = !!(wind && marks?.wind && COMPASS_TOWARD[wind.from] !== undefined);

  return (
    <figure className={`cr-map cr-map-${vocab.family}`}>
      <svg viewBox="0 0 720 400" role="img" aria-label={ARIA[scenario.id]}>
        <defs>
          <pattern id={sea} width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="10" stroke="currentColor" strokeOpacity="0.14" strokeWidth="1" />
          </pattern>
          <ImpactPattern id={impact} vocab={vocab} />
        </defs>
        <Draw {...board} />
        {originList.map(([z, label]) => {
          const [ox, oy] = marks!.origin[z];
          return (
            <g key={z} className={`cr-map-origin${fresh.origins.includes(z) ? ' is-fresh' : ''}`} transform={`translate(${ox}, ${oy})`}>
              <path className="cr-map-origin-star" d="M0 -8V8M-8 0H8M-5.6 -5.6L5.6 5.6M-5.6 5.6L5.6 -5.6" />
              <text x="12" y="5">{label}</text>
            </g>
          );
        })}
        {showWind && <WindMark at={marks!.wind!} from={wind!.from} by={wind!.by} fresh={fresh.wind} />}
      </svg>
      {/* The key: the four states as the progression they are (a zone only
          ever moves rightward along it, and may skip a step when the cited
          traffic does), then your own mark, set apart. Each swatch is drawn
          with the board's own strokes and pattern, so key and plate match. */}
      <figcaption className="cr-map-legend">
        <span className="cr-map-legend-scale">
          {(['quiet', 'watch', 'signal', 'impact'] as ZoneState[]).map((s, i) => (
            <span key={s} className="cr-leg">
              <span className="cr-leg-track" aria-hidden>
                <svg className={`cr-leg-swatch cr-zone is-${s}`} viewBox="0 0 18 12">
                  <rect className="cr-zone-shape" x="1.5" y="1.5" width="15" height="9"
                    style={{ fill: s === 'impact' ? `url(#${impact})` : undefined }} />
                </svg>
                {i < 3 && <span className="cr-leg-arrow" />}
              </span>
              <span className="cr-leg-name">{vocab.states[s]}</span>
            </span>
          ))}
        </span>
        <span className="cr-leg cr-leg-you">
          <svg className="cr-leg-swatch cr-zone is-warned" viewBox="0 0 18 12" aria-hidden>
            <rect className="cr-zone-shape" x="2" y="2" width="14" height="8" />
          </svg>
          warned by you
        </span>
        {originList.length > 0 && (
          <span className="cr-leg cr-leg-mark">
            <svg className="cr-leg-swatch" viewBox="-9 -9 18 18" aria-hidden>
              <path className="cr-map-origin-star" d="M0 -7V7M-7 0H7M-5 -5L5 5M-5 5L5 -5" />
            </svg>
            where the record first places {vocab.originNoun}
          </span>
        )}
        {note && <span className="cr-map-note">{note}</span>}
      </figcaption>
    </figure>
  );
}

/** True when a day has a hand-drawn board. */
export const hasBoard = (id: string) => id in BOARDS;

/**
 * The select screen's plate: the same hand-drawn board, geography only.
 * Every zone is drawn quiet, nothing is warned, no mark is stamped and no
 * label is set (the card says where it is), so the miniature tells the
 * player nothing about how the day went: only the shape of the ground the
 * desk will watch. The title band is cropped off. Decorative.
 */
export function BoardMiniature({ id, className }: { id: string; className?: string }) {
  const uid = useId().replace(/:/g, '');
  const Draw = BOARDS[id];
  if (!Draw) return null;
  const sea = `cr-mini-sea-${uid}`;
  const board: Board = {
    st: () => 'quiet',
    warned: () => false,
    zoneClass: () => 'cr-zone is-quiet',
    fill: () => undefined,
    word: () => '',
    sea,
    shape: (_z, d) => <path className="cr-zone-shape" d={d} />,
  };
  return (
    <svg className={`cr-mini ${className ?? ''}`} viewBox="0 52 720 348" aria-hidden focusable="false">
      <defs>
        <pattern id={sea} width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="10" stroke="currentColor" strokeOpacity="0.18" strokeWidth="1.4" />
        </pattern>
      </defs>
      <Draw {...board} />
    </svg>
  );
}

const ARIA: Record<string, string> = {
  'valencia-dana-2024': 'Schematic map of the province of Valencia showing the state of the at-risk basins',
  'lahaina-2023': 'Schematic map of Lahaina on the West Maui coast, with an inset of Upcountry Maui, showing the state of the at-risk zones',
};

/** Water: a wave hatch. Fire: rows of small flame ticks. Both in ember. */
function ImpactPattern({ id, vocab }: { id: string; vocab: HazardVocab }) {
  if (vocab.family === 'fire') {
    return (
      <pattern id={id} width="14" height="12" patternUnits="userSpaceOnUse">
        <path d="M2 10.5L5 3.5L8 10.5" fill="none" stroke="var(--ember)" strokeOpacity="0.55" strokeWidth="1.2" strokeLinejoin="round" />
      </pattern>
    );
  }
  return (
    <pattern id={id} width="12" height="8" patternUnits="userSpaceOnUse">
      <path d="M0 4c2-2.4 4-2.4 6 0s4 2.4 6 0" fill="none" stroke="var(--ember)" strokeOpacity="0.55" strokeWidth="1.2" />
    </pattern>
  );
}

/** The wind as a cited forecast states it, set in the plate's title band
 *  (clear of every road and zone): an arrow blowing the stated way, three
 *  streaks behind it, and the direction in words with the hour it was last
 *  stated on the desk. Drawn only when an item carries `wind`, which the
 *  build allows only where the text says "<direction> winds". */
function WindMark({ at, from, by, fresh }: { at: [number, number]; from: string; by: string; fresh: boolean }) {
  const [x, y] = at;
  const toward = COMPASS_TOWARD[from];
  return (
    <g className={`cr-map-wind${fresh ? ' is-fresh' : ''}`}>
      {/* the arrow is drawn pointing north, then turned to where the wind blows */}
      <g transform={`translate(${x - 218}, ${y + 6}) rotate(${toward})`}>
        <path className="cr-map-wind-arrow" d="M0 14V-14M-6 -7L0 -14L6 -7" pathLength={1} />
        <path className="cr-map-wind-streak" d="M-9 4v10M9 4v10" pathLength={1} />
      </g>
      <text className="cr-map-wind-label" x={x} y={y + 2} textAnchor="end">{`${COMPASS_WORD[from].toUpperCase()} WINDS`}</text>
      <text className="cr-map-scale" x={x} y={y + 18} textAnchor="end">{`NWS · AS OF ${by}`}</text>
    </g>
  );
}

/** The plate's title block: a paper band ruled off the top of the board, so
 *  no coastline, road or river ever runs through the title. */
function PlateHead({ title }: { title: string }) {
  return (
    <g className="cr-map-platehead">
      <rect x="0" y="0" width="720" height="52" className="cr-map-plateband" />
      <line x1="0" y1="52" x2="720" y2="52" className="cr-map-platerule" />
      <text className="cr-map-plate" x="16" y="25">{title}</text>
      <text className="cr-map-scale" x="16" y="42">SCHEMATIC · NOT TO SCALE</text>
    </g>
  );
}

function North({ x, y }: { x: number; y: number }) {
  return (
    <g className="cr-map-north" transform={`translate(${x}, ${y})`}>
      <path d="M0 6L4 -8L8 6L4 2z" />
      <text x="14" y="4">N</text>
    </g>
  );
}

/* ── Valencia, 29 October 2024 ──────────────────────────────────────────── */

function ValenciaBoard({ zoneClass, shape, word, warned, sea }: Board) {
  return (
    <>
      {/* The sea and the coast */}
      <path d="M652 0c-10 40 8 70-4 108s6 66-6 104 8 72-2 110 4 52 0 78h80V0z" fill={`url(#${sea})`} />
      <path d="M652 0c-10 40 8 70-4 108s6 66-6 104 8 72-2 110 4 52 0 78" className="cr-map-coast" />
      <text className="cr-map-sea-label" x="688" y="200" transform="rotate(90 688 200)" textAnchor="middle">MEDITERRANEAN</text>

      {/* Albufera lagoon */}
      <ellipse cx="600" cy="312" rx="34" ry="22" className="cr-map-water" />
      <text className="cr-map-minor" x="628" y="356" textAnchor="end">L&apos;ALBUFERA</text>

      {/* Valencia city */}
      <rect x="586" y="120" width="40" height="34" className="cr-map-city" />
      <text className="cr-map-label" x="626" y="110" textAnchor="end">VALÈNCIA</text>

      {/* ZONE — Magro basin: Utiel, Requena, the Forata dam */}
      <g className={zoneClass('magro-utiel')}>
        {shape('magro-utiel', 'M40 96l150-34 96 44 40 74-48 68-128-2-94-68z')}
        {/* the Magro, down through Forata and on south towards the Júcar */}
        <path className="cr-map-river" d="M56 132c40-6 74-22 108-14s52 34 74 44 44 24 56 46 6 50 4 90-4 70 0 102" />
        <rect x="272" y="188" width="18" height="7" className="cr-map-dam" transform="rotate(28 281 191)" />
        <text className="cr-map-minor" x="334" y="196">FORATA DAM</text>
        <circle cx="96" cy="122" r="4" className="cr-map-town" />
        <text className="cr-map-minor" x="96" y="108" textAnchor="middle">UTIEL</text>
        <circle cx="152" cy="140" r="4" className="cr-map-town" />
        <text className="cr-map-minor" x="152" y="162" textAnchor="middle">REQUENA</text>
        <text className="cr-zone-label" x="128" y="184">MAGRO BASIN</text>
        <text className="cr-zone-state" x="128" y="201">{word('magro-utiel')}</text>
        {warned('magro-utiel') && <text className="cr-zone-state cr-zone-warned" x="128" y="217">WARNED BY YOU</text>}
      </g>

      {/* ZONE — Rambla del Poyo and the Horta Sud towns. The zone runs east
          to the lagoon so the towns can be named clear of the ravine. */}
      <g className={zoneClass('poyo-horta-sud')}>
        {shape('poyo-horta-sud', 'M336 236L460 200L612 214L618 276L568 296L476 356L346 326z')}
        {/* the ravine, west hills to the Albufera */}
        <path className="cr-map-river cr-map-rambla" d="M340 250c30-16 58-24 88-22s58 16 86 26 52 26 66 40" />
        <circle cx="500" cy="248" r="4" className="cr-map-town" />
        <text className="cr-map-minor" x="508" y="236">PAIPORTA</text>
        <circle cx="536" cy="276" r="4" className="cr-map-town" />
        <text className="cr-map-minor" x="528" y="281" textAnchor="end">CATARROJA</text>
        <circle cx="556" cy="296" r="4" className="cr-map-town" />
        <text className="cr-map-minor" x="548" y="301" textAnchor="end">ALFAFAR</text>
        <text className="cr-zone-label" x="352" y="262">RAMBLA DEL POYO</text>
        <text className="cr-zone-label" x="352" y="278">HORTA SUD</text>
        <text className="cr-zone-state" x="352" y="295">{word('poyo-horta-sud')}</text>
        {warned('poyo-horta-sud') && <text className="cr-zone-state cr-zone-warned" x="352" y="311">WARNED BY YOU</text>}
      </g>

      <PlateHead title="PROVINCE OF VALENCIA — OPERATIONS BOARD" />
      <North x={30} y={366} />
    </>
  );
}

/* ── Lahaina and Upcountry Maui, 8 August 2023 ───────────────────────────
   Main panel: the West Maui shore, ocean to the west — Front Street along
   the water, Honoapiʻilani Highway (30) inland of it, the Lahaina Bypass
   higher up the slope, Lahainaluna Road climbing from the shore through
   both. Inset: Upcountry on the slope of Haleakalā, across the isthmus and
   not to the same scale. */

function LahainaBoard({ zoneClass, shape, word, warned, sea }: Board) {
  return (
    <>
      {/* The ocean and the West Maui shore */}
      <path d="M108 0c-8 34 8 58-2 92s12 60 2 96 10 62 0 98 8 66-4 114H0V0z" fill={`url(#${sea})`} />
      <path d="M108 0c-8 34 8 58-2 92s12 60 2 96 10 62 0 98 8 66-4 114" className="cr-map-coast" />
      <text className="cr-map-sea-label" x="50" y="236" transform="rotate(-90 50 236)" textAnchor="middle">PACIFIC OCEAN</text>

      {/* The West Maui Mountains, mauka — kept clear of the Bypass's swing */}
      <g className="cr-map-ridge">
        <path d="M444 74l14-14 14 14M452 136l14-14 14 14M444 198l14-14 14 14M452 304l14-14 14 14M444 362l14-14 14 14" />
      </g>
      <text className="cr-map-minor" x="482" y="214" transform="rotate(90 482 214)" textAnchor="middle">WEST MAUI MTS</text>

      {/* ZONE — Front Street, Kahoma and the waterfront: shore to the highway */}
      <g className={zoneClass('lahaina-front-street')}>
        {shape('lahaina-front-street', 'M114 104L244 100L246 344L108 348c6-30 0-58 4-86s-6-56 2-92-8-40 0-66z')}
        <text className="cr-zone-label" x="128" y="130">FRONT STREET</text>
        <text className="cr-zone-label" x="128" y="146">WATERFRONT</text>
        <text className="cr-zone-state" x="128" y="163">{word('lahaina-front-street')}</text>
        {warned('lahaina-front-street') && <text className="cr-zone-state cr-zone-warned" x="128" y="179">WARNED BY YOU</text>}
      </g>

      {/* ZONE — Lahainaluna and Kelawea: the slope between Highway 30 and the Bypass */}
      <g className={zoneClass('lahaina-lahainaluna')}>
        {shape('lahaina-lahainaluna', 'M256 166L380 174L396 298L258 322z')}
        <text className="cr-zone-label" x="266" y="192">LAHAINALUNA</text>
        <text className="cr-zone-label" x="266" y="208">KELAWEA</text>
        <text className="cr-zone-state" x="266" y="225">{word('lahaina-lahainaluna')}</text>
        {warned('lahaina-lahainaluna') && <text className="cr-zone-state cr-zone-warned" x="266" y="241">WARNED BY YOU</text>}
      </g>

      {/* Roads, drawn over the zones; road names set a size below place names */}
      <path className="cr-map-road" d="M120 104c-4 40 4 74-2 110s4 70 0 120" />
      <text className="cr-map-roadname" x="138" y="342" transform="rotate(-90 138 342)">FRONT ST</text>
      <path className="cr-map-road cr-map-highway" d="M250 52c-4 50 4 98-2 156s4 132 0 192" />
      <text className="cr-map-roadname" x="258" y="352">HWY 30</text>
      <path className="cr-map-road cr-map-highway" d="M250 384C336 372 436 318 436 250S346 128 252 116" />
      <text className="cr-map-roadname" x="382" y="146">BYPASS</text>
      <path className="cr-map-road" d="M118 268c60-2 120-4 180-8s110-8 150-14" />
      <text className="cr-map-roadname" x="266" y="282">LAHAINALUNA RD</text>

      {/* Shelter on the highway north of town */}
      <rect x="244" y="76" width="12" height="12" className="cr-map-shelter" />
      <text className="cr-map-minor" x="264" y="87">CIVIC CENTER</text>
      <text className="cr-map-minor" x="262" y="68">↑ KAPALUA</text>

      {/* Inset — Upcountry, on the slope of Haleakalā */}
      <rect x="500" y="62" width="206" height="322" className="cr-map-inset" />
      <text className="cr-map-minor" x="512" y="82">INSET · UPCOUNTRY</text>
      <text className="cr-map-minor" x="512" y="98">OTHER SCALE</text>
      <g className="cr-map-contour">
        <path d="M512 336c60-28 124-42 184-44" />
        <path d="M512 362c60-24 124-36 184-38" />
      </g>
      <text className="cr-map-minor" x="694" y="372" textAnchor="end">HALEAKALĀ ↘</text>
      <circle cx="540" cy="128" r="4" className="cr-map-town" />
      <text className="cr-map-minor" x="550" y="133">PUKALANI</text>
      <text className="cr-map-minor" x="550" y="149">SHELTER</text>

      {/* ZONE — Kula and Olinda */}
      <g className={zoneClass('upcountry-kula')}>
        {shape('upcountry-kula', 'M520 176L612 156L690 166L688 280L604 300L522 276z')}
        <circle cx="664" cy="184" r="4" className="cr-map-town" />
        <text className="cr-map-minor" x="654" y="190" textAnchor="end">OLINDA</text>
        <circle cx="548" cy="263" r="4" className="cr-map-town" />
        <text className="cr-map-minor" x="558" y="268">KULA</text>
        <text className="cr-zone-label" x="532" y="212">KULA · OLINDA</text>
        <text className="cr-zone-state" x="532" y="229">{word('upcountry-kula')}</text>
        {warned('upcountry-kula') && <text className="cr-zone-state cr-zone-warned" x="532" y="245">WARNED BY YOU</text>}
      </g>

      <PlateHead title="LAHAINA, WEST MAUI — OPERATIONS BOARD" />
      <North x={60} y={372} />
    </>
  );
}
