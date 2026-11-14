import type { Metadata } from 'next';
import AtlasBody from './AtlasBody';
import { atlas } from './atlas-routes';
import { abs } from '@/lib/site';

const title = 'The Atlas of Ruin — Disasters by the Decade';
const description =
  `Where the world ends, according to Hollywood: ${atlas.pinnedFilms} disaster films pinned to ` +
  `${atlas.places.length} named places on a retro territory map — plus the ${atlas.spaceTotal} ` +
  'films whose catastrophe leaves Earth altogether.';

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: abs('/atlas') },
  openGraph: { title, description, type: 'article', siteName: 'Disasters by the Decade' },
  twitter: { card: 'summary_large_image', title, description },
};

export default function AtlasPage() {
  return <AtlasBody />;
}
