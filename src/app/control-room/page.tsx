import type { Metadata } from 'next';
import { abs } from '@/lib/site';
import ControlRoomDesk from './Desk';

const title = 'The Control Room — Disasters by the Decade';
const description =
  'You are the emergency chief. Real disasters replayed on their real clocks: you see only what '
  + 'officials knew at each moment, you make the calls, and the debrief sets your choices beside '
  + 'what they did and what the inquiry found. Every fact sourced; where the record is silent, the '
  + 'game says so.';

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: abs('/control-room') },
  openGraph: {
    title,
    description,
    url: abs('/control-room'),
    type: 'article',
    siteName: 'Disasters by the Decade',
  },
  twitter: { card: 'summary_large_image', title, description },
};

export default function ControlRoomPage() {
  return <ControlRoomDesk />;
}
