import { notFound } from 'next/navigation';
import { sheet, OG_SIZE, OG_TYPE } from '../../../control-room/og';
import { CASE_STUDIES } from '../../caseStudies';

export const size = OG_SIZE;
export const contentType = OG_TYPE;
export const dynamicParams = false;
export const alt = 'The Last Mile — Disasters by the Decade';
export const generateStaticParams = () => CASE_STUDIES.map((c) => ({ id: c.id }));

export default async function Image({ params }: { params: { id: string } }) {
  const c = CASE_STUDIES.find((x) => x.id === params.id);
  if (!c) notFound();
  return sheet({ credit: 'DISASTERS BY THE DECADE', title: c.title, line: `${c.place.toUpperCase()} · ${c.year}`, phase: 'THE LAST MILE' });
}
