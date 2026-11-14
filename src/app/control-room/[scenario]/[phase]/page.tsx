import { notFound } from 'next/navigation';
import { allParams, metadataFor, resolve } from '../../scenario-routes';
import ControlRoomDesk from '../../Desk';

type P = { params: { scenario: string; phase: string } };

export const dynamicParams = false;
export const generateStaticParams = allParams;
export const generateMetadata = ({ params }: P) => metadataFor(params.scenario, params.phase);

export default function ScenarioPhasePage({ params }: P) {
  const r = resolve(params.scenario, params.phase);
  if (!r) notFound();
  return <ControlRoomDesk entry={{ scenario: r.scenario.id, phase: r.phase ?? 'briefing' }} />;
}
