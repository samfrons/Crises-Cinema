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
  /** Picture mode's lower third: a contiguous, character-exact fragment of
   *  `text`, at most 90 characters. Required on playable items (the build). */
  headline?: string;
  /** Warning-chain links this item shows used / cut / unused / pending. */
  chain?: ChainEntry[];
  /** The record first places the hazard in this item's one zone: the HH:MM
   *  the text states, or true for "by this decision point". */
  origin?: true | string;
  /** A wind direction the text states ("east winds"). */
  wind?: { from: string };
  /** Instrument readings the text states (vocabulary.json `readings`). */
  readings?: Reading[];
};

/** One reading of an instrument series, as a slip states it: a state whose
 *  phrase the text contains, and the time and value only where it says them. */
export type Reading = { series: string; state: string; at?: string; by?: true; value?: string };

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

export type Takeaway = {
  text: string;
  from: { finding: number } | { step: string };
  citation: Citation;
};

export type GlossaryEntry = {
  term: string;
  /** Spellings that mark the term in the slips (whole word, case-sensitive). */
  match: string[];
  kind: 'verbatim' | 'paraphrase';
  definition: string;
  translation?: string;
  citation: Citation;
};

export type AlertPredatesClock = {
  /** YYYY-MM-DD, before the scenario day; the UI counts the days from it. */
  date: string;
  /** HH:MM on that date, only where the item states it. */
  time?: string;
  /** The info item the note is drawn from. */
  from: string;
  /** One sentence restating the earlier warning, in the item's numbers. */
  note: string;
  /** What the day's first-alert HH:MM actually is ("this day's first listed IMD bulletin"). */
  clock_alert: string;
  citation: Citation;
};

/** One call of the earliest-defensible benchmark: at a decision time no
 *  earlier than its slip reaches the desk, an option that warns `zones`. */
export type BenchmarkCall = {
  time: string;
  /** The info item (slip) the call rests on. */
  from: string;
  /** The option at that decision point the call corresponds to. */
  option: string;
  zones: string[];
  /** One sentence in the slip's words. */
  basis: string;
  citation: Citation;
};

export type MinutesMatter = {
  quote: string;
  about: string;
  caveat?: string;
  publisher: string;
  license: string;
  as_of: string;
  citation: Citation;
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
  /** Instrument series id → short name, for the readings drawn on slips. */
  instruments?: Record<string, string>;
  /** One figure on the briefing — only what existed before the clock starts. */
  briefing_media?: MediaAttachment;
  timesteps: Timestep[];
  historical_path: { timestep_id: string; action: string; citation: Citation }[];
  inquiry_findings: { kind: 'verbatim' | 'paraphrase'; quote: string; translation?: string; citation: Citation }[];
  /** "What the record teaches": a lesson in the project's words, tied to one
   *  cited line (an inquiry finding by index, or a historical-path step). */
  takeaways?: Takeaway[];
  /** "Terms of the desk": official definitions of words the slips use. */
  glossary?: GlossaryEntry[];
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
    /** The earliest defensible call — a game-design benchmark, each call
     *  resting on one cited slip (README, "The reckoning"). */
    benchmark: BenchmarkCall[];
    /** Why minutes matter: cited context from elsewhere, never a conversion. */
    minutes_matter?: MinutesMatter[];
  };
  /** The real public warnings came before the one-day clock opened, so the
   *  day's first-alert HH:MM is not the officials' lead time. Drawn from one
   *  info item (`from`) that names the earlier date; the build checks it. */
  alert_predates_clock?: AlertPredatesClock;
  /** Diorama mode's ground: terrain frames and a cartographic anchor per
   *  at-risk zone (presentational; README, "The diorama"). */
  diorama?: DioramaSpec;
  sources: Source[];
};

export type DioramaPlace = { name: string; lat: number; lon: number };
export type DioramaZone = { anchor: string; radius_km: number; places: DioramaPlace[]; beyond_frame?: true };
export type DioramaSpec = {
  frames: string[];
  exaggeration: number;
  contour_m: number;
  impact_zone?: string;
  zones: Record<string, DioramaZone>;
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
