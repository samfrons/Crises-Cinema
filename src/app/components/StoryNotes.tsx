'use client';

/**
 * Notes pinned to moments in the data. Every figure here is read off
 * src/data/summary.json — see the numbers table under the chart to check them.
 * Re-verify these against a fresh build:data run before editing; adding films
 * to public/MasterMovies.json shifts decade totals and can quietly break a
 * claim (it broke four of the first five, in fact, when 81 films were added
 * across the 1910s-2020s in one pass).
 */
const NOTES = [
  {
    era: '1950 — 1969',
    decade: 1960,
    head: 'The bomb was the only story',
    body: 'Before 1950 the set contains not one atomic film. Then it takes 6 of 20 films in the fifties and 16 of 32 in the sixties — 50%, a share no category has held since. The decade’s best-reviewed entry is Dr. Strangelove.',
  },
  {
    era: '1970 — 1979',
    decade: 1970,
    head: 'Then the ceiling fell in',
    body: 'Output leaps from 32 films to 90, and the threat moves indoors. Wreckage — planes, ships, towers, dams — takes 22 of them, the genre’s most concentrated run of things we built simply failing.',
  },
  {
    era: '1990 — 1999',
    decade: 1990,
    head: 'Computers gave the planet its close-up',
    body: 'A hundred and five films, and Earth & Weather leads again with 27. Studios released them in matched pairs: Dante’s Peak and Volcano in 1997, Deep Impact and Armageddon in 1998.',
  },
  {
    era: '2000 — 2009',
    decade: 2000,
    head: 'Disaster stopped being a cycle',
    body: 'A jump to 174 films, and Earth & Weather reaches its highest share anywhere — 58 of them, a full third of the decade. What used to arrive in waves became permanent.',
  },
  {
    era: '2010 — 2019',
    decade: 2010,
    head: 'The risen overtook the bomb',
    body: 'The busiest decade on record: 237 films, peaking at 34 in 2014. For the first time zombies outnumber nuclear war, 23 to 14, and plague sits just above both at 25.',
  },
  {
    era: '2020 — 2025',
    decade: 2020,
    head: 'The best-reviewed decade yet — so far',
    body: 'Only 74 films, the smallest complete decade since the 1960s, but the best-reviewed by a clear margin: a 6.8 average against 5.8–6.0 everywhere from the seventies through the 2010s. Take it with a grain of salt — the cheap, forgettable end of every other decade only got added to the record once enough time had passed to dig it up.',
  },
  {
    era: '1950s → 2010s',
    decade: 2010,
    head: 'Hollywood stopped being the only studio afraid of the end',
    body: 'Three in four disaster films were American in the 1950s (15 of 20). By the 2010s, fewer than half were (100 of 219) — the rest now split across Japan, the UK, Italy, South Korea, and a dozen other countries.',
  },
  {
    era: 'Across every decade',
    decade: 1990,
    head: 'The machines never let you escape',
    body: 'Read the plot summaries themselves and a pattern shows up in the language, not just the body count: Machines films describe an ending in annihilation terms 33% of the time and survival terms just 3% — the widest gap of any category. The Undead runs the other way, promising survival in 38% of its summaries, the highest of any family.',
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
