import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { abs } from '@/lib/site';
import { CASE_STUDIES } from '../../caseStudies';
import PreparednessReport from '../../report';

export const dynamicParams = false;
export const generateStaticParams = () => CASE_STUDIES.map((c) => ({ id: c.id }));

export function generateMetadata({ params }: { params: { id: string } }): Metadata {
  const c = CASE_STUDIES.find((x) => x.id === params.id);
  if (!c) return {};
  const title = `${c.title}, ${c.year} — The Last Mile`;
  const description = `${c.place}, ${c.year}. ${c.toll}. What happened, what worked, what failed, and what the official inquiry concluded.`;
  const url = abs(`/preparedness/case/${c.id}`);
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, type: 'article', siteName: 'Disasters by the Decade' },
    twitter: { card: 'summary_large_image', title, description },
  };
}

export default function CasePage({ params }: { params: { id: string } }) {
  if (!CASE_STUDIES.some((c) => c.id === params.id)) notFound();
  return <PreparednessReport initialCase={params.id} />;
}
