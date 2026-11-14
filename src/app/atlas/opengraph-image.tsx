import { sheet, OG_SIZE, OG_TYPE } from '../control-room/og';
import { atlas } from './atlas-routes';

export const size = OG_SIZE;
export const contentType = OG_TYPE;
export const alt = 'The Atlas of Ruin — Disasters by the Decade';

export default async function Image() {
  return sheet({ credit: 'DISASTERS BY THE DECADE', title: 'The Atlas of Ruin', line: `${atlas.places.length} named places`, phase: 'ATLAS OF RUIN' });
}
