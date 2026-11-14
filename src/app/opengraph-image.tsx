import { sheet, OG_SIZE, OG_TYPE } from './control-room/og';

export const size = OG_SIZE;
export const contentType = OG_TYPE;
export const alt = 'Disasters by the Decade — According to Hollywood';

export default function Image() {
  return sheet({
    credit: 'CRISESCINEMA.STORYTIMEMAPS.COM',
    phase: 'A DATA ESSAY',
    title: 'Disasters by the Decade',
    line: 'ACCORDING TO HOLLYWOOD',
  });
}
