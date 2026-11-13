/**
 * The stage's contract between its controller (PictureStage) and the two
 * viewports that draw it: the hand-drawn board and the diorama. The
 * controller derives everything (the run at this beat, what is new, where
 * the camera should look); a viewport only draws it.
 */
import type { InfoItem, Scenario } from './types';
import type { deriveBoard } from './board';
import { KindGlyph, Pictogram, hasPictogram } from './glyphs';

export type Rect = { x: number; y: number; w: number; h: number };
export type Tray = { side: 'left' | 'top'; edge: number };

/** Where the camera should look, in the record's terms (zones, not pixels);
 *  each viewport turns it into its own framing. */
export type StageIntent = {
  shot: 'establish' | 'wide' | 'slip' | 'origin' | 'call' | 'record' | 'end';
  /** The zones the shot frames (none: the whole ground). */
  zones: string[];
};

/** A slip's pictogram stamped at one of its zones (zones get one stamp each). */
export type Stamp = { key: string; z: string; k: number; n: number; glyph: string; state: 'active' | 'past' | 'set' };
export const glyphKey = (info: InfoItem) => (hasPictogram(info.icon) ? `icon:${info.icon}` : `kind:${info.kind}`);
export function GlyphFor({ glyph, size }: { glyph: string; size: number }) {
  const [kind, name] = glyph.split(':');
  return kind === 'icon' ? <Pictogram name={name} size={size} /> : <KindGlyph kind={name} size={size} />;
}

export type Phase = 'brief' | 'beats' | 'call' | 'record' | 'done';

/** What a viewport is handed: the derived run at this beat, and the intent. */
export type ViewportProps = {
  scenario: Scenario;
  phase: Phase;
  cursor: number;
  /** Changes with every beat of the stage (a new slip, the call, the record). */
  beat: string;
  rm: boolean;
  playing: boolean;
  board: ReturnType<typeof deriveBoard>;
  fresh: { zones: string[]; origins: string[]; wind: boolean };
  preview: string[] | null;
  warnedNow: string[];
  spot: string[] | undefined;
  intent: StageIntent;
  stamps: Stamp[];
  safe: Rect | null;
  tray: Tray | null;
  /** The desk's overture, while it runs (the diorama raises its ground on it). */
  boot: 'full' | 'quick' | null;
  /** The viewport cannot draw here (the diorama without WebGL): fall back. */
  onFail: (why: string) => void;
};
