import { notFound } from 'next/navigation';
import { sheet, OG_SIZE, OG_TYPE } from '../../og';
import { allParams, sheetFor } from '../../scenario-routes';

export const size = OG_SIZE;
export const contentType = OG_TYPE;
export const dynamicParams = false;
export const alt = 'The Control Room — Disasters by the Decade';
export const generateStaticParams = allParams;

export default async function Image({ params }: { params: { scenario: string; phase: string } }) {
  const s = sheetFor(params.scenario, params.phase);
  if (!s) notFound();
  return sheet(s);
}
