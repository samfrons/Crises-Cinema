import scenariosData from '../../data/scenarios.json';
import essayJson from '../../data/essay.json';
import type { ScenarioBundle } from './types';
import { toCards, WPM } from './summary';
import ControlRoomGame, { type FileCard, type Entry } from './ControlRoomGame';
import Elsewhere from '@/app/components/Elsewhere';
import './control-room.css';

// The bundle is produced by scripts/build-scenarios.mjs, which refuses to
// build any playable scenario containing an unsourced fact — so everything
// this page can show the player is either cited or explicitly marked as
// absent from the record.
// Only card summaries cross to the client here; the game loads the full
// scenarios on demand once a day is picked.
const cards = toCards(scenariosData as unknown as ScenarioBundle);

// The desk officer's file (/control-room/file) is the Last Mile essay filed
// for reading at the desk. Only its count line crosses to the client.
type EssayShape = { status: string; sources: unknown[]; sections: { paragraphs: { text: string }[] }[] };
const essay = (essayJson as unknown as Record<string, EssayShape>)['last-mile'];
const essayWords = essay.sections.reduce((n, s) => n + s.paragraphs.reduce((m, p) => m + p.text.split(/\s+/).filter(Boolean).length, 0), 0);
const file: FileCard = {
  folders: essay.sections.length,
  sources: essay.sources.length,
  minutes: Math.max(1, Math.round(essayWords / WPM)),
  draft: essay.status === 'draft',
};

export default function ControlRoomDesk({ entry }: { entry?: Entry }) {
  return (
    <div className="cr-page">
      <a className="skip" href="#desk">Skip to the desk</a>

      <header className="cr-masthead">
        <div className="wrap">
          <p className="cr-kicker rise rise-1">
            <a href="/">Disasters by the Decade</a>
            <span aria-hidden>·</span>
            <span>An interactive companion</span>
          </p>
          <h1 className="cr-title rise rise-2">
            <span className="l1">The Control Room</span>
            <span className="l2">You are the emergency chief. The clock is real.</span>
          </h1>
          <p className="cr-lede rise rise-3">
            Disaster films cut to the general who makes the call in time. The record reads differently.
            Each scenario below replays a real day on its real clock: you see only what officials could
            see at each moment, you choose, and the clock advances along what actually happened — this
            game never invents an outcome. At the end, your choices stand beside theirs, and beside what
            the inquiry concluded.
          </p>
        </div>
      </header>

      <main id="desk" className="cr-desk">
        <ControlRoomGame cards={cards} file={file} entry={entry} />
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
            What the desk does not measure: the score, the option wording and each option&apos;s effects are
            game design, labelled as such in the debrief; the record says what officials did, never what a
            different call would have saved. The lessons under &ldquo;What the record teaches&rdquo; are the
            project&apos;s reading, each tied to the cited line it is drawn from, and the terms of the desk are
            official definitions, quoted with their source. Your last completed run of each day is kept in
            this browser&apos;s storage only, so a replay can be set beside it.
          </p>
          <Elsewhere current="/control-room" />
        </div>
      </footer>
    </div>
  );
}
