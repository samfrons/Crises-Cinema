import { notFound } from 'next/navigation';
import { sheet, OG_SIZE, OG_TYPE } from '../../../control-room/og';
import { describe, idsFor } from '../../atlas-routes';

export const size = OG_SIZE;
export const contentType = OG_TYPE;
export const dynamicParams = false;
export const alt = 'The Atlas of Ruin — Disasters by the Decade';
export const generateStaticParams = () => idsFor('realm').map((id) => ({ id }));

export default async function Image({ params }: { params: { id: string } }) {
  const d = describe('realm', params.id);
  if (!d) notFound();
  return sheet({ credit: 'DISASTERS BY THE DECADE', title: d.name, line: d.line, phase: 'ATLAS OF RUIN' });
}
