import { useEffect, useRef } from 'react';

/**
 * Marks an element `data-seen` the first time a quarter of it is on screen,
 * and calls `onSeen` once. The CSS holds a staged reveal paused until then
 * (so the debrief's lanes lay out when the player gets to them, not while
 * they are still reading the band above), and the sound layer keys its cue
 * to the same moment. Presentation only: where IntersectionObserver is
 * missing, the element is marked at once and everything is simply there.
 */
export function useSeen<T extends HTMLElement>(onSeen?: () => void, threshold = 0.25) {
  const ref = useRef<T>(null);
  const cb = useRef(onSeen);
  cb.current = onSeen;
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const mark = () => {
      if (el.dataset.seen) return;
      el.dataset.seen = '1';
      cb.current?.();
    };
    if (typeof IntersectionObserver === 'undefined') { mark(); return; }
    const io = new IntersectionObserver((es) => {
      if (es.some((e) => e.isIntersecting)) { mark(); io.disconnect(); }
    }, { threshold });
    io.observe(el);
    return () => io.disconnect();
  }, [threshold]);
  return ref;
}
