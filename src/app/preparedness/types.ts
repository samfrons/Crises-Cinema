/**
 * The shapes of the /preparedness build artefacts.
 *
 * Everything under public/data/preparedness/ is written by the pipeline and
 * fetched at runtime, the same way the essay fetches /data/films.json. Every
 * field below is optional in practice: a layer that the pipeline could not
 * license, reach or parse ships with status "not_loaded" and no `countries`
 * block at all, and the page has to say so rather than invent a number.
 */

export type LayerId = 'inform' | 'ndgain' | 'emdat' | 'idmc' | 'spar' | 'sendai';

/** The eight hazard keys the pipeline is allowed to disaggregate by. */
export type HazardKey =
  | 'earthquake' | 'flood' | 'storm' | 'wildfire'
  | 'drought' | 'epidemic' | 'industrial' | 'conflict';

export const HAZARDS: { id: HazardKey; label: string }[] = [
  { id: 'earthquake', label: 'Earthquake' },
  { id: 'flood', label: 'Flood' },
  { id: 'storm', label: 'Storm' },
  { id: 'wildfire', label: 'Wildfire' },
  { id: 'drought', label: 'Drought' },
  { id: 'epidemic', label: 'Epidemic' },
  { id: 'industrial', label: 'Industrial' },
  { id: 'conflict', label: 'Conflict' },
];

export interface WorldCountry {
  iso3: string;
  iso2: string;
  name: string;
  /** Pre-projected SVG path in the 1000×500 equirectangular frame. */
  d: string;
  cx: number;
  cy: number;
}

export interface World {
  generated?: string;
  source?: string;
  projection?: string;
  width: number;
  height: number;
  countries: WorldCountry[];
}

export interface LayerSource {
  publisher: string;
  url?: string | null;
  license: string;
  /** Null on a layer the pipeline could not date. */
  asOf?: string | null;
  retrieved?: string | null;
  limitations?: string[];
}

/** A stub layer has no observed range yet, so `max` may be null. */
export interface LayerScale {
  min: number;
  max: number | null;
  higherIs: 'worse' | 'better';
}

export interface LayerCountry {
  score: number | null;
  components?: Record<string, number>;
  byHazard?: Partial<Record<HazardKey, number>>;
}

export interface Layer {
  id: LayerId;
  label: string;
  status: 'loaded' | 'not_loaded';
  hazardDimension: boolean;
  hazards?: HazardKey[];
  unit: string;
  scale: LayerScale;
  source: LayerSource;
  /** Present only when status is "not_loaded": how to obtain the data. */
  instructions?: string | null;
  countries?: Record<string, LayerCountry>;
}

export interface Manifest {
  generated: string;
  /** `id` is widened: the manifest also lists funding, which is not a map layer. */
  layers: { id: string; file: string; status: string; label: string }[];
}

export interface FundingAppeal {
  year: number;
  requiredUsd: number;
  fundedUsd: number;
  coverage: number;
}

export interface Funding {
  id: 'funding';
  status: 'loaded' | 'not_loaded';
  source: LayerSource;
  instructions?: string | null;
  appeals?: FundingAppeal[];
  lossAndDamage?: {
    status: 'loaded' | 'not_loaded';
    pledgedUsd?: number | null;
    neededUsd?: number | null;
    source?: LayerSource;
    instructions?: string | null;
  };
}

/** The server-rendered facts block. Written to src/data by the pipeline. */
export interface PreparednessMeta {
  generated: string;
  layersLoaded: string[];
  layersStubbed: string[];
  countryCount: number;
  appealYears: number[];
}

/* ── The layer menu ──────────────────────────────────────────────────────── */

export interface LayerChoice {
  id: LayerId;
  /** The name this page gives the layer — plain English, not the acronym. */
  label: string;
  /** The acronym, for the second line of the button. */
  short: string;
  /** One line explaining what the number actually measures. */
  gloss: string;
  /** Primary layers get the top row; the two specialist ones a second row. */
  row: 1 | 2;
}

export const LAYER_CHOICES: LayerChoice[] = [
  { id: 'inform', row: 1, label: 'Structural risk', short: 'INFORM', gloss: 'Hazard exposure, vulnerability and coping capacity, combined into one risk score.' },
  { id: 'ndgain', row: 1, label: 'Climate readiness', short: 'ND-GAIN', gloss: 'How ready a country is to convert investment into climate adaptation.' },
  { id: 'emdat', row: 1, label: 'Realised impact', short: 'EM-DAT', gloss: 'What actually happened: recorded disaster deaths and affected people.' },
  { id: 'idmc', row: 1, label: 'Displacement', short: 'IDMC', gloss: 'New internal displacements caused by disasters.' },
  { id: 'spar', row: 2, label: 'Epidemic preparedness', short: 'IHR SPAR', gloss: 'Self-assessed capacity under the International Health Regulations.' },
  { id: 'sendai', row: 2, label: 'Early-warning coverage', short: 'SENDAI G / MHEWS', gloss: 'Reported multi-hazard early-warning coverage under the Sendai Framework.' },
];

export const LAYER_IDS: LayerId[] = LAYER_CHOICES.map((l) => l.id);
