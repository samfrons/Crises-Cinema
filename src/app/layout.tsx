import type { Metadata, Viewport } from 'next';
import summaryData from '../data/summary.json';
import type { Summary } from '@/lib/taxonomy';
import './globals.css';

const summary = summaryData as unknown as Summary;

const title = 'Disasters by the Decade — According to Hollywood';
const description =
  `A data essay on ${summary.total} disaster films from ${summary.firstYear} to ${summary.lastYear}, ` +
  'sorted by what Hollywood was actually afraid of, decade by decade.';

export const metadata: Metadata = {
  title,
  description,
  applicationName: 'Disasters by the Decade',
  authors: [{ name: 'Sam Frons' }],
  keywords: ['disaster movies', 'data visualisation', 'film history', 'data essay', 'Hollywood'],
  openGraph: {
    title,
    description,
    type: 'article',
    siteName: 'Disasters by the Decade',
  },
  twitter: { card: 'summary_large_image', title, description },
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
