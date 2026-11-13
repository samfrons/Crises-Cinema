import scenariosData from '../../data/scenarios.json';
import { abs } from '@/lib/site';
import type { Metadata } from 'next';
import type { ScenarioBundle } from './types';
import { PHASES, PHASE_LABEL, isPhase, type Phase } from './phases';

const playable = (scenariosData as unknown as ScenarioBundle).playable;

export const scenarioIds = () => playable.map((s) => s.id);
export const allParams = () => playable.flatMap((s) => PHASES.map((p) => ({ scenario: s.id, phase: p })));

/** The scenario and phase a URL names, or null (the route 404s). */
export function resolve(id: string, phase?: string) {
  const scenario = playable.find((s) => s.id === id);
  if (!scenario || (phase !== undefined && !isPhase(phase))) return null;
  return { scenario, phase: phase as Phase | undefined };
}

export function metadataFor(id: string, phase?: string): Metadata {
  const r = resolve(id, phase);
  if (!r) return {};
  const { scenario: s } = r;
  const title = `${s.title}${r.phase ? ` · ${PHASE_LABEL[r.phase]}` : ''} — The Control Room`;
  const description = `${s.location}, ${s.date} (${s.hazard}). You are the emergency chief on the real clock: `
    + 'you see only what officials knew at each moment, and the debrief sets your calls beside the record.';
  const url = abs(`/control-room/${[s.id, r.phase].filter(Boolean).join('/')}`);
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, type: 'article', siteName: 'Disasters by the Decade' },
    twitter: { card: 'summary_large_image', title, description },
  };
}

export function sheetFor(id: string, phase?: string) {
  const r = resolve(id, phase);
  if (!r) return null;
  return {
    title: r.scenario.title,
    line: `${r.scenario.location.toUpperCase()} · ${r.scenario.date}`,
    phase: r.phase ? PHASE_LABEL[r.phase].toUpperCase() : 'THE REAL CLOCK',
  };
}
