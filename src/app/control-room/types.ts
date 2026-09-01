/** Types mirroring the scenario schema documented in data/scenarios/README.md. */

export type Citation = { sourceId: string; detail?: string };

export type InfoItem = {
  id: string;
  kind: 'forecast' | 'gauge' | 'message' | 'media' | 'field_report';
  text: string;
  citation: Citation;
  /** At-risk zone ids this item concerns — lights the ops board, nothing more. */
  zones?: string[];
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
  timesteps: Timestep[];
  historical_path: { timestep_id: string; action: string; citation: Citation }[];
  inquiry_findings: { kind: 'verbatim' | 'paraphrase'; quote: string; translation?: string; citation: Citation }[];
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
