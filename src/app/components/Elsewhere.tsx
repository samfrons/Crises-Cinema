import './elsewhere.css';

/** One sibling-link set for every colophon, so no page forgets a new screen. */
const PAGES = [
  { href: '/', label: 'The Essay' },
  { href: '/atlas', label: 'The Atlas of Ruin' },
  { href: '/dispatches', label: 'Dispatches from the Ground' },
  { href: '/control-room', label: 'The Control Room' },
  { href: '/preparedness', label: 'The Last Mile' },
  { href: '/reel', label: 'The First Reels' },
  { href: '/catalogue', label: 'The Catalogue' },
  { href: '/methodology', label: 'Methodology' },
] as const;

export default function Elsewhere({
  current,
  tone = 'light',
}: {
  current: (typeof PAGES)[number]['href'];
  tone?: 'light' | 'dark';
}) {
  return (
    <nav className={`else else-${tone}`} aria-label="Elsewhere on this site">
      <p className="else-h">Elsewhere on this site</p>
      <ul>
        {PAGES.filter((p) => p.href !== current).map((p) => (
          <li key={p.href}>
            <a href={p.href}>{p.label}</a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
