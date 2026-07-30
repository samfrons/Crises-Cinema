import type { Metadata, Viewport } from 'next';
import './globals.css';

const title = 'Disasters by the Decade — According to Hollywood';
const description =
  'A data essay on 750 disaster films from 1898 to 2025, sorted by what Hollywood was actually afraid of, decade by decade.';

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
