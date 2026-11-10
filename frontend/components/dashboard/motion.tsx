'use client';
/* Motion helpers for the dashboard.
   - Everything is one-shot and CSS-driven: an element flips to its final state once, the first time it
     scrolls into view. There are no timers, no requestAnimationFrame loops and no continuous movement.
   - With prefers-reduced-motion (or no IntersectionObserver) elements render in their final state immediately. */

import { useEffect, useRef, useState } from 'react';
import type { ReactNode, RefObject } from 'react';

/** True when the user asked the OS/browser for reduced motion. Updates live if the setting changes. */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const on = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener?.('change', on);
    return () => mq.removeEventListener?.('change', on);
  }, []);
  return reduced;
}

/** [ref, shown]: `shown` turns true once the element is on screen (immediately under reduced motion). */
export function useInView<T extends Element>(threshold = 0.18): [RefObject<T>, boolean] {
  const ref = useRef<T>(null);
  const reduced = useReducedMotion();
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    if (seen) return;
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') { setSeen(true); return; }
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) { setSeen(true); io.disconnect(); }
    }, { threshold });
    io.observe(el);
    return () => io.disconnect();
  }, [seen, threshold]);
  return [ref, seen || reduced];
}

/** Section wrapper: fades and rises a few pixels the first time it enters the viewport. */
export function Reveal({ children, delay = 0, className = '' }: { children: ReactNode; delay?: number; className?: string }) {
  const [ref, shown] = useInView<HTMLDivElement>(0.08);
  return (
    <div ref={ref} className={`da-reveal${shown ? ' is-in' : ''} ${className}`} style={delay ? { transitionDelay: `${delay}ms` } : undefined}>
      {children}
    </div>
  );
}
