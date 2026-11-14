import { notFound } from 'next/navigation';
import { find, idsFor, metadataFor, selectionFor } from '../../atlas-routes';
import AtlasBody from '../../AtlasBody';

export const dynamicParams = false;
export const generateStaticParams = () => idsFor('place').map((id) => ({ id }));
export const generateMetadata = ({ params }: { params: { id: string } }) => metadataFor('place', params.id);

export default function AtlasPlacePage({ params }: { params: { id: string } }) {
  if (!find('place', params.id)) notFound();
  return <AtlasBody initial={selectionFor('place', params.id)} />;
}
