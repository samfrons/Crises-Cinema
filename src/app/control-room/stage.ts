/**
 * The desk's staging clock: one table of timings that the CSS choreography
 * (control-room.css, "Staging") and the JS that sequences it (the boot and
 * the advance beat in ControlRoomGame, the sound layer) both follow. If a
 * number changes here, change its twin in the CSS — each is named there.
 *
 * Nothing here is record content. The odometer frames are clock positions
 * the console rolls through on its way to a time the record holds; only
 * the last frame is that time, and it is the only one announced.
 */

/** Press → the new timecode stamps (CSS: --beat on the new entry). */
export const BEAT_MS = 720;
/** When the beat's staging attributes are cleared (all arrivals are down). */
export const BEAT_CLEAR_MS = 1900;
/** The console odometer during the beat (CSS: none; set inline). */
export const ROLL_AT = 100;
export const ROLL_MS = 560;

/** The opening overture, first desk of the session. */
export const BOOT_MS = 2400;
export const BOOT_QUICK_MS = 520;
/** Reduced motion: how long the overture's still "struck twice" mark holds. */
export const BOOT_STILL_MS = 900;
export const BOOT_ROLL_AT = 420;
export const BOOT_ROLL_MS = 680;

/** A slip's leader line starts printing (CSS: .cr-slip --at). */
export const leaderAt = (i: number) => 80 + Math.min(i * 110, 440);
/** …and takes this long, one character per step (CSS: .cr-slip --type). */
export const leaderMs = (chars: number) => Math.min(chars * 16, 300);
/** The type-bar ticks under a leader: one every this many ms. */
export const TICK_SPACING = 28;

/** The toll's settle on the debrief band lands here after the band mounts
 *  (CSS: .cr-toll-number, 640ms delay + most of its 350ms set). */
export const TOLL_LAND_MS = 900;

const toMin = (t: string) => {
  const m = /(\d{1,2}):(\d{2})/.exec(t);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};
const fmt = (min: number) => {
  const h = Math.floor(min / 60) % 24;
  return `${String(h).padStart(2, '0')}:00`;
};

/**
 * The odometer's frames from one clock time to the next: the time it leaves,
 * each whole hour it passes (at most `maxMid`, at an even stride when the
 * jump is longer), and the time it lands on, exactly as the record prints it.
 */
export function reelFrames(from: string, to: string, maxMid = 6): string[] {
  const a = toMin(from);
  let b = toMin(to);
  if (a === null || b === null || a === b) return [to];
  if (b < a) b += 24 * 60;
  const hours: number[] = [];
  for (let h = Math.floor(a / 60) * 60 + 60; h < b; h += 60) hours.push(h);
  // A long jump keeps an even stride (every second or third hour), always
  // ending on the last hour before the landing time.
  const stride = Math.ceil(hours.length / maxMid);
  const mid = hours.filter((_, i) => (hours.length - 1 - i) % stride === 0);
  return [from, ...mid.map(fmt), to];
}
