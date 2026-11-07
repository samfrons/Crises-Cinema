'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import './site-nav.css';

/** The programme strip: one line of printed-index entries above every page. */
const ITEMS = [
  { href: '/', label: 'The Essay' },
  { href: '/atlas', label: 'Atlas' },
  { href: '/dispatches', label: 'Dispatches' },
  { href: '/control-room', label: 'Control Room' },
  { href: '/preparedness', label: 'Preparedness' },
  { href: '/reel', label: 'First Reels' },
  { href: '/catalogue', label: 'Catalogue' },
  { href: '/methodology', label: 'Methodology' },
] as const;

function isCurrent(pathname: string, href: string) {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(href + '/');
}

export default function SiteNav() {
  const pathname = usePathname() ?? '/';
  const listRef = useRef<HTMLUListElement>(null);

  // On a narrow screen the strip scrolls; bring the current entry into view.
  useEffect(() => {
    const list = listRef.current;
    const cur = list?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!list || !cur) return;
    const target = cur.offsetLeft - (list.clientWidth - cur.offsetWidth) / 2;
    list.scrollLeft = Math.max(0, target);
  }, [pathname]);

  return (
    <nav className="sn" aria-label="All pages">
      <div className="sn-inner">
        <ul className="sn-list" ref={listRef}>
          {ITEMS.map((it) => {
            const current = isCurrent(pathname, it.href);
            return (
              <li key={it.href}>
                <Link
                  href={it.href}
                  className="sn-link"
                  aria-current={current ? 'page' : undefined}
                >
                  {it.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
