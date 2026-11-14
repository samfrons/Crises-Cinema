import type { Metadata } from 'next';
import atlasData from '../../data/atlas.json';
import { abs } from '@/lib/site';
import type { Atlas, Selection } from './AtlasView';

export const atlas = atlasData as unknown as Atlas;
export type Kind = 'place' | 'realm';

/** Ids in atlas.json are already kebab-case, so slug === id. */
export const idsFor = (kind: Kind) => (kind === 'place' ? atlas.places : atlas.realms).map((x) => x.id);

export function find(kind: string, id: string) {
  if (kind === 'place') return atlas.places.find((p) => p.id === id) ?? null;
  if (kind === 'realm') return atlas.realms.find((r) => r.id === id) ?? null;
  return null;
}

export const selectionFor = (kind: Kind, id: string): Selection => (find(kind, id) ? { kind, id } : null);

export function describe(kind: Kind, id: string) {
  const x = find(kind, id);
  if (!x) return null;
  const n = x.films.length;
  const films = `${n} ${n === 1 ? 'film' : 'films'}`;
  const description = kind === 'realm'
    ? `${x.label} in the Atlas of Ruin: ${(x as { blurb: string }).blurb}. ${films} in the catalogue.`
    : `${x.label} in the Atlas of Ruin: ${films} in the catalogue pin their catastrophe here, exactly where the synopses put it.`;
  return { name: x.label, description, line: films };
}

export function metadataFor(kind: Kind, id: string): Metadata {
  const d = describe(kind, id);
  if (!d) return {};
  const title = `${d.name} — The Atlas of Ruin`;
  const url = abs(`/atlas/${kind}/${id}`);
  return {
    title,
    description: d.description,
    alternates: { canonical: url },
    openGraph: { title, description: d.description, url, type: 'article', siteName: 'Disasters by the Decade' },
    twitter: { card: 'summary_large_image', title, description: d.description },
  };
}
