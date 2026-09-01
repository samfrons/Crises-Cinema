import type { Metadata } from 'next';
import scenariosData from '../../data/scenarios.json';
import { abs } from '@/lib/site';
import type { ScenarioBundle } from './types';
import ControlRoomGame from './ControlRoomGame';
import './control-room.css';

// The bundle is produced by scripts/build-scenarios.mjs, which refuses to
// build any playable scenario containing an unsourced fact — so everything
// this page can show the player is either cited or explicitly marked as
// absent from the record.
const bundle = scenariosData as unknown as ScenarioBundle;

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
  return (
    <div className="cr-page">
      <a className="skip" href="#desk">Skip to the desk</a>

      <header className="cr-masthead">
        <div className="wrap">
          <p className="cr-kicker">
            <a href="/">Disasters by the Decade</a>
            <span aria-hidden>·</span>
            <span>An interactive companion</span>
          </p>
          <h1 className="cr-title">
            <span className="l1">The Control Room</span>
            <span className="l2">You are the emergency chief. The clock is real.</span>
          </h1>
          <p className="cr-lede">
            Disaster films cut to the general who makes the call in time. The record reads differently.
            Each scenario below replays a real day on its real clock: you see only what officials could
            see at each moment, you choose, and the clock advances along what actually happened — this
            game never invents an outcome. At the end, your choices stand beside theirs, and beside what
            the inquiry concluded.
          </p>
        </div>
      </header>

      <main id="desk" className="cr-desk">
        <ControlRoomGame bundle={bundle} />
      </main>

      <footer className="cr-colophon">
        <div className="wrap">
          <p>
            Every timestep, action and finding in a playable scenario carries a citation, enforced at
            build time; scenarios still in research are shown locked. Choices are logged anonymously in
            your browser only — no account, no identifiers — so aggregate hesitation and warning
            behaviour can one day be charted next to the historical path.
          </p>
          <p>
            Part of <a href="/">Disasters by the Decade</a>. See also{' '}
            <a href="/preparedness">the preparedness field report</a> and{' '}
            <a href="/dispatches">dispatches from the ground</a>.
          </p>
        </div>
      </footer>
    </div>
  );
}
