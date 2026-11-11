/* One consistent icon set for the dashboard: 24px grid, 1.7 stroke, round joins, currentColor.
   All icons are decorative (aria-hidden); the text next to them carries the meaning. */

import type { ReactNode } from 'react';

const PATHS = {
  score:     <><path d="M4.5 16.5a8.5 8.5 0 1115 0" /><path d="M12 13l3.5-4" /><circle cx="12" cy="13" r="1.1" /></>,
  layers:    <><path d="M12 3.5l8.5 4.5-8.5 4.5L3.5 8z" /><path d="M3.5 12.5l8.5 4.5 8.5-4.5" /><path d="M3.5 16.5L12 21l8.5-4.5" /></>,
  list:      <><path d="M9 6.5h11M9 12h11M9 17.5h11" /><path d="M4.2 6.5h.6M4.2 12h.6M4.2 17.5h.6" /></>,
  target:    <><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="4.2" /><path d="M12 12h.01" /></>,
  award:     <><circle cx="12" cy="9.5" r="5.5" /><path d="M8.6 14l-1.4 6.5L12 18l4.8 2.5-1.4-6.5" /></>,
  lock:      <><rect x="5.5" y="10.5" width="13" height="9.5" rx="2" /><path d="M8.5 10.5V8a3.5 3.5 0 017 0v2.5" /></>,
  check:     <path d="M5 12.5l4.5 4.5L19 7.5" />,
  arrow:     <path d="M5 12h14M13.5 6.5L19 12l-5.5 5.5" />,
  play:      <path d="M8 5.5v13l10.5-6.5z" />,
  chart:     <><path d="M4 20h16" /><path d="M7 20v-6M12 20V6M17 20v-9" /></>,
  clipboard: <><rect x="5.5" y="5" width="13" height="15.5" rx="2" /><path d="M9 5V3.5h6V5" /><path d="M9 13l2.2 2.2L15.5 11" /></>,
  book:      <><path d="M12 6.5c-1.8-1.4-4.3-2-7.5-2v13c3.2 0 5.7.6 7.5 2 1.8-1.4 4.3-2 7.5-2v-13c-3.2 0-5.7.6-7.5 2z" /><path d="M12 6.5v13" /></>,
  clock:     <><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></>,
  doc:       <><path d="M7 3.5h7l4.5 4.5V19a1.5 1.5 0 01-1.5 1.5H7A1.5 1.5 0 015.5 19V5A1.5 1.5 0 017 3.5z" /><path d="M14 3.5V8h4.5M9 13h6M9 16.5h6" /></>,
  up:        <path d="M5 17l5.5-5.5 3.5 3.5L19.5 9M14.5 9h5v5" />,
  down:      <path d="M5 7l5.5 5.5 3.5-3.5 5.5 6M14.5 15h5v-5" />,
  info:      <><circle cx="12" cy="12" r="8.5" /><path d="M12 11v5.5M12 7.8h.01" /></>,
  calendar:  <><rect x="4" y="5.5" width="16" height="15" rx="2" /><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4" /></>,
  chevron:   <path d="M6.5 9.5L12 15l5.5-5.5" />,
  plus:      <path d="M12 5.5v13M5.5 12h13" />,
  flag:      <><path d="M6 21V4" /><path d="M6 4.5h11l-2 4 2 4H6" /></>,
  leaf:      <><path d="M5 19c0-9 5.5-14 14.5-14 0 9-5 14.5-14.5 14z" /><path d="M5 19l8-8" /></>,
  users:     <><circle cx="9" cy="8.5" r="3.2" /><path d="M3 19.5c.5-3.4 2.7-5.2 6-5.2s5.500 1.8 6 5.2" /><path d="M15.500 5.600a3.200 3.200 0 010 5.800M17.500 14.800c2 .700 3.200 2.300 3.500 4.700" /></>,
  building:  <><path d="M5 20.500V5.500A1.500 1.500 0 016.500 4h7A1.500 1.500 0 0115 5.500v15" /><path d="M15 10h3a1.500 1.500 0 011.500 1.500v9M3.500 20.500h17M8.500 8h3M8.500 12h3M8.500 16h3" /></>,
  coins:     <><ellipse cx="12" cy="7" rx="7" ry="3" /><path d="M5 7v5c0 1.700 3.100 3 7 3s7-1.300 7-3V7" /><path d="M5 12v5c0 1.700 3.100 3 7 3s7-1.300 7-3v-5" /></>,
  tag:       <><path d="M12.500 3.500H20v7.500l-9 9-7.500-7.500z" /><circle cx="15.800" cy="7.700" r="1.200" /></>,
} satisfies Record<string, ReactNode>;

export type IconName = keyof typeof PATHS;

export function Ic({ name, size = 16, className }: { name: IconName; size?: number; className?: string }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {PATHS[name]}
    </svg>
  );
}

/** Icon of each GRI phase (1-5). */
export const PHASE_ICON: Record<number, IconName> = { 1: 'building', 2: 'leaf', 3: 'users', 4: 'coins', 5: 'tag' };
