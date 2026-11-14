import { sheet, OG_SIZE, OG_TYPE } from '../control-room/og';

export const size = OG_SIZE;
export const contentType = OG_TYPE;
export const alt = 'The Last Mile — Disasters by the Decade';

export default async function Image() {
  return sheet({ credit: 'DISASTERS BY THE DECADE',
    title: 'The Last Mile',
    line: 'EVERYTHING WORKS UNTIL THE WARNING HAS TO REACH A PERSON',
    phase: 'A FIELD REPORT',
  });
}
