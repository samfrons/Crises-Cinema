import { notFound } from 'next/navigation';
import { sheet, OG_SIZE, OG_TYPE } from '../og';
import { scenarioIds, sheetFor } from '../scenario-routes';

export const size = OG_SIZE;
export const contentType = OG_TYPE;
export const dynamicParams = false;
export const alt = 'The Control Room — Disasters by the Decade';
export const generateStaticParams = () => scenarioIds().map((scenario) => ({ scenario }));

export default async function Image({ params }: { params: { scenario: string } }) {
  const s = sheetFor(params.scenario);
  if (!s) notFound();
  return sheet(s);
}
