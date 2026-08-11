import type { MetadataRoute } from 'next';
import { abs } from '@/lib/site';
import { DECADES, summary } from './catalogue/films';

/**
 * The essay, its three companion pages and one page per decade of the
 * catalogue — so a crawler that arrives anywhere finds the whole set rather
 * than having to discover it from footer links.
 *
 * lastModified tracks the data build date. The pages are generated from it, so
 * it is the honest answer.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date(summary.generated);

  return [
    { url: abs('/'), lastModified, changeFrequency: 'monthly', priority: 1 },
    { url: abs('/catalogue'), lastModified, changeFrequency: 'monthly', priority: 0.8 },
    { url: abs('/methodology'), lastModified, changeFrequency: 'yearly', priority: 0.6 },
    { url: abs('/reel'), lastModified, changeFrequency: 'yearly', priority: 0.6 },
    ...DECADES.map(({ slug }) => ({
      url: abs(`/catalogue/${slug}`),
      lastModified,
      changeFrequency: 'monthly' as const,
      priority: 0.5,
    })),
  ];
}
