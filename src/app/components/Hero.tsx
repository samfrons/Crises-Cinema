import { FAMILIES, GROUPS, type Summary } from '@/lib/taxonomy';

/** Representative hue for each group — the mid step of that group's ramp. */
const GROUP_COLOR: Record<string, string> = {
  world: '#964700',
  ourselves: '#116aac',
  alive: '#128f5a',
  beyond: '#983481',
};

export default function Hero({ summary }: { summary: Summary }) {
  const totals = GROUPS.map((g) => ({
    ...g,
    n: FAMILIES.filter((f) => f.group === g.id)
      .reduce((sum, f) => sum + (summary.byFamily[f.id] ?? 0), 0),
  }));
  const ranked = [...totals].sort((a, b) => b.n - a.n);
  const [first, second] = ranked;
  const [peakYear, peakCount] = summary.peakYear;

  return (
    <header className="hero">
      <div className="wrap">
        <p className="hero-kicker rise rise-1">
          A data essay · {summary.total} films · {summary.firstYear}–{summary.lastYear}
        </p>

        <h1 className="hero-title rise rise-2">
          <span className="l1">Disasters by the Decade</span>
          <span className="l2">According to Hollywood</span>
        </h1>

        <p className="hero-thesis rise rise-3">
          For more than a century the movies have rehearsed the end of the world. Sort every
          rehearsal by what actually goes wrong and the planet still takes top billing:{' '}
          <em>{first.n}</em> films blame {first.label.toLowerCase()}, <em>{second.n}</em> blame{' '}
          {second.label.toLowerCase()}.
        </p>

        <div className="split rise rise-4">
          <div className="split-bar" role="img"
            aria-label={totals.map((t) => `${t.label}: ${t.n} films`).join('. ')}>
            {totals.map((t) => (
              <div
                key={t.id}
                className="split-seg"
                style={{ background: GROUP_COLOR[t.id], flexGrow: t.n }}
              >
                <span>{t.n}</span>
              </div>
            ))}
          </div>
          <div className="split-key">
            {totals.map((t) => (
              <span key={t.id}>
                <i style={{ background: GROUP_COLOR[t.id] }} />
                {t.label}
              </span>
            ))}
          </div>
        </div>

        <div className="hero-foot rise rise-4">
          <span><b>11</b> categories, from 105 in the raw data</span>
          <span><b>{peakCount}</b> films in {peakYear}, the busiest year</span>
          <span><b>{summary.decades.length}</b> decades on the reel</span>
          <span>
            <a href="#reel" style={{ color: 'var(--ember)', textDecoration: 'none', borderBottom: '1px solid currentColor' }}>
              Start the reel ↓
            </a>
          </span>
          <span>
            <a href="#explorer" style={{ color: 'var(--ember)', textDecoration: 'none', borderBottom: '1px solid currentColor' }}>
              Browse the catalogue ↓
            </a>
          </span>
          <span>
            <a href="/atlas" style={{ color: 'var(--ember)', textDecoration: 'none', borderBottom: '1px solid currentColor' }}>
              Open the atlas →
            </a>
          </span>
        </div>
      </div>
    </header>
  );
}
