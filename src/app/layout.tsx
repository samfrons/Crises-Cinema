import type { Metadata, Viewport } from 'next';
import summaryData from '../data/summary.json';
import type { Summary } from '@/lib/taxonomy';
import { SITE_URL, abs } from '@/lib/site';
import './globals.css';

const summary = summaryData as unknown as Summary;

const title = 'Disasters by the Decade — According to Hollywood';
const description =
  `A data essay on ${summary.total} disaster films from ${summary.firstYear} to ${summary.lastYear}, ` +
  'sorted by what Hollywood was actually afraid of, decade by decade.';

export const metadata: Metadata = {
  // Without a metadataBase, Next emits relative og:url and og:image values.
  // Clients that resolve Open Graph tags out of context — link unfurlers and
  // assistant fetchers among them — cannot follow a relative URL, and some
  // treat the unresolvable tag as a broken page rather than a missing one.
  metadataBase: new URL(SITE_URL),
  title,
  description,
  applicationName: 'Disasters by the Decade',
  authors: [{ name: 'Sam Frons' }],
  keywords: ['disaster movies', 'data visualisation', 'film history', 'data essay', 'Hollywood'],
  alternates: { canonical: abs('/') },
  openGraph: {
    title,
    description,
    url: abs('/'),
    type: 'article',
    siteName: 'Disasters by the Decade',
  },
  twitter: { card: 'summary_large_image', title, description },
  // Belt and braces with robots.txt: the same permission, stated in the page
  // itself, for clients that check the meta tag and not the file.
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-snippet': -1, 'max-image-preview': 'large' },
  },
};

export const viewport: Viewport = {
  themeColor: '#f1e8d5',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
