import type { Metadata } from 'next';
import metaJson from '../../data/preparedness-meta.json';
import { abs } from '@/lib/site';
import type { PreparednessMeta } from './types';

import PreparednessReport from './report';

const meta = metaJson as unknown as PreparednessMeta;

const loaded = meta?.layersLoaded ?? [];
const stubbed = meta?.layersStubbed ?? [];
const appealYears = meta?.appealYears ?? [];
const countryCount = meta?.countryCount ?? 0;

const title = 'The Last Mile — Disasters by the Decade';
const description =
  'A field report on global disaster preparedness: six international indices mapped across '
  + `${countryCount || 170}-odd countries, fourteen official inquiries into what actually failed, `
  + 'and the gap between what the humanitarian system asks for and what it is given.';

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: abs('/preparedness') },
  openGraph: {
    title,
    description,
    url: abs('/preparedness'),
    type: 'article',
    siteName: 'Disasters by the Decade',
  },
  twitter: { card: 'summary_large_image', title, description },
};

export default function PreparednessPage() {
  return <PreparednessReport />;
}
