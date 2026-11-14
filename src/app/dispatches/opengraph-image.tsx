import { sheet, OG_SIZE, OG_TYPE } from '../control-room/og';

export const size = OG_SIZE;
export const contentType = OG_TYPE;
export const alt = 'Dispatches from the Ground — Disasters by the Decade';

export default async function Image() {
  return sheet({ credit: 'DISASTERS BY THE DECADE',
    title: 'Dispatches from the Ground',
    line: 'DISASTERS BY THE DECADE',
    phase: 'DISPATCHES FROM THE GROUND',
  });
}
