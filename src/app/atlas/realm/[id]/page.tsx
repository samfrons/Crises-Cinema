import { notFound } from 'next/navigation';
import { find, idsFor, metadataFor, selectionFor } from '../../atlas-routes';
import AtlasBody from '../../AtlasBody';

export const dynamicParams = false;
export const generateStaticParams = () => idsFor('realm').map((id) => ({ id }));
export const generateMetadata = ({ params }: { params: { id: string } }) => metadataFor('realm', params.id);

export default function AtlasRealmPage({ params }: { params: { id: string } }) {
  if (!find('realm', params.id)) notFound();
  return <AtlasBody initial={selectionFor('realm', params.id)} />;
}
