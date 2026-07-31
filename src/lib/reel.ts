// Shapes of src/data/reel.json, the committed manifest built by
// scripts/build-reel.mjs. The site never queries archive.org at runtime —
// everything the /reel page knows about a clip is in here, provenance included.

import type { FamilyId } from './taxonomy';

export interface ReelSource {
  identifier: string;
  itemUrl: string;
  file: string;
  fileSizeMB: number | null;
  itemDate: string | null;
  licenseUrl: string | null;
  rights: string | null;
  possibleCopyrightStatus: string | null;
  collections: string[];
  /** The sentence that clears the clip — always age-based, never a license tag. */
  pdBasis: string;
  note: string | null;
}

export interface ReelClip {
  id: string;
  /** 'dataset' = a film from the main set; 'archive' = adjacent actuality footage. */
  kind: 'dataset' | 'archive';
  title: string;
  year: number;
  family: FamilyId;
  blurb: string;
  /** Plain-text description of what the footage shows (also the a11y text). */
  what: string;
  audioNote: string;
  /** Seek offset in seconds — features open on their disaster sequence. */
  startAt: number;
  /** Soft-loop length in seconds while the clip plays unattended; 0 = play through. */
  window: number;
  duration: number | null;
  width: number | null;
  height: number | null;
  /** Primary download URL first, then the item's two mirror nodes. */
  srcs: string[];
  poster: string | null;
  source: ReelSource;
}

export interface ReelManifest {
  generated: string;
  policy: string;
  clips: ReelClip[];
  rejected: {
    films: { title: string; year: number; reason: string }[];
    items: { identifier: string; reason: string; itemUrl: string }[];
  };
}

/** Short human label for the license tag recorded on the source item. */
export function licenseLabel(url: string | null): string {
  if (!url) return 'no license tag';
  if (url.includes('publicdomain/mark')) return 'Public Domain Mark 1.0';
  if (url.includes('publicdomain/zero')) return 'CC0 1.0';
  if (url.includes('licenses/publicdomain')) return 'CC Public Domain';
  const cc = url.match(/licenses\/([a-z-]+)\/([\d.]+)/);
  if (cc) return `CC ${cc[1].toUpperCase()} ${cc[2]}`;
  return url;
}

export const timestamp = (s: number): string => {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
    : `${m}:${String(sec).padStart(2, '0')}`;
};
