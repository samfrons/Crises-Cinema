import { sheet, OG_SIZE, OG_TYPE } from './og';

export const size = OG_SIZE;
export const contentType = OG_TYPE;
export const alt = 'The Control Room — Disasters by the Decade';

export default async function Image() {
  return sheet({
    title: 'The Control Room',
    line: 'YOU ARE THE EMERGENCY CHIEF',
    phase: 'THE CLOCK IS REAL',
  });
}
