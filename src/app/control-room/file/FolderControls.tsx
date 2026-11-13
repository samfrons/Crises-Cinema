'use client';

import { useEffect, useState } from 'react';

/**
 * The file's only script. The folders themselves are native <details>,
 * server-rendered with their full text (a crawler, a reader without
 * JavaScript and find-in-page all get every word). This adds two things:
 *
 *  - a deep link opens its folder: arriving at, or following a link to,
 *    #file-b opens folder b if it is shut, and puts its tab at the top;
 *  - "open every folder" / "shut them all", for reading straight through
 *    (or printing). The buttons are printed only once they can work.
 */
const FOLDER_HASH = /^#file-[a-f]$/;

function folders() {
  return Array.from(document.querySelectorAll<HTMLDetailsElement>('details.cf-folder'));
}

export default function FolderControls() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(true);
    const sync = () => {
      const h = window.location.hash;
      if (!FOLDER_HASH.test(h)) return;
      const d = document.getElementById(h.slice(1));
      if (!(d instanceof HTMLDetailsElement)) return;
      if (!d.open) d.open = true;
      // The browser has already scrolled to the tab; opening grows the folder
      // downward, so the tab stays put. Focus the tab for keyboard readers.
      d.querySelector<HTMLElement>('summary')?.focus({ preventScroll: true });
    };
    sync();
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, []);

  if (!ready) return null;
  return (
    <div className="cf-controls" role="group" aria-label="Folders">
      <button type="button" className="cf-ctl" onClick={() => folders().forEach((d) => { d.open = true; })}>
        Open every folder
      </button>
      <button type="button" className="cf-ctl" onClick={() => folders().forEach((d) => { d.open = false; })}>
        Shut them all
      </button>
    </div>
  );
}
