'use client';

/**
 * Five notes pinned to moments in the data. Every figure here is read off
 * src/data/summary.json — see the numbers table under the chart to check them.
 */
const NOTES = [
  {
    era: '1950 — 1969',
    decade: 1960,
    head: 'The bomb was the only story',
    body: 'Before 1950 the set contains not one atomic film. Then it takes 5 of 19 films in the fifties and 13 of 28 in the sixties — 46%, a share no category has held since. The decade’s best-reviewed entry is Dr. Strangelove.',
  },
  {
    era: '1970 — 1979',
    decade: 1970,
    head: 'Then the ceiling fell in',
    body: 'Output leaps from 28 films to 74, and the threat moves indoors. Wreckage — planes, ships, towers, dams — takes 22 of them, the genre’s most concentrated run of things we built simply failing.',
  },
  {
    era: '1990 — 1999',
    decade: 1990,
    head: 'Computers gave the planet its close-up',
    body: 'Ninety-eight films, and Earth & Weather leads again with 26. Studios released them in matched pairs: Dante’s Peak and Volcano in 1997, Deep Impact and Armageddon in 1998.',
  },
  {
    era: '2000 — 2009',
    decade: 2000,
    head: 'Disaster stopped being a cycle',
    body: 'The largest jump in the set — 98 films to 170 — and Earth & Weather reaches its highest share anywhere, 58 of 170. What used to arrive in waves became permanent.',
  },
  {
    era: '2010 — 2019',
    decade: 2010,
    head: 'The risen overtook the bomb',
    body: 'The busiest decade on record: 230 films, peaking at 34 in 2014. For the first time zombies outnumber nuclear war, 21 to 14, and plague sits just above both at 25.',
  },
];

export default function StoryNotes({ onPick }: { onPick: (decade: number) => void }) {
  return (
    <div className="notes">
      {NOTES.map((n) => (
        <button key={n.era} className="note" onClick={() => onPick(n.decade)}>
          <span className="note-era">{n.era}</span>
          <h3>{n.head}</h3>
          <p>{n.body}</p>
          <span className="note-go">Open the {n.decade}s →</span>
        </button>
      ))}
    </div>
  );
}
