import { notFound } from 'next/navigation';
import { metadataFor, resolve, scenarioIds } from '../scenario-routes';
import ControlRoomDesk from '../Desk';

export const dynamicParams = false;
export const generateStaticParams = () => scenarioIds().map((scenario) => ({ scenario }));
export const generateMetadata = ({ params }: { params: { scenario: string } }) => metadataFor(params.scenario);

export default function ScenarioPage({ params }: { params: { scenario: string } }) {
  const r = resolve(params.scenario);
  if (!r) notFound();
  return <ControlRoomDesk entry={{ scenario: r.scenario.id, phase: 'briefing' }} />;
}
