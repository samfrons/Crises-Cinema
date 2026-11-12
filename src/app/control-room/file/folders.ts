/**
 * The desk officer's file — the addresses the game and the file share.
 *
 * Client-safe and tiny on purpose: the desk imports it to send a player to a
 * folder (and to recognise a player the file sent to a desk) without pulling
 * the essay or the scenario bundle into the game's client chunk. The file's
 * text lives only in src/data/essay.json; nothing here repeats it.
 */
import { inWords } from '../summary';

/** The six folders, one per essay section, in essay order. */
export const FOLDER_IDS = ['a', 'b', 'c', 'd', 'e', 'f'] as const;
export type FolderId = (typeof FOLDER_IDS)[number];

export const isFolder = (x: string | null | undefined): x is FolderId =>
  !!x && (FOLDER_IDS as readonly string[]).includes(x);

/** "b" → "Two": the folder's number in words, as the file's tabs print it. */
export const folderWord = (id: FolderId) => inWords(FOLDER_IDS.indexOf(id) + 1);

export const FILE_PATH = '/control-room/file';
export const folderHref = (id: FolderId) => `${FILE_PATH}#file-${id}`;

/**
 * A link that opens a day's briefing on the desk, carrying which folder sent
 * the player and (optionally) which decision it points at. The hash is read
 * once by the game on arrival; history still runs from the day's opening.
 */
export function deskHref(scenario: string, folder: FolderId, step?: string) {
  const p = new URLSearchParams({ day: scenario });
  if (step) p.set('at', step);
  p.set('file', folder);
  return `/control-room#${p.toString()}`;
}

/** Which folder demonstrates a playable day — where the debrief's bridge
 *  sends a player who has just held it. Both playable days are clocked in
 *  folder Two ("The last mile"); a day not listed falls back to the cover. */
export const DAY_FOLDER: Record<string, FolderId> = {
  'lahaina-2023': 'b',
  'valencia-dana-2024': 'b',
};
