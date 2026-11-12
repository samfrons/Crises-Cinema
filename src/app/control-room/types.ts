/** Types mirroring the scenario schema documented in data/scenarios/README.md. */

export type Citation = { sourceId: string; detail?: string };

/**
 * A cited figure: an image or a short video, printed in the log under the item
 * it belongs to (or on the briefing / in the debrief). The build refuses one
 * whose licence is a placeholder or whose file is missing from
 * public/control-room/<scenario-id>/. Extra research fields (bytes, takenOn,
 * licenseVerifiedOn, durationSeconds…) may ride along; the UI ignores them.
 */
export type MediaAttachment = {
  /** File name under public/control-room/<scenario-id>/. */
  file: string;
  type: 'image' | 'video';
  /** Stands on its own: date and what it shows. Also the image's alt text. */
  caption: string;
  credit: string;
  license: string;
  licenseUrl?: string;
  sourcePage: string;
  width: number;
  height: number;
  /** Video only: a still under the same folder. */
  poster?: string;
  takenOn?: string;
  durationSeconds?: number;
};

/** How a cited item lights its zones on the board. Omitted → the hazard's
 *  default for the item's kind; 'none' → it is zoned but lights nothing. */
export type BoardState = 'none' | 'watch' | 'signal' | 'impact';

/** The links of the warning chain (vocabulary.json `chain.links`): the
 *  forecast reaching the desk, then each public channel out of it. */
export type ChainLink = 'forecast' | 'siren' | 'phone' | 'broadcast' | 'social';
/** used: the record shows the link carrying a warning · cut: the channel
 *  failed · unused: the record says it was not used · pending: being drafted. */
export type ChainState = 'used' | 'cut' | 'unused' | 'pending';
export type ChainEntry = { link: ChainLink; state: ChainState; at?: string; zones?: string[] };

export type InfoItem = {
  id: string;
  kind: 'forecast' | 'gauge' | 'message' | 'media' | 'field_report';
  text: string;
  citation: Citation;
  /** At-risk zone ids this item concerns — lights the ops board, nothing more. */
  zones?: string[];
  board_state?: BoardState;
  media?: MediaAttachment;
  /* Presentational restatements of the item's own text — each is gated by
     the build so it can say nothing the text does not (README, "Pictograms,
     the warning chain and the board marks"). */
  /** Slip pictogram (vocabulary.json `icons`). */
  icon?: string;
  /** Warning-chain links this item shows used / cut / unused / pending. */
  chain?: ChainEntry[];
  /** The record first places the hazard in this item's one zone: the HH:MM
   *  the text states, or true for "by this decision point". */
  origin?: true | string;
  /** A wind direction the text states ("east winds"). */
  wind?: { from: string };
};

export type WarningScope = 'none' | 'targeted' | 'province';

export type OptionEffects = {
  warning_scope: WarningScope;
  zones: string[];
  protective: boolean;
  false_alarm_weight: number;
};

export type Consequence =
  | { known: true; text: string; citation: Citation }
  | { known: false };

export type Option = {
  id: string;
  label: string;
  detail?: string;
  effects: OptionEffects;
  consequence: Consequence;
};

export type Timestep = {
  id: string;
  time: string;
  time_label: string;
  approx: boolean;
  info_available: InfoItem[];
  options: Option[];
  historical_option_id: string | null;
  historical_citation?: Citation;
};

export type Source = { id: string; label: string; url: string | null; note?: string | null };

export type Scenario = {
  id: string;
  status: 'playable';
  title: string;
  date: string;
  location: string;
  hazard: string;
  clock: { timezone: string; start: string; end: string };
  record_caveat: string;
  /** Short names for the warning-chain diagram's nodes and zones. */
  warning_chain?: { labels?: Partial<Record<'desk' | ChainLink, string>>; zones?: Record<string, string> };
  /** One figure on the briefing — only what existed before the clock starts. */
  briefing_media?: MediaAttachment;
  timesteps: Timestep[];
  historical_path: { timestep_id: string; action: string; citation: Citation }[];
  inquiry_findings: { kind: 'verbatim' | 'paraphrase'; quote: string; translation?: string; citation: Citation }[];
  /** Figures from after the last decision — shown only once the log closes. */
  debrief_media?: MediaAttachment[];
  outcome: {
    deaths: { min: number; max: number; contested: boolean; note?: string };
    citation: Citation;
  };
  scoring: {
    impact: { time: string; label: string; citation: Citation; window_minutes?: number };
    at_risk_zones: { id: string; label: string }[];
    historical_first_public_alert: string;
  };
  sources: Source[];
};

export type ScenarioStub = {
  id: string;
  status: 'stub';
  title: string;
  date: string;
  location: string;
  hazard: string;
};

export type ScenarioBundle = { generated: string; playable: Scenario[]; stubs: ScenarioStub[] };
